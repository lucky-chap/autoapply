import { internalAction } from "../_generated/server"
import { internal } from "../_generated/api"

interface HubSpotContact {
  id: string
  properties: {
    email?: string
    firstname?: string
    lastname?: string
    company?: string
    jobtitle?: string
    lifecyclestage?: string
    hs_last_activity_date?: string
  }
}

interface HubSpotResponse {
  results: HubSpotContact[]
  paging?: { next?: { after: string } }
}

const HUBSPOT_API_BASE = "https://api.hubapi.com"
const PROPERTIES = [
  "email",
  "firstname",
  "lastname",
  "company",
  "jobtitle",
  "lifecyclestage",
  "hs_last_activity_date",
].join(",")

/**
 * Sync contacts from HubSpot CRM v3 into Convex.
 * Uses a private app token (env: HUBSPOT_ACCESS_TOKEN).
 * Paginates through contacts, capped at 500 for demo.
 */
export const fetchAndSyncContacts = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.HUBSPOT_ACCESS_TOKEN
    if (!token) {
      console.error("[hubspot] HUBSPOT_ACCESS_TOKEN not set, skipping sync")
      return
    }

    let after: string | undefined
    let totalSynced = 0
    const maxContacts = 500

    do {
      const url = new URL(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`)
      url.searchParams.set("properties", PROPERTIES)
      url.searchParams.set("limit", "100")
      if (after) url.searchParams.set("after", after)

      const resp = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!resp.ok) {
        const body = await resp.text()
        console.error(`[hubspot] API error ${resp.status}: ${body}`)
        break
      }

      const data: HubSpotResponse = await resp.json()

      for (const contact of data.results) {
        const email = contact.properties.email
        if (!email) continue // Skip contacts without email

        const lastActivityRaw = contact.properties.hs_last_activity_date
        const lastActivityDate = lastActivityRaw
          ? new Date(lastActivityRaw).getTime()
          : undefined

        await ctx.runMutation(internal.outbound.store.upsertContact, {
          hubspotId: contact.id,
          email,
          firstName: contact.properties.firstname ?? "",
          lastName: contact.properties.lastname ?? "",
          company: contact.properties.company,
          jobTitle: contact.properties.jobtitle,
          lifecycleStage: contact.properties.lifecyclestage,
          lastActivityDate:
            lastActivityDate && !isNaN(lastActivityDate)
              ? lastActivityDate
              : undefined,
        })

        totalSynced++
      }

      after = data.paging?.next?.after
    } while (after && totalSynced < maxContacts)

    console.log(`[hubspot] Synced ${totalSynced} contacts`)
  },
})
