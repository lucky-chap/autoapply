import { tool } from "ai";
import { z } from "zod";
import { convex, api, getAuthenticatedUser } from "./_context";
import { withGmailRead } from "../auth0-ai";
import { listGmailMessages, getGmailMessage } from "../gmail";
import { callVertex } from "../vertex";

const parameters = z.object({});

// Helper to extract text body from Gmail message
function extractBody(payload: any): string {
  if (payload.parts) {
    const textPart = payload.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64").toString("utf-8");
    }
  }
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  return "";
}

export const checkInboxTool = withGmailRead(
  tool({
    description: "Check Gmail for replies to job applications and update their statuses.",
    parameters: parameters as any,
    execute: async ({}: any, { credentials }: { credentials: { accessToken: string } }) => {
      const user = await getAuthenticatedUser();
      const accessToken = credentials.accessToken;

      const applications = await convex.query(api.applications.getByUser, { userId: user.sub });
      const activeApps = applications.filter(app => 
        ["Applied", "Replied", "Interview"].includes(app.status)
      );

      const results: {
        company: string;
        oldStatus: "Applied" | "Replied" | "Interview" | "Offer" | "Rejected";
        newStatus: "Applied" | "Replied" | "Interview" | "Offer" | "Rejected";
        summary: string;
      }[] = [];

      for (const app of activeApps) {
        const query = app.gmailThreadId 
          ? `thread:${app.gmailThreadId}` 
          : `from:${app.recipientEmail}`;
        
        const list = await listGmailMessages(accessToken, query, 5);
        if (!list.messages || list.messages.length === 0) continue;

        // Find the latest message that is NOT from the user
        let latestRecruiterMsg = null;
        const userEmail = user.email?.toLowerCase() || "";
        
        for (const m of list.messages) {
          const msg = await getGmailMessage(accessToken, m.id);
          const fromHeader = msg.payload?.headers?.find((h: any) => h.name.toLowerCase() === "from");
          const fromValue = fromHeader?.value?.toLowerCase() || "";
          
          if (userEmail && !fromValue.includes(userEmail)) {
            latestRecruiterMsg = msg;
            break; // Found the newest reply from not-me
          }
        }

        if (!latestRecruiterMsg || latestRecruiterMsg.id === app.lastCheckedGmailMsgId) continue;

        const body = extractBody(latestRecruiterMsg.payload);
        if (!body) continue;

        const classifyPrompt = `
          Classify this email reply for a job application for "${app.role}" at "${app.company}":
          
          "${body}"

          Return a JSON object:
          {
            "status": "Replied" | "Interview" | "Offer" | "Rejected",
            "summary": "Short 1-sentence summary",
            "schedulingLink": "URL if found, else null"
          }
        `;

        const classificationRaw = await callVertex(classifyPrompt);
        try {
          const jsonMatch = classificationRaw.match(/\{[\s\S]*\}/);
          const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
          
          if (parsed.status && parsed.status !== app.status) {
            await convex.mutation(api.applications.updateStatus, {
              id: app._id,
              status: parsed.status,
            });
            
            results.push({
              company: app.company,
              oldStatus: app.status,
              newStatus: parsed.status,
              summary: parsed.summary
            });
          }
        } catch (e) {
          console.error("Classification failed for", app.company, e);
        }
      }

      return {
        checkedCount: activeApps.length,
        updates: results,
      };
    },
  } as any)
);
