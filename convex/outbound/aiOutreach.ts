"use node"

import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"
import { v } from "convex/values"
import { callGemini } from "../aiActions"

/**
 * Generate a personalized outreach email for a HubSpot contact.
 * Step 0 = cold outreach, Step 1+ = follow-ups with new angles.
 */
export const generateOutreachEmail = internalAction({
  args: {
    contactId: v.id("hubspotContacts"),
    userId: v.string(),
    step: v.number(),
    previousSubject: v.optional(v.string()),
    previousBody: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ subject: string; body: string }> => {
    const contact = await ctx.runQuery(
      internal.outbound.store.getContactById,
      { id: args.contactId }
    )
    if (!contact) throw new Error(`Contact ${args.contactId} not found`)

    // Get sender context from resume profile
    const profile = await ctx.runQuery(
      internal.resumeProfiles.getByUserInternal,
      { userId: args.userId }
    )

    const senderName = profile?.rawText?.split("\n")[0]?.trim() ?? "there"
    const senderSkills = profile?.skills?.slice(0, 5).join(", ") ?? ""
    const senderExperience = profile?.experience
      ?.map((e) => `${e.title} at ${e.company}`)
      .slice(0, 3)
      .join("; ") ?? ""

    const contactName = `${contact.firstName} ${contact.lastName}`.trim()
    const contactCompany = contact.company ?? "their company"
    const contactTitle = contact.jobTitle ?? ""

    const apiKey = process.env.GEMINI_API_KEY!

    let prompt: string

    if (args.step === 0) {
      // Cold outreach
      prompt = `Write a short, personalized B2B outreach email.

SENDER CONTEXT:
- Name: ${senderName}
- Skills: ${senderSkills}
- Experience: ${senderExperience}

RECIPIENT:
- Name: ${contactName}
- Company: ${contactCompany}
- Title: ${contactTitle}

REQUIREMENTS:
1. Subject line: Short, specific, no spam words. Reference their company or role.
2. Body: 3-5 sentences MAX. Lead with value, not a pitch.
3. Reference something specific about their company or role.
4. End with a clear, low-commitment CTA (e.g., "Worth a quick chat?").
5. Sign off with sender name only.
6. Tone: Professional but human. No buzzwords.

OUTPUT FORMAT (plain text):
Subject: [subject line]

[email body]`
    } else {
      // Follow-up
      prompt = `Write a brief follow-up email for a B2B outreach sequence.

SENDER: ${senderName}
RECIPIENT: ${contactName} at ${contactCompany}
PREVIOUS EMAIL SUBJECT: ${args.previousSubject ?? "N/A"}
FOLLOW-UP NUMBER: ${args.step}

REQUIREMENTS:
1. Subject line: "Re: ${args.previousSubject ?? "our conversation"}" or a fresh angle.
2. Body: 2-3 sentences MAX. Add a NEW angle or value prop — don't just repeat.
3. Reference the previous email briefly.
4. End with a softer CTA than the first email.
5. Sign off with sender name only.
6. Tone: Friendly, not pushy.

OUTPUT FORMAT (plain text):
Subject: [subject line]

[email body]`
    }

    const result = await callGemini(prompt, apiKey, 1000)

    // Parse subject and body from the response
    const lines = result.trim().split("\n")
    let subject = ""
    const bodyLines: string[] = []
    let pastSubject = false

    for (const line of lines) {
      if (!pastSubject && line.toLowerCase().startsWith("subject:")) {
        subject = line.replace(/^subject:\s*/i, "").trim()
        pastSubject = true
      } else if (pastSubject) {
        bodyLines.push(line)
      }
    }

    // Trim leading blank lines from body
    while (bodyLines.length > 0 && bodyLines[0].trim() === "") {
      bodyLines.shift()
    }

    const body = bodyLines.join("\n").trim()

    if (!subject) {
      subject = `Connecting with ${contactName} at ${contactCompany}`
    }
    if (!body) {
      throw new Error("AI generated empty email body")
    }

    return { subject, body }
  },
})
