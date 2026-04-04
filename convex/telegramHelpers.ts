/**
 * Shared Telegram Bot API helpers, HTML escaping, base64 utilities,
 * and MIME email encoding used across the Telegram integration.
 */

// ── HTML escaping ──

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

// ── Telegram Bot API wrappers ──

export async function sendTelegram(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error(`[telegram] ${method} failed: ${err}`)
    throw new Error(`Telegram ${method} failed: ${err}`)
  }
  return res.json()
}

export async function sendMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: unknown
) {
  return sendTelegram(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export async function editMessageReplyMarkup(
  botToken: string,
  chatId: string,
  messageId: number
) {
  return sendTelegram(botToken, "editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  })
}

export async function editMessageText(
  botToken: string,
  chatId: string,
  messageId: number,
  text: string,
  replyMarkup?: unknown
) {
  return sendTelegram(botToken, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

export async function answerCallbackQuery(
  botToken: string,
  callbackQueryId: string,
  text?: string
) {
  return sendTelegram(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  })
}

// ── Base64 helpers (Convex runtime has no Node Buffer) ──

export function toBase64(str: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(str), (b) =>
      String.fromCharCode(b)
    ).join("")
  )
}

export function toBase64Url(str: string): string {
  return toBase64(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(
    Array.from(bytes, (b) => String.fromCharCode(b)).join("")
  )
}

// ── Email encoding (MIME) ──

export function encodeSubject(subject: string): string {
  if (/[^\x20-\x7E]/.test(subject)) {
    return `=?UTF-8?B?${toBase64(subject)}?=`
  }
  return subject
}

export interface Attachment {
  filename: string
  mimeType: string
  data: Uint8Array
}

export function encodeEmail({
  to,
  subject,
  body,
  from,
  trackingPixelUrl,
  attachments,
}: {
  to: string
  subject: string
  body: string
  from?: { name: string; email: string }
  trackingPixelUrl?: string
  attachments?: Attachment[]
}): string {
  const encodedSubject = encodeSubject(subject)
  const fromHeader = from ? `From: ${from.name} <${from.email}>` : ""

  const headers = [
    ...(fromHeader ? [fromHeader] : []),
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
  ]

  const hasAttachments = attachments && attachments.length > 0

  if (!trackingPixelUrl && !hasAttachments) {
    const rawEmail = [
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\n")
    return toBase64Url(rawEmail)
  }

  const mixedBoundary = "----autoapply_mixed"
  const altBoundary = "----autoapply_alt"

  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")

  const trackingImg = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`
    : ""

  // Build the text/html alternative part
  const altPart = [
    `--${altBoundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
    "",
    `--${altBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    `<html><body><div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${htmlBody}</div>${trackingImg}</body></html>`,
    "",
    `--${altBoundary}--`,
  ].join("\n")

  if (!hasAttachments) {
    const rawEmail = [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      "",
      altPart,
    ].join("\n")
    return toBase64Url(rawEmail)
  }

  // With attachments: use multipart/mixed wrapping multipart/alternative + attachment parts
  const attachmentParts = attachments!.map((att) => {
    const b64 = bytesToBase64(att.data)
    // Split base64 into 76-char lines for MIME compliance
    const lines = b64.match(/.{1,76}/g) || [b64]
    return [
      `--${mixedBoundary}`,
      `Content-Type: ${att.mimeType}; name="${att.filename}"`,
      `Content-Disposition: attachment; filename="${att.filename}"`,
      `Content-Transfer-Encoding: base64`,
      "",
      ...lines,
    ].join("\n")
  })

  const rawEmail = [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
    "",
    altPart,
    "",
    ...attachmentParts,
    "",
    `--${mixedBoundary}--`,
  ].join("\n")

  return toBase64Url(rawEmail)
}

// ── Approval URL button builder ──

/**
 * Build the inline keyboard row for approving/rejecting a pending email action.
 * The "Approve" button is a URL button linking to the step-up auth endpoint,
 * while "Reject" remains a callback button (low-risk action).
 */
export function buildApprovalButtons(
  _siteUrl: string,
  pendingActionId: string,
  options?: { approveLabel?: string }
): { text: string; url?: string; callback_data?: string }[] {
  const approveLabel = options?.approveLabel ?? "✅ Approve & Send"
  // Use the Next.js app URL so the approval goes through OAuth
  // The approve route generates a fresh token on each click, so links never expire
  const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || _siteUrl
  return [
    { text: approveLabel, url: `${appBaseUrl}/api/telegram/approve?action=${pendingActionId}` },
    { text: "❌ Reject", callback_data: `reject:${pendingActionId}` },
  ]
}

// ── Linking code generator ──

export function generateLinkingCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}
