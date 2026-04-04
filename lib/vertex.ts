"use node"

/**
 * Proxy-based Vertex AI caller for Convex.
 * This file is safe to import in Convex actions as it only uses global fetch.
 */
export async function callVertex(
  prompt: string,
  maxTokens = 4000
): Promise<string> {
  const baseUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  const apiUrl = `${baseUrl}/api/ai/vertex`
  const secret = process.env.CONVEX_API_SECRET

  console.log(`[lib/vertex] Proxying AI call to ${apiUrl} (length: ${prompt.length})`)

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": secret ? `Bearer ${secret}` : "",
    },
    body: JSON.stringify({ prompt, maxTokens }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[lib/vertex] Proxy error (${response.status}):`, errText)
    throw new Error(`AI Proxy Error: ${response.status} - ${errText}`)
  }

  const data = await response.json()
  return data.text
}
