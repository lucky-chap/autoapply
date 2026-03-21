export function encodeEmail({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}): string {
  const rawEmail = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
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
