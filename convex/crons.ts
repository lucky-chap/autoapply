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

crons.interval(
  "cleanup stale chat state older than 6 hours",
  { hours: 1 },
  internal.chatCleanup.cleanupStaleChatState,
  {}
)

crons.interval(
  "send follow-up emails for stale applications",
  { hours: 12 },
  internal.followUp.checkAndSendFollowUps,
  {}
)

export default crons
