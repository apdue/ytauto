const express = require('express');
const router = express.Router();
const db = require('../database/db');
const fs = require('fs-extra');
const videoGenerator = require('../services/videoGenerator');
const youtubeService = require('../services/youtubeService');

// Get current IST date at 7 AM
const getISTDateAt7AM = () => {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);
  
  // Set to 7 AM
  istTime.setUTCHours(7, 0, 0, 0);
  
  // Convert back to local time for storage
  const localTime = new Date(istTime.getTime() - istOffset);
  return localTime.toISOString().split('T')[0];
};

// Get all create videos for a project
router.get('/project/:projectId', (req, res) => {
  const database = db.getDb();
  const { projectId } = req.params;
  
  database.all(
    'SELECT * FROM create_videos WHERE project_id = ? ORDER BY created_at DESC',
    [projectId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Get single create video
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.get('SELECT * FROM create_videos WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Create Video not found' });
    }
    res.json(row);
  });
});

// Create new Create Video
router.post('/', (req, res) => {
  const database = db.getDb();
  const {
    project_id,
    name,
    clips_folder,
    audio_folder,
    thumbnails_folder,
    title,
    description,
    tags,
    publish_time,
    videos_per_day,
    start_date,
    end_date,
    is_unlimited,
    status
  } = req.body;

  // Validate required fields
  if (!project_id || !name) {
    return res.status(400).json({ error: 'Missing required fields: project_id and name are required' });
  }

  // Handle multiple titles and descriptions (JSON arrays)
  const titlesArray = Array.isArray(title) ? title : (title ? [title] : []);
  const descriptionsArray = Array.isArray(description) ? description : (description ? [description] : []);
  
  // Validate at least one title if provided
  if (titlesArray.length === 0) {
    return res.status(400).json({ error: 'At least one title is required' });
  }

  // Convert arrays to JSON strings for storage
  const titleJson = JSON.stringify(titlesArray);
  const descriptionJson = descriptionsArray.length > 0 ? JSON.stringify(descriptionsArray) : null;

  // Auto set start_date to current day 7 AM IST if not provided
  const finalStartDate = start_date || getISTDateAt7AM();
  const finalEndDate = is_unlimited ? null : end_date;

  database.run(
    `INSERT INTO create_videos (
      project_id, name, clips_folder, audio_folder, thumbnails_folder,
      title, description, tags, publish_time, videos_per_day,
      start_date, end_date, is_unlimited, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project_id,
      name,
      clips_folder || null,
      audio_folder || null,
      thumbnails_folder || null,
      titleJson,
      descriptionJson,
      tags || '',
      publish_time || '07:00',
      videos_per_day || 1,
      finalStartDate,
      finalEndDate,
      is_unlimited ? 1 : 0,
      status || 'draft'
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Create Video saved successfully' });
    }
  );
});

// Update Create Video
router.put('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = [
    'name', 'clips_folder', 'audio_folder', 'thumbnails_folder',
    'title', 'description', 'tags', 'publish_time', 'videos_per_day',
    'start_date', 'end_date', 'is_unlimited', 'status', 'schedule_type'
  ];

  const updateFields = [];
  const updateValues = [];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      updateValues.push(updates[key]);
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id);

  database.run(
    `UPDATE create_videos SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Create Video updated successfully' });
    }
  );
});

// Delete Create Video
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.run('DELETE FROM create_videos WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Create Video deleted successfully' });
  });
});

