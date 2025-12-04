const express = require('express');
const router = express.Router();
const db = require('../database/db');
const videoGenerator = require('../services/videoGenerator');
const youtubeService = require('../services/youtubeService');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Get all long videos for a project
router.get('/project/:projectId', (req, res) => {
  const database = db.getDb();
  const { projectId } = req.params;
  
  database.all(
    'SELECT * FROM long_videos WHERE project_id = ? ORDER BY created_at DESC',
    [projectId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Get single long video
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.get('SELECT * FROM long_videos WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Long Video not found' });
    }
    res.json(row);
  });
});

// Create new Long Video
router.post('/', (req, res) => {
  const database = db.getDb();
  const {
    project_id,
    name,
    title,
    description,
    tags,
    thumbnails_folder,
    create_video_sequence, // Array of create_video IDs
    status,
    schedule_type
  } = req.body;

  if (!project_id || !name || !create_video_sequence || !Array.isArray(create_video_sequence)) {
    return res.status(400).json({ error: 'Missing required fields or invalid sequence' });
  }

  // Handle multiple titles and descriptions (JSON arrays)
  const titlesArray = Array.isArray(title) ? title : (title ? [title] : []);
  const descriptionsArray = Array.isArray(description) ? description : (description ? [description] : []);
  
  // Validate at least one title
  if (titlesArray.length === 0) {
    return res.status(400).json({ error: 'At least one title is required' });
  }

  // Convert arrays to JSON strings for storage
  const titleJson = JSON.stringify(titlesArray);
  const descriptionJson = descriptionsArray.length > 0 ? JSON.stringify(descriptionsArray) : null;

  database.run(
    `INSERT INTO long_videos (
      project_id, name, title, description, tags, thumbnails_folder,
      create_video_sequence, status, schedule_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project_id,
      name,
      titleJson,
      descriptionJson,
      tags || '',
      thumbnails_folder || null,
      JSON.stringify(create_video_sequence),
      status || 'draft',
      schedule_type || null
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Long Video created successfully' });
    }
  );
});

// Generate and publish Long Video
router.post('/:id/generate', async (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const { publish_type, scheduled_date } = req.body; // instant, portal, youtube

  try {
    // Get long video
    const longVideo = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM long_videos WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Long Video not found'));
        resolve(row);
      });
    });

    // Get project for YouTube auth
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [longVideo.project_id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Project not found'));
        resolve(row);
      });
    });

    if (!project.refresh_token && publish_type !== 'draft') {
      return res.status(400).json({ error: 'YouTube account not linked' });
    }

    // Get sequence of create videos
    const sequence = JSON.parse(longVideo.create_video_sequence);
    const createVideos = await Promise.all(
      sequence.map(cvId => {
        return new Promise((resolve, reject) => {
          database.get('SELECT * FROM create_videos WHERE id = ?', [cvId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        });
      })
    );

    // Generate videos for each create video in sequence
    const generatedVideoPaths = [];
    for (const createVideo of createVideos) {
      // Get audio duration
      const audioFiles = fs.readdirSync(createVideo.audio_folder)
        .filter(f => ['.mp3', '.wav', '.m4a', '.aac'].includes(require('path').extname(f).toLowerCase()));
      
      if (audioFiles.length === 0) {
        throw new Error(`No audio files in ${createVideo.audio_folder}`);
      }

      const audioPath = require('path').join(createVideo.audio_folder, audioFiles[0]);
      const audioDuration = await videoGenerator.getVideoDuration(audioPath);

      // Get all clips
      const allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
      if (allClips.length === 0) {
        throw new Error(`No clips in ${createVideo.clips_folder}`);
      }

      // Select clips for duration
      const selectedClips = videoGenerator.selectClipsForDuration(allClips, audioDuration);
      const thumbnailPath = videoGenerator.getRandomImage(createVideo.thumbnails_folder);

      // Generate video
      const { outputPath } = await videoGenerator.generateVideo(
        selectedClips,
        audioPath,
        thumbnailPath,
        { fadeIn: 1, fadeOut: 1, volume: 0.7, audioVolume: 0.5 }
      );

      generatedVideoPaths.push(outputPath);
    }

    // Merge all videos into one long video
    const finalOutputPath = path.join(path.dirname(generatedVideoPaths[0]), `long_video_${uuidv4()}.mp4`);
    
    // Use concat demuxer to merge videos
    const concatFile = path.join('/tmp', `concat_long_${uuidv4()}.txt`);
    const concatContent = generatedVideoPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatFile, concatContent);

    // Merge using FFmpeg
    const { execSync } = require('child_process');
    const tempOutput = path.join('/tmp', `long_temp_${uuidv4()}.mp4`);
    
    execSync(`ffmpeg -f concat -safe 0 -i '${concatFile}' -c copy -y '${tempOutput}'`, {
      stdio: 'ignore',
      maxBuffer: 10 * 1024 * 1024
    });

    fs.moveSync(tempOutput, finalOutputPath, { overwrite: true });
    fs.unlinkSync(concatFile);

    // Update long video with output path
    database.run(
      'UPDATE long_videos SET output_path = ? WHERE id = ?',
      [finalOutputPath, id]
    );

    // If publishing, upload to YouTube
    if (publish_type === 'instant') {
      // Parse titles and descriptions (JSON arrays)
      const titles = longVideo.title ? (typeof longVideo.title === 'string' ? JSON.parse(longVideo.title) : longVideo.title) : [];
      const descriptions = longVideo.description ? (typeof longVideo.description === 'string' ? JSON.parse(longVideo.description) : longVideo.description) : [];
      
      // Random select title and description
      const selectedTitle = titles.length > 0 ? titles[Math.floor(Math.random() * titles.length)] : 'Untitled Long Video';
      const selectedDescription = descriptions.length > 0 ? descriptions[Math.floor(Math.random() * descriptions.length)] : '';

      // Get thumbnail (prefer long video thumbnails, fallback to project)
      const thumbnailFolder = longVideo.thumbnails_folder || project.thumbnails_folder;
      const thumbnailPath = videoGenerator.getRandomImage(thumbnailFolder);
      
      const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

      const uploadResult = await youtubeService.uploadToYouTube(
        finalOutputPath,
        thumbnailPath,
        selectedTitle,
        selectedDescription,
        longVideo.tags || '',
        null,
        project.access_token,
        project.refresh_token,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        REDIRECT_URI,
        true // publish immediately
      );

      database.run(
        `UPDATE long_videos SET 
          youtube_video_id = ?, status = 'published', schedule_type = 'instant'
        WHERE id = ?`,
        [uploadResult.videoId, id]
      );

      res.json({
        message: 'Long video generated and published successfully!',
        videoId: uploadResult.videoId,
        url: uploadResult.url
      });
    } else if (publish_type === 'portal' || publish_type === 'youtube') {
      // Schedule logic will be handled separately
      database.run(
        `UPDATE long_videos SET 
          status = 'scheduled', schedule_type = ?,
          scheduled_date = ?
        WHERE id = ?`,
        [publish_type, scheduled_date, id]
      );

      res.json({
        message: 'Long video generated and scheduled successfully!',
        scheduled_date: scheduled_date
      });
    } else {
      // Just save as draft
      database.run(
        'UPDATE long_videos SET status = ? WHERE id = ?',
        ['saved', id]
      );

      res.json({
        message: 'Long video generated and saved successfully!'
      });
    }
  } catch (error) {
    console.error('Long video generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update Long Video
router.put('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const updates = req.body;

  const allowedFields = [
    'name', 'title', 'description', 'tags', 'thumbnails_folder',
    'create_video_sequence', 'status', 'schedule_type', 'scheduled_date', 'publish_time'
  ];

  const updateFields = [];
  const updateValues = [];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      if (key === 'create_video_sequence' && Array.isArray(updates[key])) {
        updateFields.push(`${key} = ?`);
        updateValues.push(JSON.stringify(updates[key]));
      } else if (key === 'title' && Array.isArray(updates[key])) {
        updateFields.push(`${key} = ?`);
        updateValues.push(JSON.stringify(updates[key]));
      } else if (key === 'description' && Array.isArray(updates[key])) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key].length > 0 ? JSON.stringify(updates[key]) : null);
      } else {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    }
  });

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateValues.push(id);

  database.run(
    `UPDATE long_videos SET ${updateFields.join(', ')} WHERE id = ?`,
    updateValues,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Long Video updated successfully' });
    }
  );
});

// Delete Long Video
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.run('DELETE FROM long_videos WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Long Video deleted successfully' });
  });
});

// Portal Schedule endpoint for Long Video
router.post('/:id/portal-schedule', async (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const { publish_time } = req.body;

  try {
    // Validate required fields
    if (!publish_time) {
      return res.status(400).json({ error: 'Missing required field: publish_time' });
    }

    // Update long video with portal schedule settings
    database.run(
      `UPDATE long_videos SET 
        status = 'scheduled',
        schedule_type = 'portal',
        publish_time = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [publish_time, id],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({ 
          message: 'Portal schedule configured successfully',
          id: id,
          schedule_type: 'portal',
          publish_time
        });
      }
    );
  } catch (error) {
    console.error('Portal schedule error:', error);
    res.status(500).json({ error: error.message });
  }
});

