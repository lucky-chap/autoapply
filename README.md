# AutoApply

AI-powered job application automation. Upload your resume, paste a job description, and AutoApply generates a personalized cover letter and sends it via your Gmail — from the web dashboard or a Telegram bot.

## Quick Start

```bash
pnpm install
npm run setup              # Configure Auth0 MRRT policies
npm run setup:telegram     # Register Telegram bot webhook
npx convex dev             # Start Convex backend (terminal 1)
pnpm dev                   # Start Next.js frontend (terminal 2)
```

---

## Auth0 Setup

This project uses the Auth0 Token Vault and My Account API for secure connection management.

### Prerequisites

1. **Application Type**: Your Auth0 application must be a **Regular Web Application**.

2. **Allowed Callback URLs**: Add `http://localhost:3000/auth/callback` to your Allowed Callback URLs.

3. **Grant Types**: Under your application's Settings → Advanced Settings → Grant Types, ensure `authorization_code`, `refresh_token`, and `Token Vault` are enabled. Token Vault is required for exchanging refresh tokens for connected account access tokens.

4. **Refresh Tokens**: Under your application's Settings, scroll to Refresh Token Rotation and ensure it is toggled **OFF** (non-rotating). The Token Vault token exchange does not support rotating refresh tokens.

5. **Enable My Account API**:
   - Go to Auth0 Dashboard → Applications → APIs
   - Find the **My Account** API (audience: `https://<your-domain>/me/`)
   - Enable it if not already enabled

6. **Authorize Your App on the My Account API**:
   - Go to Auth0 Dashboard → Applications → APIs → **My Account** → **Application Access** tab
   - Find your application and ensure it is **Authorized**
   - Enable the `create:me:connected_accounts` scope — this is required for the connect account flow

7. **Authorize Your App on the Auth0 Management API** (required for the setup script):
   - Go to Auth0 Dashboard → Applications → APIs → **Auth0 Management API** → **Application Access** tab
   - Find your application and enable **all scopes** under both **Client Access** and **User Access**
   - This grants the setup script permission to configure MRRT policies on your application

8. **Google OAuth2 Social Connection**:
   - You must create your own Google OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — select "OAuth 2.0 Client ID" with application type "Web application"
   - Add `https://<your-auth0-domain>/login/callback` as an authorized redirect URI in Google
   - Go to Auth0 Dashboard → Authentication → Social → **Google / Gmail**
   - Enter your Google OAuth **Client ID** and **Client Secret**
   - Set the connection mode to **"Authentication and Connected Accounts for Token Vault"** — this enables both user login and Token Vault token management
   - Under "Permissions", add the Gmail scopes your app needs:
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`

9. **Enable Gmail API on Google Cloud**:
   - Go to [Google Cloud Console → Gmail API](https://console.developers.google.com/apis/api/gmail.googleapis.com/overview)
   - Select the same project used for your Google OAuth credentials
   - Click **"Enable"** to activate the Gmail API
   - This only needs to be done once — all users authenticate through your project

10. **Enable Refresh Token Rotation** (Recommended):
    - In your Auth0 App Settings, find the **Refresh Token Expiration** section:
        - Toggle **Set Idle Refresh Token Lifetime** to `Enabled` and set it to `1209600` (14 days).
        - Toggle **Set Maximum Refresh Token Lifetime** to `Enabled` and set it to `2592000` (30 days).
    - Find the **Refresh Token Rotation** section:
        - Toggle **Rotation** to `Enabled`.
        - Set **Rotation Overlap Period** to `60` seconds.
    - Our system in `convex/tokenVault.ts` handles this rotation automatically to ensure continuous background service.

11. **Publish Google OAuth App**:
   - Go to [Google Cloud Console → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent)
   - Click **"Publish App"** to allow any Google user to authorize
   - While in Testing mode, only manually-added test users can complete the Google consent flow
   - If requesting sensitive scopes (Gmail), Google may require a verification review — until verified, users will see an "unverified app" warning they can click through

### Environment Variables (`.env.local`)

```env
AUTH0_DOMAIN=https://<your-tenant>.us.auth0.com
AUTH0_CLIENT_ID=<your-client-id>
AUTH0_CLIENT_SECRET=<your-client-secret>
AUTH0_SECRET=<random-32-byte-secret>
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_URL=<your-convex-deployment-url>
GLM_API_KEY=<your-glm-api-key>
ENCRYPTION_SECRET=<random-32-character-string>
```

### Convex Environment Variables

These are set in the Convex dashboard or via `npx convex env set`:

```env
AUTH0_DOMAIN=<your-tenant>.us.auth0.com
AUTH0_CLIENT_ID=<your-web-app-client-id>
AUTH0_CLIENT_SECRET=<your-web-app-client-secret>
AUTH0_M2M_CLIENT_ID=<m2m-client-id>
AUTH0_M2M_CLIENT_SECRET=<m2m-client-secret>
GLM_API_KEY=<your-glm-api-key>
TELEGRAM_BOT_TOKEN=<bot-token-from-botfather>
TELEGRAM_WEBHOOK_SECRET=<random-hex-string>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_CONVEX_SITE_URL=<your-convex-site-url>
ENCRYPTION_SECRET=<random-32-character-string>
```

**How to get these:**

- **`AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET`** — These are the same credentials as in your `.env.local` (your Regular Web Application). The Convex backend uses them to exchange stored refresh tokens for fresh Google access tokens via Token Vault. Make sure the **Token Vault** grant type is enabled: Auth0 Dashboard → Applications → your app → **Advanced Settings → Grant Types → Token Vault** checkbox.
- **`GLM_API_KEY`** — Sign up at [open.bigmodel.cn](https://open.bigmodel.cn/) and create an API key from the dashboard.
- **`TELEGRAM_BOT_TOKEN`** — Open Telegram, message [@BotFather](https://t.me/BotFather), send `/newbot`, follow the prompts, and copy the token it gives you (looks like `123456789:ABCdefGhIjKlmNoPQRsTuVwXyZ`).
- **`TELEGRAM_WEBHOOK_SECRET`** — Any random string used to verify webhook requests from Telegram. Generate one with: `openssl rand -hex 32`
- **`NEXT_PUBLIC_SITE_URL`** — Your app's public URL (`http://localhost:3000` for dev, your production domain when deployed). Used in the Telegram linking flow.
- **`NEXT_PUBLIC_CONVEX_SITE_URL`** (**required**) — Your Convex deployment's HTTP Actions URL (e.g. `https://<your-slug>.convex.site`). Found in your Convex dashboard under Deployment Settings. **Must be set in both `.env.local` and as a Convex env var** — it's used for the email open tracking pixel and the Telegram webhook endpoint. Without this, email open tracking will not work.
- **`AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET`** — Create or use an existing Machine-to-Machine application in Auth0:
  1. Go to Auth0 Dashboard → Applications → **Create Application** → select **Machine to Machine** (or use the existing **API Explorer Application**)
  2. Copy the **Client ID** and **Client Secret** from the application's **Settings** page
  3. Go to Auth0 Dashboard → Applications → APIs → **Auth0 Management API** → **Application Access** tab
  4. Find your M2M app, expand it, and ensure the `read:users` and `read:user_idp_tokens` scopes are checked
  5. Click **Update** if you made changes

  This M2M app is used to look up user info (email/name) without requiring an active browser session.

