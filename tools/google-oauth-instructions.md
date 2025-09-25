# Google OAuth Token Setup Instructions

Since the automated OAuth setup is having issues, here's how to get new tokens manually:

## Method 1: Google OAuth 2.0 Playground (Recommended)

1. **Go to OAuth Playground**: https://developers.google.com/oauthplayground/

2. **Configure Settings** (click gear icon):
   - Check "Use your own OAuth credentials"
   - OAuth Client ID: `610931361339-crj2epvio6m28id8klvth81tep2dilsi.apps.googleusercontent.com`
   - OAuth Client secret: (from your .env file)

3. **Select Scopes** (Step 1):
   - Add: `https://www.googleapis.com/auth/spreadsheets`
   - Add: `https://www.googleapis.com/auth/drive`
   - Click "Authorize APIs"

4. **Authorize** (Step 2):
   - Sign in with your Google account
   - Click "Exchange authorization code for tokens"

5. **Get Tokens** (Step 3):
   - Copy the "Access token"
   - Copy the "Refresh token"

6. **Update .env file**:
   ```
   GOOGLE_ACCESS_TOKEN=your_new_access_token_here
   GOOGLE_REFRESH_TOKEN=your_new_refresh_token_here
   ```

## Method 2: Manual OAuth Flow

If the playground doesn't work, visit this URL directly:

```
https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fspreadsheets%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&response_type=code&client_id=610931361339-crj2epvio6m28id8klvth81tep2dilsi.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback
```

After authorization, you'll get redirected to `http://localhost:3000/auth/callback?code=XXXXXX`

Copy the `code=` parameter and exchange it for tokens using a curl request.

## After Getting New Tokens

1. Update your `.env` file with the new tokens
2. Restart the automation system with `npm run dev`
3. The system should now be able to access your Google Sheets

## Test Connection

Run this to test if the new tokens work:
```bash
npm run test-sheets
```

The automation will immediately start processing any videos in your Google Sheet once the authentication is fixed.