# AutoApply

AI-powered job application automation. Scans job boards, finds hiring managers, drafts personalized outreach, sends applications, and tracks your pipeline — all from a Telegram bot or web dashboard.

## Features

- **Job Sourcing** — Pulls listings from Hacker News "Who is Hiring" threads, Remotive, and Arbeitnow, then AI-scores them against your profile
- **Cover Letter Generation** — Vertex AI writes personalized cover letters based on your resume and the job description
- **Prospect Enrichment** — Finds hiring managers via Tomba.io, with pattern-based email fallback (careers@, jobs@, etc.)
- **Outreach Pipeline** — End-to-end: find prospects, generate emails, queue for approval, send via Gmail
- **Email Tracking** — Pixel-based open tracking and link click tracking per application
- **Reply Classification** — AI detects interview invites, rejections, and follow-up needs from inbox replies
- **Interview Scheduling** — Detects proposed times, checks Google Calendar conflicts, suggests free slots or confirms
- **Auto Follow-up** — Sends follow-up emails after 5 days of silence
- **Telegram Bot** — Full control via `/job`, `/link`, `/status`, `/salary`, `/links`, and more
- **Web Dashboard** — Application tracker, outreach stats, resume management, and preferences
- **Step-Up Auth** — Sensitive actions (sending emails) require Auth0 login confirmation, even from Telegram

## Architecture

- **Frontend**: Next.js 16 (App Router)
- **Backend**: Convex (real-time database, serverless functions, cron jobs)
- **AI**: Vertex AI (Gemini) via proxy for cover letters, job extraction, reply classification, and matching
- **Auth**: Auth0 with Token Vault for background Gmail/Calendar access without active sessions
- **Token Security**: Auth0 refresh tokens encrypted with AES-256-GCM, stored in Convex

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- A Convex project
- Auth0 tenant (Regular Web Application)
- Google Cloud project with Vertex AI enabled
- Telegram bot (via @BotFather)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Auth0
AUTH0_SECRET=<random-32-byte-hex>
APP_BASE_URL=http://localhost:3000
AUTH0_DOMAIN=<your-tenant>.us.auth0.com
AUTH0_CLIENT_ID=<client-id>
AUTH0_CLIENT_SECRET=<client-secret>
AUTH0_M2M_CLIENT_ID=<m2m-client-id>
AUTH0_M2M_CLIENT_SECRET=<m2m-client-secret>

# Convex
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
NEXT_PUBLIC_CONVEX_SITE_URL=<your-convex-site-url>

# Telegram
TELEGRAM_BOT_TOKEN=<bot-token>
TELEGRAM_BOT_USERNAME=<bot-username>
TELEGRAM_WEBHOOK_SECRET=<random-hex>

# Enrichment (optional — Tomba.io free tier: 25 searches/month)
TOMBA_API_KEY=<key>
TOMBA_SECRET=<secret>

# Security
ENCRYPTION_SECRET=<random-32-byte-hex>
CONVEX_API_SECRET=<random-hex>
```

Set the same Auth0, Telegram, and encryption variables in Convex:

```bash
npx convex env set AUTH0_DOMAIN <value>
npx convex env set TELEGRAM_BOT_TOKEN <value>
# ... etc
```

### 3. Auth0 configuration

1. Application type: **Regular Web Application**
2. Allowed Callback URLs: `http://localhost:3000/auth/callback`
3. Grant Types: `authorization_code`, `refresh_token`
4. Google Social Connection with scopes: `gmail.send`, `gmail.readonly`, `calendar`
5. Run the setup script to configure Token Vault:

```bash
npm run setup
```

### 4. Telegram bot

```bash
npm run setup:telegram
```

### 5. Run

```bash
npx convex dev    # Terminal 1
pnpm dev          # Terminal 2
```

## Telegram Commands

| Command | Description |
|---------|-------------|
| `/start` | Link account or get started |
| `/job` | Enter job description mode |
| `/link` | Link Telegram to your web account |
| `/unlink` | Remove Telegram link |
| `/salary` | Set minimum salary filter |
| `/links` | Manage profile links (GitHub, LinkedIn, etc.) |
| `/status` | View recent application stats |
| `/clear` | Reset current input state |

## License

MIT