### Automated Setup

After configuring your `.env` file and completing the prerequisites above, run:

```bash
npm run setup
```

This configures **Multi-Resource Refresh Token (MRRT)** policies on your Auth0 application via the Management API. MRRT is required for the connect account flow — it allows the refresh token issued at login to be exchanged for an access token with the My Account API audience (`https://<your-domain>/me/`).

The script is idempotent and safe to run multiple times. After running it, **log out and log back in** to get a fresh session.

### Troubleshooting

- **"Unknown or invalid refresh token"**: MRRT is not configured. Run `npm run setup` to fix, then log out and log back in.
- **"Failed to retrieve a connected account access token"**: Your app is not authorized on the My Account API, or the `create:me:connected_accounts` scope is not enabled. See step 6 above.
- **"An unexpected error occurred while trying to initiate the connect account flow"**: The My Account API may not be enabled, or the connect account ticket creation failed. See step 5 above.
- **"Grant type 'urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token' not allowed"**: The Token Vault grant type is not enabled. See step 3 above.
- **After changing Auth0 config**: Always log out and log back in to get a fresh session with the updated token set.

---

## Telegram Bot Setup

The Telegram bot is a **single shared bot** for the entire platform — you set it up once during deployment. Individual users link their Telegram account from within the bot.

### 1. Create the bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts to name your bot
3. Copy the **bot token** (looks like `123456789:ABCdefGhIjKlmNoPQRsTuVwXyZ`)

### 2. Set Convex environment variables

```bash
# The bot token from BotFather
npx convex env set TELEGRAM_BOT_TOKEN <your-bot-token>

# A random secret to verify webhook requests (generate one below)
npx convex env set TELEGRAM_WEBHOOK_SECRET $(openssl rand -hex 32)

# Your app's public URL (for linking flow)
npx convex env set NEXT_PUBLIC_SITE_URL http://localhost:3000
```

### 3. Register the webhook

```bash
npm run setup:telegram
```

This calls the Telegram API to point your bot's webhook at your Convex HTTP endpoint (`/telegram/webhook`). The script reads `CONVEX_URL` from `.env.local` and derives the site URL automatically.

### How users connect

