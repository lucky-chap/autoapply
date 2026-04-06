"use node"

/**
 * Direct Gemini API caller for Convex actions.
 * Uses the Gemini REST API with an API key — no proxy, no ADC, no SDK needed.
 * Set GOOGLE_GENERATIVE_AI_API_KEY in Convex environment variables.
 */
export async function callVertex(
  prompt: string,
  maxTokens = 4000
): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set")
  }

  const model = "gemini-2.5-flash"
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  console.log(`[lib/vertex] Calling Gemini API directly (prompt length: ${prompt.length})`)

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
      },
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error(`[lib/vertex] Gemini API error (${response.status}):`, errText)
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`)
  }

  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    console.error("[lib/vertex] No text in Gemini response:", JSON.stringify(data))
    throw new Error("Empty response from Gemini API")
  }

  return text
}
