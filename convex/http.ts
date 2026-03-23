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
