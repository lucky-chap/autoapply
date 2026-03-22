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

10. **Publish Google OAuth App**:
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
```

### Convex Environment Variables

These are set in the Convex dashboard or via `npx convex env set`:

```env
AUTH0_DOMAIN=<your-tenant>.us.auth0.com
AUTH0_M2M_CLIENT_ID=<m2m-client-id>
AUTH0_M2M_CLIENT_SECRET=<m2m-client-secret>
GLM_API_KEY=<your-glm-api-key>
```

**How to get these:**

- **`GLM_API_KEY`** — Sign up at [open.bigmodel.cn](https://open.bigmodel.cn/) and create an API key from the dashboard.
- **`AUTH0_M2M_CLIENT_ID` / `AUTH0_M2M_CLIENT_SECRET`** — Create or use an existing Machine-to-Machine application in Auth0:
  1. Go to Auth0 Dashboard → Applications → **Create Application** → select **Machine to Machine** (or use the existing **API Explorer Application**)
  2. Copy the **Client ID** and **Client Secret** from the application's **Settings** page
  3. Go to Auth0 Dashboard → Applications → APIs → **Auth0 Management API** → **Application Access** tab
  4. Find your M2M app, expand it, and ensure the `read:users` and `read:user_idp_tokens` scopes are checked
  5. Click **Update** if you made changes

  This M2M app is used by the automated cron job to fetch Gmail tokens for each user without requiring an active browser session.

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
