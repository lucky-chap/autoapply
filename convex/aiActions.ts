import { internalAction, ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const GLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"

export async function callGLM(prompt: string, apiKey: string, maxTokens = 4000): Promise<string> {
  const response = await fetch(GLM_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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
      `GLM returned empty content (finish_reason: ${data.choices[0].finish_reason}).`
    )
  }
  return content
}

export async function extractJobInfoHelper(jobDescription: string): Promise<{
  company: string
  role: string
  email: string
}> {
  const apiKey = process.env.GLM_API_KEY!

  const result = await callGLM(
    `You are extracting structured information from a job posting.

JOB POSTING:
${jobDescription.slice(0, 4000)}

Extract the following fields from the job posting:
- "company": the company name
- "role": the job title / role name
- "email": a contact or application email address (if present)

Return ONLY a JSON object like:
{"company": "Stripe", "role": "Senior Frontend Engineer", "email": "jobs@stripe.com"}

Rules:
- If you cannot find the company name, set it to ""
- If you cannot find the role title, set it to ""
- If no email is mentioned, set email to ""
- Return ONLY the JSON object, no markdown, no explanation`,
    apiKey,
  )

  try {
    const cleaned = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { company: "", role: "", email: "" }

    const raw = JSON.parse(jsonMatch[0])
    return {
      company: String(raw.company || ""),
      role: String(raw.role || raw.title || raw.position || ""),
      email: String(raw.email || raw.contact_email || ""),
    }
  } catch {
    return { company: "", role: "", email: "" }
  }
}

export async function generateCoverLetterHelper(
  ctx: ActionCtx,
  jobDescription: string,
  company: string,
  role: string,
  userId: string,
): Promise<string> {
  const apiKey = process.env.GLM_API_KEY!

  const profile = await ctx.runQuery(internal.resumeProfiles.getByUserInternal, {
    userId,
  })
  if (!profile) {
    throw new Error("No resume profile found. Upload your CV first.")
  }

  // Extract candidate name from profile rawText (first line is usually the name)
  const candidateName = profile.rawText.split("\n")[0]?.trim() || "The Candidate"

  const prompt = `You are writing a job application cover letter on behalf of a candidate.

CANDIDATE PROFILE:
Name: ${candidateName}
Skills: ${profile.skills.join(", ")}
Experience: ${JSON.stringify(profile.experience)}
Writing tone: ${profile.tone}
Resume summary: ${profile.rawText}

COMPANY: ${company}
ROLE: ${role}

JOB DESCRIPTION:
${jobDescription}

Write a concise, personalised cover letter that:
1. Starts with a greeting like "Dear Hiring Manager," or "Dear ${company} Team,"
2. Uses the exact company name "${company}" and role title "${role}" — NEVER use placeholders like [Company Name]
3. Matches the company tone from the job description
4. Highlights 2-3 skills that directly match the job requirements
5. References specific details from the posting
6. Sounds like a real person, not a template
7. Is 3 short paragraphs max
8. Ends with a professional sign-off like "Best regards," followed by ONLY the candidate's name "${candidateName}" on the next line — do NOT add a title, phone number, email, or any other information after the name

IMPORTANT: Return ONLY plain text. Do NOT use any markdown formatting — no bold (**), no italics (*), no headers (#), no bullet points. Just normal sentences and paragraphs separated by blank lines.`

  return await callGLM(prompt, apiKey)
}

// Convex action wrappers (for scheduling / calling from other contexts)

export const extractJobInfo = internalAction({
  args: { jobDescription: v.string() },
  handler: async (_ctx, { jobDescription }) => {
    return await extractJobInfoHelper(jobDescription)
  },
})

export const generateCoverLetter = internalAction({
  args: {
    jobDescription: v.string(),
    company: v.string(),
    role: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { jobDescription, company, role, userId }) => {
    return await generateCoverLetterHelper(ctx, jobDescription, company, role, userId)
  },
})
