import { tool } from "ai";
import { z } from "zod";
import { convex, api, getAuthenticatedUser } from "./_context";
import { withGmailSend } from "../auth0-ai";
import { encodeEmail, sendGmailMessage } from "../gmail";

const parameters = z.object({
  company: z.string(),
  role: z.string(),
  recipientEmail: z.string(),
  coverLetter: z.string(),
  subject: z.string().optional(),
});

export const sendApplicationTool = withGmailSend(
  tool({
    description: "Send a job application email to a recruiter.",
    parameters: parameters as any,
    execute: async ({ company, role, recipientEmail, coverLetter, subject }: any, { credentials }: { credentials: { accessToken: string } }) => {
      const user = await getAuthenticatedUser();
      const accessToken = credentials.accessToken;

      const emailSubject = subject || `Application for ${role} at ${company}`;

      const applicationId = await convex.mutation(api.applications.create, {
        userId: user.sub,
        company,
        role,
        coverLetter,
        recipientEmail,
      });

      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      const trackingPixelUrl = siteUrl
        ? `${siteUrl}/track/open?id=${applicationId}`
        : undefined;

      const from = user.name && user.email
        ? { name: user.name as string, email: user.email as string }
        : undefined;

      // Fetch profile links for the email footer
      const resume = await convex.query(api.resumeProfiles.getByUser, { userId: user.sub });
      const profileLinks = resume ? {
        githubUrl: resume.githubUrl,
        linkedinUrl: resume.linkedinUrl,
        portfolioUrl: resume.portfolioUrl,
      } : undefined;

      const encoded = encodeEmail({
        to: recipientEmail,
        subject: emailSubject,
        body: coverLetter,
        from,
        trackingPixelUrl,
        applicationId: applicationId as string,
        trackBaseUrl: siteUrl,
        profileLinks,
      });

      let gmailResult: { id: string; threadId: string };
      try {
        gmailResult = await sendGmailMessage(accessToken, encoded);
      } catch (err) {
        try {
          await convex.mutation(api.applications.deleteById, { id: applicationId });
        } catch {
          // Best effort cleanup
        }
        throw new Error(`Gmail send failed: ${String(err)}`);
      }

      if (gmailResult.threadId) {
        try {
          await convex.mutation(api.applications.setThreadId, {
            id: applicationId,
            gmailThreadId: gmailResult.threadId,
          });
        } catch {
          // Non-critical
        }
      }

      return {
        success: true,
        applicationId,
        message: `Application sent to ${company} for ${role}.`,
      };
    },
  } as any)
);
