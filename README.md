# DevStandup AI

An AI action system where every operation is visible, explainable, and user-approved.

DevStandup AI turns developer GitHub activity into AI-proposed actions across Slack and Gmail. Users approve each action in an Action Queue with full credential transparency via Auth0 Token Vault.

## Stack

- **Next.js 15** — App Router + API Routes
- **Auth0 + Token Vault** — Scoped OAuth credentials per agent
- **Convex** — Real-time database for action queue + audit trail
- **Gemini 2.0 Flash** — AI via Vercel AI SDK
- **Tailwind CSS** — Dark developer-focused UI

## Getting Started

```bash
npm install
cp .env.example .env.local
# Fill in Auth0 and Convex credentials
npx convex dev   # Start Convex backend
npm run dev       # Start Next.js
```

## Architecture

- **One Agent = One Credential** — Each tool (GitHub, Slack, Gmail) uses isolated Auth0 Token Vault connections
- **Propose, Don't Execute** — AI proposes actions; users approve in the Action Queue
- **Step-Up Auth** — High-stakes actions (Gmail) require re-authentication
- **Explainability** — Every action shows confidence, reasoning, and required permissions
- **Undo Window** — 30-second undo after execution

## Hackathon

Built for the **Authorized to Act — Auth0 for AI Agents** hackathon.
