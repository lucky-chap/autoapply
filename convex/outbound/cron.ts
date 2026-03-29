import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"

const FOLLOW_UP_DELAY_MS = 3 * 24 * 60 * 60 * 1000 // 3 days between steps
const DEFAULT_STEP_COUNT = 3 // initial + 2 follow-ups

/**
 * Main outbound cycle orchestrator.
 * 1. For each active user, create sequences for new contacts.
 * 2. Process due sequences: generate email → dispatch → advance.
 */
export const runOutboundCycle = internalAction({
  args: {},
  handler: async (ctx) => {
    const activeUsers = await ctx.runQuery(
      internal.sourcing.cron.getActiveUsers
    )
    if (activeUsers.length === 0) {
      console.log("[outbound] No active users, skipping cycle")
      return
    }

    for (const user of activeUsers) {
      const userId = user.userId

      try {
        // 1. Create sequences for contacts that don't have one yet
        const newContacts = await ctx.runQuery(
          internal.outbound.store.getContactsNeedingOutreach,
          { userId, limit: 10 }
        )

        for (const contact of newContacts) {
          await ctx.runMutation(internal.outbound.store.createSequence, {
            contactId: contact._id,
            userId,
            stepCount: DEFAULT_STEP_COUNT,
          })
          console.log(
            `[outbound] Created sequence for ${contact.firstName} ${contact.lastName} (${contact.email})`
          )
        }

        // 2. Process sequences that are due for sending
        const dueSequences = await ctx.runQuery(
          internal.outbound.store.getSequencesDueForSend,
          { userId }
        )

        for (const seq of dueSequences) {
          try {
            // Get contact info for AI prompt
            const contact = await ctx.runQuery(
              internal.outbound.store.getContactById,
              { id: seq.contactId }
            )
            if (!contact) {
              console.warn(`[outbound] Contact ${seq.contactId} not found, skipping`)
              continue
            }

            // Get previous message for follow-up context
            let previousSubject: string | undefined
            let previousBody: string | undefined
            if (seq.currentStep > 0) {
              const prevMessages = await ctx.runQuery(
                internal.outbound.store.getMessagesBySequence,
                { sequenceId: seq._id }
              )
              const lastMsg = prevMessages
                .filter((m) => m.step === seq.currentStep - 1)
                .pop()
              if (lastMsg) {
                previousSubject = lastMsg.subject
                previousBody = lastMsg.body
              }
            }

            // Generate email content
            const { subject, body } = await ctx.runAction(
              internal.outbound.aiOutreach.generateOutreachEmail,
              {
                contactId: seq.contactId,
                userId,
                step: seq.currentStep,
                previousSubject,
                previousBody,
              }
            )

            // Create message record
            const messageId = await ctx.runMutation(
              internal.outbound.store.createMessage,
              {
                sequenceId: seq._id,
                contactId: seq.contactId,
                userId,
                step: seq.currentStep,
                subject,
                body,
                status: "draft",
              }
            )

            // Dispatch via pendingActions pipeline
            await ctx.runAction(
              internal.outbound.sendOutreach.dispatchOutreachEmail,
              { outreachMessageId: messageId, userId }
            )

            // Advance sequence
            const nextStep = seq.currentStep + 1
            if (nextStep >= seq.stepCount) {
              // Sequence complete — all steps sent
              await ctx.runMutation(internal.outbound.store.updateSequence, {
                id: seq._id,
                status: "completed",
                currentStep: nextStep,
              })
            } else {
              // Schedule next step
              await ctx.runMutation(internal.outbound.store.updateSequence, {
                id: seq._id,
                currentStep: nextStep,
                nextSendAt: Date.now() + FOLLOW_UP_DELAY_MS,
              })
            }

            console.log(
              `[outbound] Step ${seq.currentStep} dispatched for ${contact.email}`
            )
          } catch (err) {
            console.error(
              `[outbound] Failed to process sequence ${seq._id}:`,
              err
            )
          }
        }
      } catch (err) {
        console.error(`[outbound] Cycle failed for ${userId}:`, err)
      }
    }

    console.log("[outbound] Cycle complete")
  },
})
