import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { Id } from "./_generated/dataModel"

const http = httpRouter()

// 1x1 transparent PNG pixel (68 bytes)
const TRACKING_PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

http.route({
  path: "/track/open",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const url = new URL(req.url)
    const applicationId = url.searchParams.get("id")

    if (applicationId) {
      try {
        await ctx.runMutation(internal.applications.recordOpen, {
          applicationId: applicationId as Id<"applications">,
          userAgent: req.headers.get("user-agent") ?? undefined,
        })
      } catch {
        // Silently fail — don't break the pixel response
      }
    }

    return new Response(TRACKING_PIXEL, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    })
  }),
})

// Link click tracker — records click then 302 redirects to real URL
http.route({
  path: "/track/click",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const params = new URL(req.url).searchParams
    const applicationId = params.get("id")
    const targetUrl = params.get("url")

    if (applicationId && targetUrl) {
      try {
        await ctx.runMutation(internal.applications.recordClick, {
          applicationId: applicationId as Id<"applications">,
          url: targetUrl,
          userAgent: req.headers.get("user-agent") ?? undefined,
        })
      } catch {
        // Don't break the redirect
      }
    }

    // Always redirect — even if recording fails
    return new Response(null, {
      status: 302,
      headers: {
        Location: targetUrl || "/",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    })
  }),
})

// Store refresh token — called from Next.js API routes with a shared secret
http.route({
  path: "/api/store-refresh-token",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = req.headers.get("Authorization")
    if (!secret || secret !== `Bearer ${process.env.CONVEX_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const { userId, auth0RefreshToken } = await req.json()
    if (!userId || !auth0RefreshToken) {
      return new Response("Missing userId or auth0RefreshToken", { status: 400 })
    }

    await ctx.runMutation(internal.userTokens.upsertRefreshToken, {
      userId,
      auth0RefreshToken,
    })
    return new Response("OK", { status: 200 })
  }),
})

// Email send approval — OAuth-protected via Next.js API route
// The Next.js route checks Auth0 session, then calls this POST endpoint with
// a shared secret and the authenticated userId for ownership verification.
http.route({
  path: "/approve/email",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Verify shared secret from Next.js API route
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || authHeader !== `Bearer ${process.env.CONVEX_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const url = new URL(req.url)
    const token = url.searchParams.get("token")
    const userId = url.searchParams.get("userId")

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const result = await ctx.runMutation(internal.telegramLinks.consumeApprovalToken, { token })

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired approval link" }),
        { status: 410, headers: { "Content-Type": "application/json" } }
      )
    }

    // Token valid — verify the authenticated user owns this pending action
    const action = await ctx.runQuery(internal.pendingActions.getById, {
      id: result.pendingActionId,
    })

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    if (userId && action.userId !== userId) {
      return new Response(
        JSON.stringify({ error: "This approval belongs to a different account. Please log in with the correct account." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    // Approve the pending action
    try {
      await ctx.runMutation(internal.pendingActions.internalApprove, {
        id: result.pendingActionId,
      })

      // Notify via Telegram that it was approved
      if (action.telegramChatId) {
        await ctx.scheduler.runAfter(0, internal.telegram.sendNotification, {
          chatId: action.telegramChatId,
          text: `✅ <b>Approved!</b> Sending your application to <b>${action.payload.company}</b> (${action.payload.role}) now...`,
        })

        // Remove the inline keyboard from the original preview message
        if (action.telegramMessageId) {
          await ctx.scheduler.runAfter(0, internal.telegram.clearTelegramKeyboard, {
            chatId: action.telegramChatId,
            messageId: parseInt(action.telegramMessageId, 10),
          })
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          company: action.payload.company,
          role: action.payload.role,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Could not approve: ${String(err)}` }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }
  }),
})




// Generate a fresh approval token for a pending action (called by Next.js approve route)
http.route({
  path: "/approve/token",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader || authHeader !== `Bearer ${process.env.CONVEX_API_SECRET}`) {
      return new Response("Unauthorized", { status: 401 })
    }

    const { pendingActionId, userId } = await req.json()
    if (!pendingActionId) {
      return new Response(JSON.stringify({ error: "Missing pendingActionId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Verify the pending action exists and belongs to this user
    const action = await ctx.runQuery(internal.pendingActions.getById, {
      id: pendingActionId as Id<"pendingActions">,
    })

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Action not found or already processed" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }

    if (userId && action.userId !== userId) {
      return new Response(
        JSON.stringify({ error: "This action belongs to a different account" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      )
    }

    // Generate a fresh approval token
    const token: string = await ctx.runMutation(
      internal.telegramLinks.createApprovalToken,
      { pendingActionId: pendingActionId as Id<"pendingActions"> }
    )

    return new Response(
      JSON.stringify({ token }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }),
})

// Telegram bot webhook
http.route({
  path: "/telegram/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Verify the request comes from Telegram
    const secretToken = req.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 })
    }

    const update = await req.text()
    // Schedule instead of await — return 200 immediately so Telegram doesn't retry
    await ctx.scheduler.runAfter(0, internal.telegram.processUpdate, { update })
    return new Response("OK", { status: 200 })
  }),
})

export default http
