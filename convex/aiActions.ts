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
  salary: number | null
  multipleDetected: boolean
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
- "salary": the annual salary as a number in USD (if a range is given, use the midpoint; if hourly, multiply by 2080; if monthly, multiply by 12). null if no salary is mentioned.
- "multipleJobs": true if the text contains more than one distinct job posting (e.g. multiple different companies, multiple unrelated roles at different companies, or clearly separate job listings). false if it's a single job posting (even if lengthy).

Return ONLY a JSON object like:
{"company": "Stripe", "role": "Senior Frontend Engineer", "email": "jobs@stripe.com", "salary": 180000, "multipleJobs": false}

Rules:
- If you cannot find the company name, set it to ""
- If you cannot find the role title, set it to ""
- If no email is mentioned, set email to ""
- If no salary/compensation is mentioned, set salary to null
- Return ONLY the JSON object, no markdown, no explanation`,
    apiKey,
  )

  try {
    const cleaned = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { company: "", role: "", email: "", salary: null, multipleDetected: false }

    const raw = JSON.parse(jsonMatch[0])
    return {
      company: String(raw.company || ""),
      role: String(raw.role || raw.title || raw.position || ""),
      email: String(raw.email || raw.contact_email || ""),
      salary: typeof raw.salary === "number" ? raw.salary : null,
      multipleDetected: raw.multipleJobs === true,
    }
  } catch {
    return { company: "", role: "", email: "", salary: null, multipleDetected: false }
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

  const prefs = await ctx.runQuery(internal.preferences.getByUserInternal, {
    userId,
  })

  // Extract candidate name from profile rawText (first line is usually the name)
  const candidateName = profile.rawText.split("\n")[0]?.trim() || "The Candidate"

  const prefsSection = [
    prefs?.targetRoles?.length ? `Target roles: ${prefs.targetRoles.join(", ")}` : "",
    prefs?.targetLocations?.length ? `Preferred locations: ${prefs.targetLocations.join(", ")}` : "",
  ].filter(Boolean).join("\n")

  const prompt = `You are writing a job application cover letter on behalf of a candidate.

CANDIDATE PROFILE:
Name: ${candidateName}
Skills: ${profile.skills.join(", ")}
Experience: ${JSON.stringify(profile.experience)}
Writing tone: ${profile.tone}
Resume summary: ${profile.rawText}
${prefsSection ? `\nCANDIDATE PREFERENCES:\n${prefsSection}` : ""}

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
8. Ends with EXACTLY these two lines and NOTHING else after them:
Best regards,
${candidateName}

CRITICAL: The letter MUST end immediately after the candidate's name "${candidateName}". Do NOT add any bio, summary, description, title, phone number, email, LinkedIn, or ANY other text after the name. The very last line of your output must be "${candidateName}" with nothing following it.

IMPORTANT: Return ONLY plain text. Do NOT use any markdown formatting — no bold (**), no italics (*), no headers (#), no bullet points. Just normal sentences and paragraphs separated by blank lines.`

  const raw = await callGLM(prompt, apiKey)

  // Trim anything after the candidate's name in the sign-off
  const nameIndex = raw.lastIndexOf(candidateName)
  if (nameIndex !== -1) {
    return raw.slice(0, nameIndex + candidateName.length).trimEnd()
  }
  return raw
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
