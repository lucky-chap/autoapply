import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "check inboxes for replies",
  { minutes: 15 },
  internal.inboxChecker.checkAllInboxes,
  {}
)

export default crons
