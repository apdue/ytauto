const express = require('express');
const router = express.Router();
const db = require('../database/db');
const videoGenerator = require('../services/videoGenerator');
const youtubeService = require('../services/youtubeService');

// Get all videos for a project
router.get('/project/:projectId', (req, res) => {
  const database = db.getDb();
  const { projectId } = req.params;
  
  database.all(
    'SELECT * FROM videos WHERE project_id = ? ORDER BY created_at DESC',
    [projectId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Get single video
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.get('SELECT * FROM videos WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json(row);
  });
});

// Delete video
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.run('DELETE FROM videos WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Video deleted successfully' });
  });
});

// Instant publish - Generate and publish video immediately
router.post('/instant-publish/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const database = db.getDb();
  
  try {
    // Get project
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Project not found'));
        resolve(row);
      });
    });

    // Check YouTube authentication
    if (!project.refresh_token) {
      return res.status(400).json({ error: 'YouTube account not linked. Please link your YouTube account first.' });
    }

    // Get audio file
    const audioPath = videoGenerator.getRandomFile(project.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
    const thumbnailPath = videoGenerator.getRandomImage(project.thumbnails_folder);

    if (!audioPath) {
      return res.status(400).json({ error: 'No audio files available' });
    }

    // Get audio duration
    const audioDuration = await videoGenerator.getVideoDuration(audioPath);
    
    // Get all clips with their durations
    const allClips = await videoGenerator.getAllClipsWithDuration(project.clips_folder);
    
    if (allClips.length === 0) {
      return res.status(400).json({ error: 'No clips available' });
    }

    // Select random clips to match audio duration (no repeat until all used)
    const selectedClipPaths = videoGenerator.selectClipsForDuration(allClips, audioDuration);
    
    if (selectedClipPaths.length === 0) {
      return res.status(400).json({ error: 'Failed to select clips for video' });
    }

    console.log(`Selected ${selectedClipPaths.length} clips for ${audioDuration.toFixed(2)}s audio`);

    // Get next video number
    const getNextVideoNumber = (projectId) => {
      return new Promise((resolve, reject) => {
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

    const videoNumber = await getNextVideoNumber(project.id);
    const title = project.title_template.replace(/\{\{number\}\}/g, videoNumber);

    // Generate video with multiple clips
    console.log(`Generating video for instant publish: ${project.name}`);
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

    // Upload to YouTube immediately (public)
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
    
    console.log(`Uploading to YouTube (instant publish): ${title}`);
    const uploadResult = await youtubeService.uploadToYouTube(
      outputPath,
      finalThumbnail || thumbnailPath,
      title,
      project.description_template || '',
      project.tags || '',
      null, // No scheduled date for instant publish
      project.access_token,
      project.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
      true // publishImmediately = true
    );

    // Create video record
    const videoId = await new Promise((resolve, reject) => {
      database.run(
      `INSERT INTO videos (
        project_id, clip_path, audio_path, thumbnail_path, output_path, title, description, tags, 
        youtube_video_id, status, uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        project.id,
        clipPathsString, // Store all clip paths
        audioPath,
        finalThumbnail || thumbnailPath,
        outputPath,
        title,
        project.description_template || '',
        project.tags || '',
        uploadResult.videoId,
        'uploaded'
      ],
        function(err) {
          if (err) return reject(err);
          resolve(this.lastID);
        }
      );
    });

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
    database.run(
      `INSERT INTO logs (project_id, type, message) VALUES (?, ?, ?)`,
      [project.id, 'success', `Video published instantly: ${uploadResult.url}`]
    );

    res.json({
      message: 'Video generated and published successfully!',
      video: {
        id: videoId,
        title: title,
        youtubeId: uploadResult.videoId,
        url: uploadResult.url
      }
    });
  } catch (error) {
    console.error('Instant publish error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