// YouTube Schedule endpoint for Long Video
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

    // Get long video
    const longVideo = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM long_videos WHERE id = ?', [id], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Long Video not found'));
        resolve(row);
      });
    });

    // Get project for YouTube auth
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [longVideo.project_id], (err, row) => {
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

    const titles = parseJSON(longVideo.title);
    const descriptions = parseJSON(longVideo.description);

    // Get sequence of create videos
    const sequence = JSON.parse(longVideo.create_video_sequence);
    const createVideos = await Promise.all(
      sequence.map(cvId => {
        return new Promise((resolve, reject) => {
          database.get('SELECT * FROM create_videos WHERE id = ?', [cvId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
          });
        });
      })
    );

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
          const selectedTitle = titles.length > 0 ? titles[Math.floor(Math.random() * titles.length)] : 'Untitled Long Video';
          const selectedDescription = descriptions.length > 0 ? descriptions[Math.floor(Math.random() * descriptions.length)] : '';

          // Generate videos for each create video in sequence
          const generatedVideoPaths = [];
          for (const createVideo of createVideos) {
            // Get audio duration
            const audioPath = videoGenerator.getRandomFile(createVideo.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
            if (!audioPath) {
              throw new Error(`No audio files in ${createVideo.audio_folder}`);
            }

            const audioDuration = await videoGenerator.getVideoDuration(audioPath);

            // Get all clips
            const allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
            if (allClips.length === 0) {
              throw new Error(`No clips in ${createVideo.clips_folder}`);
            }

            // Select clips for duration
            const selectedClips = videoGenerator.selectClipsForDuration(allClips, audioDuration);
            const thumbnailPath = videoGenerator.getRandomImage(createVideo.thumbnails_folder);

            // Generate video
            const { outputPath } = await videoGenerator.generateVideo(
              selectedClips,
              audioPath,
              thumbnailPath,
              { fadeIn: 1, fadeOut: 1, volume: 0.7, audioVolume: 0.5 }
            );

            generatedVideoPaths.push(outputPath);
          }

          // Merge all videos into one long video
          const finalOutputPath = path.join(path.dirname(generatedVideoPaths[0]), `long_video_${uuidv4()}.mp4`);
          
          // Use concat demuxer to merge videos
          const concatFile = path.join('/tmp', `concat_long_${uuidv4()}.txt`);
          const concatContent = generatedVideoPaths.map(p => `file '${p}'`).join('\n');
          fs.writeFileSync(concatFile, concatContent);

          // Merge using FFmpeg
          const { execSync } = require('child_process');
          const tempOutput = path.join('/tmp', `long_temp_${uuidv4()}.mp4`);
          
          execSync(`ffmpeg -f concat -safe 0 -i '${concatFile}' -c copy -y '${tempOutput}'`, {
            stdio: 'ignore',
            maxBuffer: 10 * 1024 * 1024
          });

          fs.moveSync(tempOutput, finalOutputPath, { overwrite: true });
          fs.unlinkSync(concatFile);

          // Get thumbnail (prefer long video thumbnails, fallback to project)
          const thumbnailFolder = longVideo.thumbnails_folder || project.thumbnails_folder;
          const thumbnailPath = videoGenerator.getRandomImage(thumbnailFolder);

          // Upload to YouTube with scheduled date
          const uploadResult = await youtubeService.uploadToYouTube(
            finalOutputPath,
            thumbnailPath,
            selectedTitle,
            selectedDescription,
            longVideo.tags || '',
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
          console.error(`Error generating long video ${videoIndex + 1}:`, error);
          // Continue with next video
        }
      }
    }

    // Update long video status
    database.run(
      `UPDATE long_videos SET 
        status = 'scheduled',
        schedule_type = 'youtube',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [id]
    );

    res.json({
      message: `Successfully scheduled ${scheduledVideos.length} of ${total_videos} long videos`,
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

