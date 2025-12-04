# ⚠️ Important: Add Redirect URI to Google Console

Your Google OAuth credentials have been configured, but you need to add the redirect URI to your Google Cloud Console.

## Current Redirect URIs in Your Google Console:
- `http://localhost:3000/oauth2callback`
- `http://localhost:3000/api/auth/google/callback`

## Required Redirect URI for This App:
**You need to add this redirect URI:**

```
http://localhost:5000/api/youtube/auth-callback
```

## How to Add:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: **APIs & Services** → **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorised redirect URIs**, click **"+ Add URI"**
5. Add: `http://localhost:5000/api/youtube/auth-callback`
6. Click **Save**

**Note:** It may take 5 minutes to a few hours for the settings to take effect, but usually it's immediate.

## After Adding:

Once you've added the redirect URI, you can:
1. Open the app at `http://localhost:3000`
2. Create a project
3. Link your YouTube account
4. Start generating videos!

