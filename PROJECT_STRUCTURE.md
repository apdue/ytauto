# Project Structure

## Overview

This is a complete full-stack application for automated video generation and YouTube uploads.

## Directory Structure

```
Auto Video Create/
├── backend/                    # Node.js/Express backend
│   ├── database/
│   │   └── db.js              # SQLite database setup and schema
│   ├── routes/                 # API routes
│   │   ├── projects.js        # Project CRUD operations
│   │   ├── videos.js          # Video management
│   │   ├── youtube.js         # YouTube OAuth and upload
│   │   ├── logs.js            # Log viewing
│   │   └── queue.js           # Queue management
│   ├── services/              # Business logic
│   │   ├── videoGenerator.js  # FFmpeg video processing
│   │   ├── youtubeService.js  # YouTube API integration
│   │   ├── queueManager.js   # Video queue processing
│   │   └── scheduler.js       # Daily automation cron jobs
│   └── server.js              # Express server entry point
│
├── frontend/                   # React frontend
│   ├── public/
│   │   └── index.html         # HTML template
│   └── src/
│       ├── components/        # React components
│       │   ├── Dashboard.js   # Main dashboard
│       │   ├── CreateProject.js # Project creation form
│       │   └── ProjectDetail.js # Project details and management
│       ├── App.js             # Main app component
│       ├── App.css            # Global styles
│       ├── index.js           # React entry point
│       └── index.css          # Base styles
│
├── data/                       # Auto-generated (not in repo)
│   ├── database.db            # SQLite database
│   └── output/                # Generated video files
│
├── package.json                # Backend dependencies
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── setup.sh                   # Setup script
├── README.md                  # Full documentation
└── QUICKSTART.md              # Quick start guide
```

## Key Components

### Backend Services

1. **videoGenerator.js**
   - Merges video clips with audio using FFmpeg
   - Adds fade in/out effects
   - Normalizes to 1080p
   - Handles audio mixing

2. **youtubeService.js**
   - OAuth 2.0 authentication
   - Token refresh management
   - Video upload to YouTube
   - Thumbnail upload
   - Scheduling support

3. **queueManager.js**
   - Processes videos one at a time
   - Manages queue priority
   - Handles errors and retries
   - Coordinates video generation and upload

4. **scheduler.js**
   - Daily cron job (runs at 1 AM)
   - Checks all active projects
   - Generates required videos
   - Respects date ranges

### Frontend Components

1. **Dashboard.js**
   - Lists all projects
   - Shows queue statistics
   - Quick project management

2. **CreateProject.js**
   - Project creation form
   - Folder path validation
   - Settings configuration

3. **ProjectDetail.js**
   - Project overview with stats
   - Video list and management
   - Logs viewer
   - Settings editor
   - YouTube OAuth linking

## Database Schema

### Projects Table
- Project configuration
- YouTube channel info
- OAuth tokens
- Scheduling settings

### Videos Table
- Generated video records
- Upload status
- YouTube video IDs
- Scheduling info

### Logs Table
- Success/error logs
- Operation tracking
- Debug information

### Queue Table
- Video processing queue
- Status tracking
- Priority management

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### YouTube
- `GET /api/youtube/auth-url/:projectId` - Get OAuth URL
- `GET /api/youtube/auth-callback` - OAuth callback handler
- `GET /api/youtube/channel/:projectId` - Get channel info

### Videos
- `GET /api/videos/project/:projectId` - List project videos
- `GET /api/videos/:id` - Get video details
- `DELETE /api/videos/:id` - Delete video

### Queue
- `GET /api/queue` - Get queue status
- `GET /api/queue/stats` - Get queue statistics
- `POST /api/queue/generate/:projectId` - Manually trigger generation

### Logs
- `GET /api/logs` - Get all logs
- `GET /api/logs/project/:projectId` - Get project logs

## Data Flow

1. **Project Creation**
   - User creates project via frontend
   - Backend validates and stores in database
   - Project appears in dashboard

2. **YouTube Linking**
   - User clicks "Link YouTube Account"
   - Frontend opens OAuth popup
   - User authorizes in Google
   - Backend receives callback with tokens
   - Tokens stored in database

3. **Video Generation (Automatic)**
   - Scheduler runs daily at 1 AM
   - Checks each active project
   - Adds videos to queue based on daily quota
   - Queue manager processes videos sequentially
   - Each video: generate → upload → schedule

4. **Video Generation (Manual)**
   - User clicks "Generate Video Now"
   - Video added to queue with priority
   - Processed immediately if queue is empty

## File Processing

- **Clips**: Random selection from clips folder
- **Audio**: Random selection from audio folder
- **Thumbnails**: Random selection from thumbnails folder
- **Output**: Stored in `data/output/` directory
- **Cleanup**: Output files can be manually deleted (not auto-deleted)

## Security Considerations

- OAuth tokens stored in SQLite (local only)
- No external server required
- All processing happens locally
- `.env` file contains sensitive credentials (not in repo)

## Performance

- Processes one video at a time per project
- Projects processed sequentially
- Queue prevents system overload
- FFmpeg uses medium preset for balance

## Extensibility

Easy to extend:
- Add more video effects in `videoGenerator.js`
- Custom scheduling logic in `scheduler.js`
- Additional project settings in database schema
- New API endpoints in routes
- Additional frontend features in components

