const db = require('../database/db');
const videoGenerator = require('./videoGenerator');
const youtubeService = require('./youtubeService');
const fs = require('fs-extra');
const path = require('path');

let isProcessing = false;
const processingQueue = new Map();

/**
 * Add video to queue
 */
const addToQueue = (projectId, videoId = null, priority = 0) => {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    database.run(
      'INSERT INTO queue (project_id, video_id, priority) VALUES (?, ?, ?)',
      [projectId, videoId, priority],
      function(err) {
        if (err) {
          return reject(err);
        }
        resolve(this.lastID);
      }
    );
  });
};

/**
 * Process next item in queue
 */
const processNext = async () => {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    const database = db.getDb();
    
    // Get next item from queue
    database.get(
      `SELECT q.*, p.* FROM queue q
       JOIN projects p ON q.project_id = p.id
       WHERE q.status = 'pending' AND p.is_active = 1
       ORDER BY q.priority DESC, q.created_at ASC
       LIMIT 1`,
      async (err, item) => {
        if (err) {
          console.error('Queue error:', err);
          isProcessing = false;
          return;
        }

        if (!item) {
          isProcessing = false;
          return;
        }

        // Mark as processing
        database.run(
          'UPDATE queue SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?',
          ['processing', item.id],
          async (err) => {
            if (err) {
              console.error('Error updating queue:', err);
              isProcessing = false;
              return;
            }

            try {
              await processVideo(item);
              
              // Mark as completed
              database.run(
                'UPDATE queue SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['completed', item.id]
              );
            } catch (error) {
              console.error('Error processing video:', error);
              
              // Mark as failed
              database.run(
                'UPDATE queue SET status = ? WHERE id = ?',
                ['failed', item.id]
              );
              
              // Log error
              logError(item.project_id, item.video_id, error.message);
            } finally {
              isProcessing = false;
              // Process next item
              setTimeout(() => processNext(), 1000);
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('Queue processing error:', error);
    isProcessing = false;
  }
};

/**
 * Process a single video
 */
const processVideo = async (project) => {
  const database = db.getDb();
  
  // Get audio file
  const audioPath = videoGenerator.getRandomFile(project.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
  const thumbnailPath = videoGenerator.getRandomImage(project.thumbnails_folder);

  if (!audioPath) {
    throw new Error('No audio files available');
  }

  // Get audio duration
  const audioDuration = await videoGenerator.getVideoDuration(audioPath);
  
  // Get all clips with their durations
  const allClips = await videoGenerator.getAllClipsWithDuration(project.clips_folder);
  
  if (allClips.length === 0) {
    throw new Error('No clips available');
  }

  // Select random clips to match audio duration (no repeat until all used)
  const selectedClipPaths = videoGenerator.selectClipsForDuration(allClips, audioDuration);
  
  if (selectedClipPaths.length === 0) {
    throw new Error('Failed to select clips for video');
  }

  console.log(`Selected ${selectedClipPaths.length} clips for ${audioDuration.toFixed(2)}s audio`);

  // Generate title
  const videoNumber = await getNextVideoNumber(project.id);
  const title = project.title_template.replace(/\{\{number\}\}/g, videoNumber);

  // Generate video with multiple clips
  console.log(`Generating video for project: ${project.name}`);
  const { outputPath, thumbnailPath: finalThumbnail } = await videoGenerator.generateVideo(
    selectedClipPaths,
    audioPath,
    thumbnailPath,
    {
      fadeIn: 1,
      fadeOut: 1,
      volume: 0.7,
      audioVolume: 0.5
    }
  );
  
  // Store all clip paths as comma-separated string
  const clipPathsString = selectedClipPaths.join(',');

  // Create video record
  const videoId = await new Promise((resolve, reject) => {
    database.run(
      `INSERT INTO videos (
        project_id, clip_path, audio_path, thumbnail_path, output_path, title, description, tags, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        project.id,
        clipPathsString, // Store all clip paths
        audioPath,
        finalThumbnail || thumbnailPath,
        outputPath,
        title,
        project.description_template || '',
        project.tags || '',
        'generated'
      ],
      function(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });

  // Calculate scheduled date
  const scheduledDate = calculateScheduledDate(project, videoNumber);

  // Upload to YouTube
  if (!project.refresh_token) {
    throw new Error('YouTube not authenticated for this project');
  }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
  
  console.log(`Uploading to YouTube: ${title}`);
  const uploadResult = await youtubeService.uploadToYouTube(
    outputPath,
    finalThumbnail || thumbnailPath,
    title,
    project.description_template || '',
    project.tags || '',
    scheduledDate,
    project.access_token,
    project.refresh_token,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
    false // Not immediate publish for queue
  );

  // Update video record
  database.run(
    `UPDATE videos SET 
      youtube_video_id = ?, 
      status = ?, 
      scheduled_date = ?, 
      uploaded_at = CURRENT_TIMESTAMP 
    WHERE id = ?`,
    [uploadResult.videoId, 'uploaded', scheduledDate, videoId]
  );

  // Update project tokens if refreshed
  if (uploadResult.newAccessToken) {
    database.run(
      `UPDATE projects SET 
        access_token = ?, 
        token_expiry = ? 
      WHERE id = ?`,
      [uploadResult.newAccessToken, uploadResult.newTokenExpiry, project.id]
    );
  }

  // Log success
  logSuccess(project.id, videoId, `Video uploaded successfully: ${uploadResult.url}`);

  return uploadResult;
};

/**
 * Calculate scheduled date for video
 */
const calculateScheduledDate = (project, videoNumber) => {
  const videosPerDay = project.videos_per_day || 1;
  const uploadTime = project.upload_time || '14:00';
  const [hours, minutes] = uploadTime.split(':').map(Number);
  
  // Calculate which day this video should be scheduled
  const dayIndex = Math.floor((videoNumber - 1) / videosPerDay);
  const slotIndex = (videoNumber - 1) % videosPerDay;
  
  // Calculate time slots for the day
  const slots = calculateTimeSlots(videosPerDay, hours, minutes);
  const slotTime = slots[slotIndex];
  
  // Start from project start date
  const startDate = new Date(project.start_date);
  const scheduledDate = new Date(startDate);
  scheduledDate.setDate(startDate.getDate() + dayIndex);
  scheduledDate.setHours(slotTime.hours, slotTime.minutes, 0, 0);
  
  // Don't schedule past end date
  const endDate = new Date(project.end_date);
  if (scheduledDate > endDate) {
    return endDate;
  }
  
  return scheduledDate;
};

/**
 * Calculate time slots for videos per day
 */
const calculateTimeSlots = (videosPerDay, baseHours, baseMinutes) => {
  const slots = [];
  const totalMinutes = baseHours * 60 + baseMinutes;
  const interval = Math.floor((16 * 60) / videosPerDay); // Spread over 16 hours
  
  for (let i = 0; i < videosPerDay; i++) {
    const minutes = totalMinutes + (i * interval);
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    slots.push({ hours, minutes: mins });
  }
  
  return slots;
};

/**
 * Get next video number for project
 */
const getNextVideoNumber = (projectId) => {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    database.get(
      'SELECT COUNT(*) as count FROM videos WHERE project_id = ?',
      [projectId],
      (err, row) => {
        if (err) return reject(err);
        resolve((row.count || 0) + 1);
      }
    );
  });
};

/**
 * Log success
 */
const logSuccess = (projectId, videoId, message) => {
  const database = db.getDb();
  database.run(
    'INSERT INTO logs (project_id, video_id, type, message) VALUES (?, ?, ?, ?)',
    [projectId, videoId, 'success', message]
  );
};

/**
 * Log error
 */
const logError = (projectId, videoId, error) => {
  const database = db.getDb();
  database.run(
    'INSERT INTO logs (project_id, video_id, type, message, error) VALUES (?, ?, ?, ?, ?)',
    [projectId, videoId, 'error', 'Video processing failed', error]
  );
};

/**
 * Start queue processor
 */
const start = () => {
  // Process queue every 5 seconds
  setInterval(() => {
    processNext();
  }, 5000);
  
  // Initial process
  processNext();
};

module.exports = {
  addToQueue,
  processNext,
  start
};

