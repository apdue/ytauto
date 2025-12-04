# Quick Start Guide

Get up and running in 5 minutes!

## Step 1: Install Prerequisites

```bash
# Install FFmpeg (if not already installed)
brew install ffmpeg

# Verify Node.js is installed (v16+)
node -v
```

## Step 2: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **YouTube Data API v3**:
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: **Web application**
   - Name: "Auto Video Create"
   - **Authorized redirect URIs**: `http://localhost:5000/api/youtube/auth-callback`
   - Click "Create"
   - Copy the **Client ID** and **Client Secret**

5. Configure OAuth Consent Screen:
   - Go to "APIs & Services" → "OAuth consent screen"
   - User Type: **External** (for personal use)
   - App name: "Auto Video Create"
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Scopes: Add `https://www.googleapis.com/auth/youtube.upload`
   - Test users: Add your Google account
   - Click "Save and Continue"

## Step 3: Install and Configure

```bash
# Run setup script
./setup.sh

# Edit .env file with your credentials
nano .env
```

Add your credentials:
```env
GOOGLE_CLIENT_ID=paste_your_client_id_here
GOOGLE_CLIENT_SECRET=paste_your_client_secret_here
REDIRECT_URI=http://localhost:5000/api/youtube/auth-callback
```

## Step 4: Prepare Your Folders

Create folders for your media:
```bash
mkdir -p ~/Videos/clips
mkdir -p ~/Music/audio
mkdir -p ~/Pictures/thumbnails
```

Add your files:
- **Clips folder**: Video files (.mp4, .mov, .avi, .mkv)
- **Audio folder**: Audio files (.mp3, .wav, .m4a, .aac)
- **Thumbnails folder**: Image files (.jpg, .png, .webp)

## Step 5: Start the Application

**Terminal 1 - Backend:**
```bash
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The dashboard will open at `http://localhost:3000`

## Step 6: Create Your First Project

1. Click "Create New Project"
2. Fill in the form:
   - **Project Name**: "My First Project"
   - **Clips Folder**: `/Users/yourname/Videos/clips` (use full path)
   - **Audio Folder**: `/Users/yourname/Music/audio`
   - **Thumbnails Folder**: `/Users/yourname/Pictures/thumbnails`
   - **Title Template**: "Amazing Clip #{{number}}"
   - **Videos Per Day**: 1
   - **Upload Time**: 14:00
   - **Start Date**: Today's date
   - **End Date**: A week from now
3. Click "Create Project"

## Step 7: Link YouTube Account

1. Go to your project details page
2. Click "Link YouTube Account"
3. Authorize the app in the popup
4. Select your YouTube channel
5. Click "Allow"
6. The window will close automatically when done

## Step 8: Test Video Generation

1. In project details, click "Generate Video Now"
2. Watch the queue status update
3. Check the "Videos" tab to see your uploaded video
4. Check the "Logs" tab for any errors

## Step 9: Automatic Daily Generation

The system automatically:
- Checks all active projects daily at 1 AM
- Generates the required number of videos
- Uploads and schedules them to YouTube

You can check the dashboard anytime to see progress!

## Troubleshooting

### "FFmpeg not found"
```bash
brew install ffmpeg
```

### "YouTube OAuth error"
- Make sure redirect URI matches exactly
- Check that YouTube Data API v3 is enabled
- Verify OAuth consent screen is configured

### "No clips or audio files available"
- Check folder paths are correct (use full absolute paths)
- Verify files exist in the folders
- Check file extensions are supported

### Videos not uploading
- Check YouTube API quota in Google Cloud Console
- Verify OAuth tokens are valid (re-link if needed)
- Check logs in the dashboard for specific errors

## Next Steps

- Create multiple projects for different channels
- Adjust video settings (fade, volume, etc.) in the code
- Monitor queue and logs in the dashboard
- Set up multiple videos per day for faster content creation

Happy automating! 🚀

