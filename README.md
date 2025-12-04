# Auto Video Create - Automated YouTube Video Generation System

Automated video generation and YouTube upload system with scheduling capabilities.

## Features

- 🎬 Create Videos with multiple clips, audio, and thumbnails
- 📹 Long Videos (merged videos)
- ⚡ Instant Publish to YouTube
- 📅 Portal Schedule (automatic daily publishing)
- 📺 YouTube Schedule (bulk scheduling)
- 🔄 Bulk Scheduling
- 📊 Dashboard with project management

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React
- **Database:** SQLite
- **Video Processing:** FFmpeg
- **YouTube API:** Google APIs

## Quick Start

### Prerequisites
- Node.js 18+
- FFmpeg
- Google OAuth credentials

### Installation

```bash
# Install dependencies
npm run install-all

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Start development
npm start          # Backend (port 5001)
npm run client     # Frontend (port 3000)
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for server deployment instructions.

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Server deployment guide
- [DIGITALOCEAN_QUICKSTART.md](./DIGITALOCEAN_QUICKSTART.md) - DigitalOcean deployment
- [SERVER_FOLDERS.md](./SERVER_FOLDERS.md) - Server folder paths guide

## License

MIT
