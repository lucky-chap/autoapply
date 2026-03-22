function encodeSubject(subject: string): string {
  // Use RFC 2047 encoded-word for non-ASCII characters
  if (/[^\x20-\x7E]/.test(subject)) {
    return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`
  }
  return subject
}

export function encodeEmail({
  to,
  subject,
  body,
  from,
  trackingPixelUrl,
}: {
  to: string
  subject: string
  body: string
  from?: { name: string; email: string }
  trackingPixelUrl?: string
}): string {
  const encodedSubject = encodeSubject(subject)
  const fromHeader = from ? `From: ${from.name} <${from.email}>` : ""

  const headers = [
    ...(fromHeader ? [fromHeader] : []),
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
  ]

  if (!trackingPixelUrl) {
    const rawEmail = [
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\n")
    return Buffer.from(rawEmail).toString("base64url")
  }

  const boundary = "----autoapply_boundary"
  const htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")

  const rawEmail = [
    ...headers,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
    "",
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    "",
    `<html><body><div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${htmlBody}</div><img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" /></body></html>`,
    "",
    `--${boundary}--`,
  ].join("\n")

  return Buffer.from(rawEmail).toString("base64url")
}

export async function sendGmailMessage(
  accessToken: string,
  encodedEmail: string
) {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: encodedEmail }),
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail send failed: ${JSON.stringify(err)}`)
  }

  return res.json()
}

export async function listGmailMessages(
  accessToken: string,
  query: string,
  maxResults = 10
) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  })
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail list failed: ${JSON.stringify(err)}`)
  }

  return res.json()
}

export async function getGmailMessage(accessToken: string, messageId: string) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Gmail get failed: ${JSON.stringify(err)}`)
  }

  return res.json()
}
