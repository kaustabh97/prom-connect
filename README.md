# Hello

## To run frontend and setup code

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev

```

## To run backend and setup AWS amplify Sandbox

https://aws.amazon.com/amplify/

npm install -g @aws-amplify/cli
npx amplify@latest init

npx amplifty 

npx amplify sandbox set GOOGLE_CLIENT_ID <Google_Client_ID>
npx amplify sandbox set GOOGLE_CLIENT_SECRET <Google_Client_Secret>

npx amplify sandbox (inside frontend package, amplify code is prom-connect/amplify/)

(Sets up backend sandbox etc)

## Setting Secrets for AWS Amplify Pipeline Deployments

When deploying via AWS Amplify Console (pipeline deployments), secrets must be set in the **Secrets** section (not Environment Variables):

1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app → **Hosting** → **Secrets**
3. Click **Manage secrets** button
4. Add the following secrets:
   - `GOOGLE_CLIENT_ID` = Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET` = Your Google OAuth Client Secret
5. Choose whether to apply to **all branches** or a **specific branch** (e.g., `main`)
6. Save and redeploy

**Important**: 
- Secrets are stored in AWS Systems Manager Parameter Store automatically
- Environment Variables ≠ Secrets - they serve different purposes
- These secrets are required for Google OAuth authentication. Without them, the deployment will fail with `SecretNotSetError`

## Google OAuth "invalid request" fix

If you see "You can't sign in because this app sent an invalid request" when signing in with Google:

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Click your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs**, add this **exact** URI (use the Cognito domain from your `amplify_outputs.json` → `auth.oauth.domain`):
   - `https://<YOUR_COGNITO_DOMAIN>.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`
   - Example: `https://f9338aec6e5fd2048b1c.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`
4. Under **Authorized JavaScript origins**, add:
   - `http://localhost:8080`
   - `http://localhost:8081`
   - `https://<YOUR_COGNITO_DOMAIN>.auth.ap-south-1.amazoncognito.com`
5. Save. Changes can take a few minutes to apply.

PRODUCTION URL FOR NOW: https://main.d1emd9gkgd3wf8.amplifyapp.com/

## "An error was encountered with the requested page" (Google OAuth)

If you see this after signing in with Google, Cognito’s allowed callback URLs are out of date.

1. **Sync the backend** so Cognito gets the URLs from `amplify/auth/resource.ts`:
   ```sh
   npx ampx sandbox
   ```
   Run this from the project root (where `amplify/` lives). It updates the Cognito app client with the callback URLs in `resource.ts` and regenerates `amplify_outputs.json`.

2. **Confirm the app URL**: The app must run at **http://localhost:8080** (see `vite.config.ts`). Sign-in is started from the root URL (`/`) so the redirect URI is `http://localhost:8080/`.

3. **Google Cloud Console**: Under **Authorized redirect URIs** you must have:
   `https://<YOUR_COGNITO_DOMAIN>.auth.<REGION>.amazoncognito.com/oauth2/idpresponse`
   (Use the `domain` value from `amplify_outputs.json` → `auth.oauth.domain`.)