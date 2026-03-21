const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

// glm-4.7-flash is a "thinking" model — it spends most tokens on internal
// reasoning_content, so max_tokens must be set high enough that the visible
// content field isn't empty.
export async function callGLM(
  prompt: string,
  maxTokens = 4000,
): Promise<string> {
  const response = await fetch(GLM_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: "glm-4.7-flash",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`GLM API error (${response.status}): ${err}`)
  }

  const data = await response.json()
  const content = data.choices[0].message.content

  if (!content) {
    throw new Error(
      `GLM returned empty content (finish_reason: ${data.choices[0].finish_reason}). ` +
        "Try increasing max_tokens — reasoning consumes most of the budget.",
    )
  }

  return content
}