// Instant publish for Create Video
router.post('/:id/instant-publish', async (req, res) => {
  const database = db.getDb();
  const { id } = req.params;

  try {
    // Get create video
    const createVideo = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM create_videos WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Create Video not found'));
        resolve(row);
      });
    });

    // Get project for YouTube auth
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [createVideo.project_id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Project not found'));
        resolve(row);
      });
    });

    if (!project.refresh_token) {
      return res.status(400).json({ error: 'YouTube account not linked' });
    }

    // Parse titles and descriptions (JSON arrays)
    const titles = createVideo.title ? (typeof createVideo.title === 'string' ? JSON.parse(createVideo.title) : createVideo.title) : [];
    const descriptions = createVideo.description ? (typeof createVideo.description === 'string' ? JSON.parse(createVideo.description) : createVideo.description) : [];
    
    // Random select title and description
    const selectedTitle = titles.length > 0 ? titles[Math.floor(Math.random() * titles.length)] : 'Untitled Video';
    const selectedDescription = descriptions.length > 0 ? descriptions[Math.floor(Math.random() * descriptions.length)] : '';

    // Get audio (random if multiple)
    const audioPath = videoGenerator.getRandomFile(createVideo.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
    if (!audioPath) {
      return res.status(400).json({ error: 'No audio files found' });
    }

    const audioDuration = await videoGenerator.getVideoDuration(audioPath);

    // Get clips
    const allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
    if (allClips.length === 0) {
      return res.status(400).json({ error: 'No clips found' });
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
      selectedTitle,
      selectedDescription,
      createVideo.tags || '',
      null,
      project.access_token,
      project.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
      true // publish immediately
    );

    // Update create video
    database.run(
      `UPDATE create_videos SET 
        youtube_video_id = ?, status = 'published', schedule_type = 'instant'
      WHERE id = ?`,
      [uploadResult.videoId, id]
    );

    // Update project tokens if refreshed
    if (uploadResult.newAccessToken) {
      database.run(
        `UPDATE projects SET access_token = ?, token_expiry = ? WHERE id = ?`,
        [uploadResult.newAccessToken, uploadResult.newTokenExpiry, project.id]
      );
    }

    res.json({
      message: 'Video published instantly!',
      videoId: uploadResult.videoId,
      url: uploadResult.url
    });
  } catch (error) {
    console.error('Instant publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Portal Schedule endpoint
router.post('/:id/portal-schedule', async (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const { publish_time, schedule_gap, videos_per_day } = req.body;

  try {
    // Validate required fields
    if (!publish_time || !schedule_gap || !videos_per_day) {
      return res.status(400).json({ error: 'Missing required fields: publish_time, schedule_gap, videos_per_day' });
    }

    // Validate schedule_gap
    const validGaps = ['daily', '2days', '3days', '4days', '5days', 'weekly'];
    if (!validGaps.includes(schedule_gap)) {
      return res.status(400).json({ error: 'Invalid schedule_gap. Must be: daily, 2days, 3days, 4days, 5days, or weekly' });
    }

    // Update create video with portal schedule settings
    database.run(
      `UPDATE create_videos SET 
        status = 'scheduled',
        schedule_type = 'portal',
        publish_time = ?,
        schedule_gap = ?,
        videos_per_day = ?,
        is_unlimited = 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [publish_time, schedule_gap, videos_per_day, id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: 'Portal schedule configured successfully',
          id: id,
          schedule_type: 'portal',
          publish_time,
          schedule_gap,
          videos_per_day
        });
      }
    );
  } catch (error) {
    console.error('Portal schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// YouTube Schedule endpoint
router.post('/:id/youtube-schedule', async (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const { total_videos, videos_per_day, times } = req.body;

  try {
    // Validate required fields
    if (!total_videos || !videos_per_day || !times || !Array.isArray(times) || times.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: total_videos, videos_per_day, times (array)' });
    }

    if (videos_per_day > times.length) {
      return res.status(400).json({ error: `videos_per_day (${videos_per_day}) cannot exceed number of times (${times.length})` });
    }

    // Get create video
    const createVideo = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM create_videos WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Create Video not found'));
        resolve(row);
      });
    });

    // Get project for YouTube auth
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [createVideo.project_id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Project not found'));
        resolve(row);
      });
    });

    if (!project.refresh_token) {
      return res.status(400).json({ error: 'YouTube account not linked' });
    }

    // IST timezone offset (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;

    // Calculate all scheduled dates
    const scheduledVideos = [];
    let currentDate = new Date();
    
    // Check if first time slot for today has passed
    const [firstHours, firstMinutes] = times[0].split(':').map(Number);
    const now = new Date();
    const istNow = new Date(now.getTime() + istOffset);
    const firstTimeToday = new Date(istNow);
    firstTimeToday.setHours(firstHours, firstMinutes, 0, 0);
    
    let startDayOffset = 0; // 0 = today, 1 = tomorrow
    if (istNow > firstTimeToday) {
      startDayOffset = 1; // Start from tomorrow
    }

    let videoIndex = 0;
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

    // Parse JSON arrays from database
    const parseJSON = (value) => {
      if (!value) return [];
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return [value];
        }
      }
      return Array.isArray(value) ? value : [];
    };

    const titles = parseJSON(createVideo.title);
    const descriptions = parseJSON(createVideo.description);

    for (let day = 0; day < Math.ceil(total_videos / videos_per_day); day++) {
      for (let slot = 0; slot < videos_per_day && videoIndex < total_videos; slot++) {
        try {
          // Calculate scheduled date in IST
          const scheduledDate = new Date(currentDate);
          scheduledDate.setDate(currentDate.getDate() + startDayOffset + day);
          const [hours, minutes] = times[slot % times.length].split(':').map(Number);
          scheduledDate.setHours(hours, minutes, 0, 0);
          
          // Convert IST to UTC for YouTube API
          const utcDate = new Date(scheduledDate.getTime() - istOffset);

          // Random select title and description
          const selectedTitle = titles.length > 0 ? titles[Math.floor(Math.random() * titles.length)] : 'Untitled Video';
          const selectedDescription = descriptions.length > 0 ? descriptions[Math.floor(Math.random() * descriptions.length)] : '';

          // Get random files
          const audioPath = videoGenerator.getRandomFile(createVideo.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
          if (!audioPath) {
            throw new Error('No audio files found');
          }

          const audioDuration = await videoGenerator.getVideoDuration(audioPath);
          const allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
          if (allClips.length === 0) {
            throw new Error('No clips found');
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

          // Upload to YouTube with scheduled date
          const uploadResult = await youtubeService.uploadToYouTube(
            outputPath,
            thumbnailPath,
            selectedTitle,
            selectedDescription,
            createVideo.tags || '',
            utcDate.toISOString(), // scheduledDate
            project.access_token,
            project.refresh_token,
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            REDIRECT_URI,
            false // Don't publish immediately
          );

          // Update project tokens if refreshed
          if (uploadResult.newAccessToken) {
            database.run(
              `UPDATE projects SET access_token = ?, token_expiry = ? WHERE id = ?`,
              [uploadResult.newAccessToken, uploadResult.newTokenExpiry, project.id]
            );
          }

          scheduledVideos.push({
            videoId: uploadResult.videoId,
            url: uploadResult.url,
            scheduledDate: utcDate.toISOString(),
            index: videoIndex + 1
          });

          videoIndex++;
        } catch (error) {
          console.error(`Error generating video ${videoIndex + 1}:`, error);
          // Continue with next video
        }
      }
    }

    // Update create video status
    database.run(
      `UPDATE create_videos SET 
        status = 'scheduled',
        schedule_type = 'youtube',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [id]
    );

    res.json({
      message: `Successfully scheduled ${scheduledVideos.length} of ${total_videos} videos`,
      videos: scheduledVideos,
      total: total_videos,
      successful: scheduledVideos.length,
      failed: total_videos - scheduledVideos.length
    });
  } catch (error) {
    console.error('YouTube schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

