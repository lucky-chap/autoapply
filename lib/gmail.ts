function encodeSubject(subject: string): string {
  // Use RFC 2047 encoded-word for non-ASCII characters
  if (/[^\x20-\x7E]/.test(subject)) {
    return `=?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`
  }
  return subject
}

/**
 * Wraps all href="..." URLs in HTML through the click-tracking redirect.
 */
function wrapLinksForTracking(
  html: string,
  trackBaseUrl: string,
  applicationId: string
): string {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url) => {
      const tracked = `${trackBaseUrl}/track/click?id=${applicationId}&url=${encodeURIComponent(url)}`
      return `href="${tracked}"`
    }
  )
}

export interface ProfileLinks {
  githubUrl?: string
  linkedinUrl?: string
  portfolioUrl?: string
}

/**
 * Builds a footer HTML block with tracked profile links.
 */
function buildProfileFooter(
  links: ProfileLinks,
  trackBaseUrl: string,
  applicationId: string
): string {
  const items: string[] = []

  if (links.portfolioUrl) {
    const tracked = `${trackBaseUrl}/track/click?id=${applicationId}&url=${encodeURIComponent(links.portfolioUrl)}`
    items.push(`<a href="${tracked}" style="color:#2563eb;text-decoration:none">Portfolio</a>`)
  }
  if (links.linkedinUrl) {
    const tracked = `${trackBaseUrl}/track/click?id=${applicationId}&url=${encodeURIComponent(links.linkedinUrl)}`
    items.push(`<a href="${tracked}" style="color:#2563eb;text-decoration:none">LinkedIn</a>`)
  }
  if (links.githubUrl) {
    const tracked = `${trackBaseUrl}/track/click?id=${applicationId}&url=${encodeURIComponent(links.githubUrl)}`
    items.push(`<a href="${tracked}" style="color:#2563eb;text-decoration:none">GitHub</a>`)
  }

  if (items.length === 0) return ""

  return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280">${items.join(" &middot; ")}</div>`
}

export function encodeEmail({
  to,
  subject,
  body,
  from,
  trackingPixelUrl,
  applicationId,
  trackBaseUrl,
  profileLinks,
}: {
  to: string
  subject: string
  body: string
  from?: { name: string; email: string }
  trackingPixelUrl?: string
  applicationId?: string
  trackBaseUrl?: string
  profileLinks?: ProfileLinks
}): string {
  const encodedSubject = encodeSubject(subject)
  const fromHeader = from ? `From: ${from.name} <${from.email}>` : ""

  const headers = [
    ...(fromHeader ? [fromHeader] : []),
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
  ]

  // No tracking at all — plain text email
  if (!trackingPixelUrl && !applicationId) {
    const rawEmail = [
      ...headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      "",
      body,
    ].join("\n")
    return Buffer.from(rawEmail).toString("base64url")
  }

  const boundary = "----autoapply_boundary"
  let htmlBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>")

  // Convert bare URLs in the cover letter into clickable links
  htmlBody = htmlBody.replace(
    /(https?:\/\/[^\s<>"&;]+)/g,
    '<a href="$1" style="color:#2563eb">$1</a>'
  )

  // Wrap all <a href="..."> through the click tracker
  if (trackBaseUrl && applicationId) {
    htmlBody = wrapLinksForTracking(htmlBody, trackBaseUrl, applicationId)
  }

  // Profile links footer (Portfolio · LinkedIn · GitHub)
  const footer = (trackBaseUrl && applicationId && profileLinks)
    ? buildProfileFooter(profileLinks, trackBaseUrl, applicationId)
    : ""

  const pixelTag = trackingPixelUrl
    ? `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none" alt="" />`
    : ""

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
    `<html><body><div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#333">${htmlBody}${footer}</div>${pixelTag}</body></html>`,
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
