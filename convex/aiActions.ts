"use node";
import { internalAction, ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { z } from "zod"
import { GoogleGenAI, Type } from "@google/genai"


/**
 * Helper to call Gemini API (generativelanguage.googleapis.com)
 */
async function callAI(
  prompt: string,
  apiKey: string,
  maxTokens = 4000,
  jsonMode = false,
  responseSchema?: any
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey })
  
  const config: any = {
    maxOutputTokens: maxTokens,
    temperature: 0.1,
  }

  if (jsonMode) {
    config.responseMimeType = "application/json"
    if (responseSchema) {
      config.responseSchema = responseSchema
    }
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config,
  })

  const content = response.text

  if (!content) {
    throw new Error(`Gemini returned empty content`)
  }

  return content
}


/**
 * Public wrapper for callAI (matches previous API)
 */
export async function callGemini(
  prompt: string,
  apiKey: string,
  maxTokens = 4000
): Promise<string> {
  return callAI(prompt, process.env.GEMINI_API_KEY!, maxTokens);
}

export async function extractJobInfoHelper(jobDescription: string): Promise<{
  company: string
  role: string
  email: string
  salary: number | null
  multipleDetected: boolean
}> {
  const apiKey = process.env.GEMINI_API_KEY!

  const prompt = `You are extracting structured information from a job posting.

JOB POSTING:
${jobDescription.slice(0, 4000)}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      company: { type: Type.STRING },
      role: { type: Type.STRING },
      email: { type: Type.STRING },
      salary: { type: Type.INTEGER, nullable: true },
      multipleJobs: { type: Type.BOOLEAN },
    },
  }

  try {
    const responseText = await callAI(prompt, apiKey, 2000, true, responseSchema);
    
    // Clean and parse
    const cleanJson = responseText
      .replace(/^```json\s*\n?/, "")
      .replace(/```\s*$/, "")
      .trim();

    let raw: any;
    try {
      raw = JSON.parse(cleanJson);
    } catch (err) {
      console.error("Gemini Extraction Parse Error. Raw response:", responseText);
      throw err;
    }

    // Validate with Zod
    const schema = z.object({
      company: z.string().default(""),
      role: z.string().default(""),
      email: z.string().default(""),
      salary: z.number().nullable().default(null),
      multipleJobs: z.boolean().default(false),
    });

    const validation = schema.safeParse(raw);
    if (!validation.success) {
       console.error("Gemination Extraction Schema Error:", validation.error.format());
       throw new Error("Invalid extraction format from AI");
    }

    const data = validation.data;

    return {
      company: data.company,
      role: data.role,
      email: data.email,
      salary: data.salary,
      multipleDetected: data.multipleJobs,
    };
  } catch (err) {

    console.error("Gemini Extraction Error:", err);
    return {
      company: "",
      role: "",
      email: "",
      salary: null,
      multipleDetected: false,
    };
  }
}

export async function generateCoverLetterHelper(
  ctx: ActionCtx,
  jobDescription: string,
  company: string,
  role: string,
  userId: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY!

  const profile = await ctx.runQuery(
    internal.resumeProfiles.getByUserInternal,
    {
      userId,
    }
  )
  if (!profile) {
    throw new Error("No resume profile found. Upload your CV first.")
  }

  const prefs = await ctx.runQuery(internal.preferences.getByUserInternal, {
    userId,
  })

  // Extract candidate name from profile rawText (first line is usually the name)
  const candidateName =
    profile.rawText.split("\n")[0]?.trim() || "The Candidate"

  const prefsSection = [
    prefs?.targetRoles?.length
      ? `Target roles: ${prefs.targetRoles.join(", ")}`
      : "",
    prefs?.targetLocations?.length
      ? `Preferred locations: ${prefs.targetLocations.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n")

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

  const raw = await callAI(prompt, apiKey, 2000)

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
    return await generateCoverLetterHelper(
      ctx,
      jobDescription,
      company,
      role,
      userId
    )
  },
})
