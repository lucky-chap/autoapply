import { auth0 } from "@/lib/auth0"
import { callGLM } from "@/lib/glm"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const session = await auth0.getSession()
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { jobDescription } = await req.json()

  if (!jobDescription?.trim()) {
    return NextResponse.json(
      { error: "Job description is required." },
      { status: 400 },
    )
  }

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
  )

  try {
    const cleaned = result
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ company: "", role: "", email: "" })
    }

    const raw = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      company: String(raw.company || ""),
      role: String(raw.role || raw.title || raw.position || ""),
      email: String(raw.email || raw.contact_email || ""),
    })
  } catch {
    return NextResponse.json({ company: "", role: "", email: "" })
  }
}
