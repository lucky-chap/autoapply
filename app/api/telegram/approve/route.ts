import { auth0 } from "@/lib/auth0"
import { NextResponse } from "next/server"

const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL!
const CONVEX_API_SECRET = process.env.CONVEX_API_SECRET!
const BASE_URL = process.env.APP_BASE_URL!

export async function GET(req: Request) {
  const url = new URL(req.url)
  const actionId = url.searchParams.get("action")

  if (!actionId) {
    return NextResponse.redirect(
      new URL("/dashboard?error=missing_action", BASE_URL)
    )
  }

  // Always force Auth0 login screen for step-up auth on approvals
  const confirmed = url.searchParams.get("confirmed")
  if (!confirmed) {
    const returnTo = `/api/telegram/approve?action=${encodeURIComponent(actionId)}&confirmed=1`
    return NextResponse.redirect(
      new URL(
        `/auth/login?prompt=login&returnTo=${encodeURIComponent(returnTo)}`,
        BASE_URL
      )
    )
  }

  // After Auth0 login screen, verify session exists
  const session = await auth0.getSession()
  if (!session) {
    return NextResponse.redirect(
      new URL("/dashboard?error=auth_failed", BASE_URL)
    )
  }

  try {
    // Generate a fresh approval token from the pending action ID
    const tokenRes = await fetch(`${CONVEX_SITE_URL}/approve/token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONVEX_API_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pendingActionId: actionId,
        userId: session.user.sub,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.json().catch(() => ({ error: "Unknown error" }))
      const isNotFound = tokenRes.status === 404
      return new Response(
        approvalPage(
          isNotFound ? "Action Not Found" : "Approval Failed",
          isNotFound
            ? "This action has already been processed or no longer exists."
            : escHtml(body.error ?? "Could not approve this action."),
          false
        ),
        {
          status: tokenRes.status,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      )
    }

    const { token } = await tokenRes.json()

    // Use the fresh token to approve
    const convexRes = await fetch(
      `${CONVEX_SITE_URL}/approve/email?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(session.user.sub)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CONVEX_API_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!convexRes.ok) {
      const body = await convexRes.text()
      return new Response(
        approvalPage(
          "Approval Failed",
          `Could not approve this action. ${body}`,
          false
        ),
        {
          status: convexRes.status,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      )
    }

    const result = await convexRes.json()

    return new Response(
      approvalPage(
        "Email Approved",
        `Your application to <strong>${escHtml(result.company ?? "")}</strong> for <strong>${escHtml(result.role ?? "")}</strong> is being sent now. You can close this page.`,
        true
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  } catch (err) {
    return new Response(
      approvalPage(
        "Approval Failed",
        `An error occurred: ${escHtml(String(err))}`,
        false
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  }
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function approvalPage(
  title: string,
  message: string,
  success: boolean
): string {
  const color = success ? "#1f8f57" : "#c53f3f"
  const chipBg = success ? "#e5f4d7" : "#f7ddd9"
  const cardTone = success ? "#f1f8ea" : "#f9efed"
  const icon = success ? "✓" : "!"
  const statusLabel = success ? "Approved" : "Needs Attention"
  const iconRing = success ? "#b8df9a" : "#e9b4ac"
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)} — AutoApply</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  :root{
    --ink:#1e1a26;
    --muted:rgba(30,26,38,.68);
    --paper:#f6f4f4;
  }
  body{
    font-family:'Manrope',system-ui,sans-serif;
    color:var(--ink);
    background:
      radial-gradient(110% 80% at 10% 0%, #f3f7e8 0%, #f6f4f4 44%, #efede7 100%);
    display:flex;
    align-items:center;
    justify-content:center;
    min-height:100vh;
    padding:1.25rem;
  }
  .shell{
    width:min(560px,100%);
  }
  .brand{
    text-align:center;
    font-family:'Sora',system-ui,sans-serif;
    font-size:1.6rem;
    font-weight:600;
    letter-spacing:-0.03em;
    margin-bottom:1.1rem;
  }
  .card{
    background:linear-gradient(180deg,var(--paper) 0%,${cardTone} 100%);
    border:1px solid rgba(30,26,38,.14);
    border-radius:2rem;
    padding:2rem 1.55rem;
    text-align:center;
    box-shadow:0 24px 38px -26px rgba(30,26,38,.35);
  }
  .top{
    display:flex;
    justify-content:center;
    margin-bottom:1rem;
  }
  .chip{
    display:inline-flex;
    align-items:center;
    gap:.5rem;
    border:1px solid rgba(30,26,38,.2);
    border-radius:999px;
    background:${chipBg};
    padding:.42rem .82rem;
    font-size:.72rem;
    font-weight:700;
    letter-spacing:.08em;
    text-transform:uppercase;
  }
  .icon{
    width:2rem;
    height:2rem;
    border-radius:999px;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:1.05rem;
    font-weight:800;
    border:1px solid ${iconRing};
    background:#fff;
  }
  h1{
    font-family:'Sora',system-ui,sans-serif;
    font-size:2rem;
    line-height:1.04;
    letter-spacing:-0.03em;
    color:${color};
  }
  p{
    margin-top:.95rem;
    line-height:1.64;
    font-size:1rem;
    color:var(--muted);
  }
  p strong{color:var(--ink)}
  .foot{
    margin-top:1.3rem;
    font-size:.76rem;
    font-weight:600;
    color:rgba(30,26,38,.45);
    letter-spacing:.11em;
    text-transform:uppercase;
  }
  @media (max-width:480px){
    .card{border-radius:1.5rem;padding:1.6rem 1.1rem}
    h1{font-size:1.7rem}
  }
</style></head>
<body>
  <main class="shell">
    <div class="brand">AutoApply</div>
    <section class="card">
      <div class="top">
        <div class="chip">
          <span class="icon">${icon}</span>
          <span>${statusLabel}</span>
        </div>
      </div>
      <h1>${title}</h1>
      <p>${message}</p>
      <div class="foot">Telegram approval center</div>
    </section>
  </main>
</body></html>`
}
