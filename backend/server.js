const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes (must be before static file serving)
app.use('/api/projects', require('./routes/projects'));
app.use('/api/videos', require('./routes/videos'));
app.use('/api/create-videos', require('./routes/createVideos'));
app.use('/api/long-videos', require('./routes/longVideos'));
app.use('/api/bulk-schedule', require('./routes/bulkSchedule'));
app.use('/api/youtube', require('./routes/youtube'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/upload', require('./routes/upload'));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../data/uploads')));

// API info route (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.get('/', (req, res) => {
    res.json({
      message: 'Auto Video Create API Server',
      version: '1.0.0',
      endpoints: {
        projects: '/api/projects',
        videos: '/api/videos',
        youtube: '/api/youtube',
        logs: '/api/logs',
        queue: '/api/queue'
      },
      frontend: process.env.FRONTEND_URL || 'http://localhost:3000'
    });
  });
}

// Serve static files from React app (production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  // All non-API routes should serve React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// Initialize database and scheduler
const db = require('./database/db');
const scheduler = require('./services/scheduler');

// Initialize on startup
db.init().then(() => {
  console.log('Database initialized');
  scheduler.start();
  console.log('Scheduler started');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

