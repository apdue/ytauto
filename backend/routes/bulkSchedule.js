const express = require('express');
const router = express.Router();
const db = require('../database/db');
const videoGenerator = require('../services/videoGenerator');
const youtubeService = require('../services/youtubeService');
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Get IST date at 7 AM for a specific day offset
const getISTDateAtTime = (dayOffset = 0, time = '07:00') => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  istTime.setUTCDate(istTime.getUTCDate() + dayOffset);
  const [hours, minutes] = time.split(':').map(Number);
  istTime.setUTCHours(hours, minutes, 0, 0);
  
  const localTime = new Date(istTime.getTime() - istOffset);
  return localTime.toISOString();
};

// Create bulk schedule
router.post('/', async (req, res) => {
  const database = db.getDb();
  const {
    project_id,
    create_video_id,
    number_of_videos,
    start_date,
    end_date,
    publish_time,
    schedule_type // 'portal' or 'youtube'
  } = req.body;

  if (!project_id || !create_video_id || !number_of_videos || !start_date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get project and create video
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [project_id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Project not found'));
        resolve(row);
      });
    });

    const createVideo = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM create_videos WHERE id = ?', [create_video_id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Create Video not found'));
        resolve(row);
      });
    });

    if (!project.refresh_token) {
      return res.status(400).json({ error: 'YouTube account not linked' });
    }

    // Create bulk schedule record
    const bulkScheduleId = await new Promise((resolve, reject) => {
      database.run(
        `INSERT INTO bulk_schedules (
          project_id, create_video_id, number_of_videos,
          start_date, end_date, publish_time, schedule_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          project_id,
          create_video_id,
          number_of_videos,
          start_date,
          end_date || null,
          publish_time || '07:00',
          schedule_type || 'youtube'
        ],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

    // Generate and upload videos
    const startDateObj = new Date(start_date);
    const uploadedVideos = [];

    for (let i = 0; i < number_of_videos; i++) {
      try {
        // Calculate scheduled date
        const scheduledDate = getISTDateAtTime(i, publish_time || '07:00');

        // Get audio
        const audioFiles = fs.readdirSync(createVideo.audio_folder)
          .filter(f => ['.mp3', '.wav', '.m4a', '.aac'].includes(path.extname(f).toLowerCase()));
        
        if (audioFiles.length === 0) {
          throw new Error(`No audio files in ${createVideo.audio_folder}`);
        }

        const audioPath = path.join(createVideo.audio_folder, audioFiles[Math.floor(Math.random() * audioFiles.length)]);
        const audioDuration = await videoGenerator.getVideoDuration(audioPath);

        // Get clips
        const allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
        if (allClips.length === 0) {
          throw new Error(`No clips in ${createVideo.clips_folder}`);
        }

        const selectedClips = videoGenerator.selectClipsForDuration(allClips, audioDuration);
        const thumbnailPath = videoGenerator.getRandomImage(createVideo.thumbnails_folder);

        // Generate video
        const { outputPath } = await videoGenerator.generateVideo(
          selectedClips,
          audioPath,
          thumbnailPath,
          { fadeIn: 1, fadeOut: 1, volume: 0.7, audioVolume: 0.5 }
        );

        // Upload to YouTube
        const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

        const uploadResult = await youtubeService.uploadToYouTube(
          outputPath,
          thumbnailPath,
          createVideo.title,
          createVideo.description || '',
          createVideo.tags || '',
          schedule_type === 'youtube' ? scheduledDate : null, // YouTube schedule
          project.access_token,
          project.refresh_token,
          GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET,
          REDIRECT_URI,
          schedule_type === 'youtube' ? false : true // Portal schedule = instant, YouTube = scheduled
        );

        uploadedVideos.push({
          videoId: uploadResult.videoId,
          url: uploadResult.url,
          scheduledDate: scheduledDate
        });

        // Log success
        database.run(
          `INSERT INTO logs (project_id, type, message) VALUES (?, ?, ?)`,
          [project_id, 'success', `Bulk schedule video ${i + 1}/${number_of_videos} uploaded: ${uploadResult.url}`]
        );
      } catch (error) {
        console.error(`Error generating video ${i + 1}:`, error);
        database.run(
          `INSERT INTO logs (project_id, type, message, error) VALUES (?, ?, ?, ?)`,
          [project_id, 'error', `Bulk schedule video ${i + 1} failed`, error.message]
        );
      }
    }

    // Update bulk schedule status
    database.run(
      'UPDATE bulk_schedules SET status = ? WHERE id = ?',
      ['completed', bulkScheduleId]
    );

    res.json({
      message: `Successfully generated and ${schedule_type === 'youtube' ? 'scheduled' : 'uploaded'} ${uploadedVideos.length} videos`,
      videos: uploadedVideos
    });
  } catch (error) {
    console.error('Bulk schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get bulk schedules for a project
router.get('/project/:projectId', (req, res) => {
  const database = db.getDb();
  const { projectId } = req.params;
  
  database.all(
    'SELECT * FROM bulk_schedules WHERE project_id = ? ORDER BY created_at DESC',
    [projectId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

module.exports = router;

