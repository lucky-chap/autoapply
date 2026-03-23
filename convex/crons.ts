import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

crons.interval(
  "check inboxes for replies",
  { minutes: 5 },
  internal.inboxChecker.checkAllInboxes,
  {}
)

crons.interval(
  "cleanup expired linking codes and stale pending actions",
  { hours: 1 },
  internal.telegramLinks.cleanup,
  {}
)

crons.interval(
  "cleanup stale pending actions",
  { hours: 1 },
  internal.pendingActions.cleanupStale,
  {}
)

export default crons