1. User opens the bot on Telegram and types `/link`
2. Bot sends a temporary link (expires in 15 minutes)
3. User clicks the link and authenticates on the web app
4. Their Telegram chat is now linked to their AutoApply account
5. They can send job descriptions directly to the bot to apply

### Troubleshooting

- **Bot not responding**: Make sure `npx convex dev` is running and the webhook is registered (`npm run setup:telegram`)
- **"Please link your account first"**: User needs to run `/link` in the bot and complete web authentication
- **Webhook registration fails**: Verify `TELEGRAM_BOT_TOKEN` is correct and `CONVEX_URL` is set in `.env.local`

---

## Token Vault Setup

Token Vault lets the Convex backend get **fresh Google access tokens** for any user without requiring an active browser session. This is used by:

- The **Telegram bot** when sending emails on behalf of users
- The **cron inbox checker** that monitors for recruiter replies

Without this, Google access tokens expire after ~1 hour and background operations fail with `401 UNAUTHENTICATED`.

### How it works

1. When a user interacts with the web app (sends an application or links Telegram), their Auth0 **refresh token** is stored in Convex
2. When the backend needs a Google token, it exchanges that refresh token at Auth0's `/oauth/token` endpoint using the Token Vault grant type
3. Auth0 uses its stored Google credentials to return a **fresh** Google access token
4. The backend uses the fresh token to call the Gmail API

### Setup

1. **Enable the Token Vault grant type** on your Auth0 application:
   - Go to Auth0 Dashboard → Applications → your Regular Web Application
   - Go to **Advanced Settings → Grant Types**
   - Check **Token Vault** (in addition to Authorization Code and Refresh Token)
   - Click **Save Changes**

2. **Disable refresh token rotation** (required for Token Vault refresh token exchange):
   - In the same application settings, go to **Refresh Token Rotation**
   - Set it to **Disabled** (or ensure it's not enabled)

3. **Set the Convex env vars** (same values as in `.env.local`):
   ```bash
   npx convex env set AUTH0_CLIENT_ID <your-client-id>
   npx convex env set AUTH0_CLIENT_SECRET <your-client-secret>
   ```

4. **Log out and log back in** to get a fresh session with a refresh token

### Troubleshooting

- **"No refresh token stored for this user"**: The user needs to use the web app at least once (send an application or link Telegram) so the app can capture their Auth0 refresh token.
- **"Token Vault exchange failed (400)"**: The Token Vault grant type may not be enabled on your Auth0 app. Check Advanced Settings → Grant Types → Token Vault.
- **"Token Vault exchange failed (403)"**: The user hasn't connected their Google account via the Permissions page yet. They need to connect Google first.
- **"Unknown or invalid refresh token"**: The stored refresh token may have expired or been revoked. The user needs to log out and log back in, then perform any action on the web app to refresh the stored token.

---

## Architecture Decisions & Security

### Storing Auth0 Refresh Tokens (Encrypted)

Unlike standard web applications that only perform actions during an active user session, AutoApply features **autonomous background agents**:

1. **Telegram Bot**: Users can apply to jobs directly from Telegram. The bot runs as a Convex Action, far removed from the user's Auth0 browser session.
2. **Inbox Monitor (Cron)**: A background job checks for recruiter replies every 5 minutes.

To allow these background processes to act on a user's behalf (via Auth0 Token Vault), the backend must have a way to identify itself to Auth0. We store a **Master Key** (the long-lived Auth0 Refresh Token) in the Convex database to bridge this gap.

**Why not just use Auth0 + Convex Session Auth?**
Even if Convex is configured to recognize your Auth0 `ID Token` natively, that token is short-lived (usually 1 hour). More importantly, it is only available when a user is actively sending a request from their browser. Processes like **Telegram Webhooks** and **Background Crons** do not have access to your browser's Auth0 session.

**Why not "No Storage" (Option 2)?**
Removing storage entirely would mean the Telegram bot and Cron jobs could never obtain a fresh Google Access Token once the initial ephemeral login session expired. This would transform AutoApply from an autonomous agent into a simple web-form.

### Defense in Depth
To mitigate the risk of storing these "Master Keys":
- **Encryption at Rest**: Every Auth0 Refresh Token is encrypted using **AES-256-GCM** before being saved to Convex.
- **Environment Isolation**: The decryption key (`ENCRYPTION_SECRET`) is never stored in the database; it only exists as a server-side environment variable.
- **Scope Limitation**: The tokens only grant the specific permissions (`gmail.send`, etc.) authorized by the user, not full account access.
- **Automatic Rotation Handling**: Many modern OAuth 2.0 implementations (including Auth0) use **Refresh Token Rotation**. Our system in `convex/tokenVault.ts` is designed to capture, re-encrypt, and save any new refresh tokens issued during a background exchange, ensuring continuous service without user intervention.
