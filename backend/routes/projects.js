const express = require('express');
const router = express.Router();
const db = require('../database/db');
const fs = require('fs-extra');
const path = require('path');

// Get all projects
router.get('/', (req, res) => {
  const database = db.getDb();
  database.all('SELECT * FROM projects ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get single project
router.get('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get statistics
    database.get('SELECT COUNT(*) as total FROM videos WHERE project_id = ?', [id], (err, videoCount) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      database.get('SELECT COUNT(*) as total FROM videos WHERE project_id = ? AND status = ?', [id, 'uploaded'], (err, uploadedCount) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Count clips and audio files
        const clipsCount = countFiles(row.clips_folder);
        const audioCount = countFiles(row.audio_folder);
        const thumbnailsCount = countFiles(row.thumbnails_folder);
        
        res.json({
          ...row,
          stats: {
            totalVideos: videoCount.total,
            uploadedVideos: uploadedCount.total,
            clipsCount,
            audioCount,
            thumbnailsCount
          }
        });
      });
    });
  });
});

// Create new project
router.post('/', async (req, res) => {
  const database = db.getDb();
  const {
    name,
    clips_folder,
    audio_folder,
    thumbnails_folder,
    title_template,
    description_template,
    tags,
    videos_per_day,
    upload_time,
    start_date,
    end_date
  } = req.body;
  
  // Validate required fields - only name is required now
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }
  
  // Validate folders exist only if provided
  const missingFolders = [];
  if (clips_folder && !fs.existsSync(clips_folder)) {
    missingFolders.push(`Clips folder: ${clips_folder}`);
  }
  if (audio_folder && !fs.existsSync(audio_folder)) {
    missingFolders.push(`Audio folder: ${audio_folder}`);
  }
  if (thumbnails_folder && !fs.existsSync(thumbnails_folder)) {
    missingFolders.push(`Thumbnails folder: ${thumbnails_folder}`);
  }
  
  if (missingFolders.length > 0) {
    return res.status(400).json({ 
      error: `Invalid folder paths:\n${missingFolders.join('\n')}\n\nPlease check the paths or leave them empty.` 
    });
  }
  
  database.run(
    `INSERT INTO projects (
      name, clips_folder, audio_folder, thumbnails_folder,
      title_template, description_template, tags,
      videos_per_day, upload_time, start_date, end_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, clips_folder || null, audio_folder || null, thumbnails_folder || null, title_template || null, description_template || null, tags || '', videos_per_day || 1, upload_time || '14:00', start_date || null, end_date || null],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: this.lastID, message: 'Project created successfully' });
    }
  );
});

// Update project
router.put('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  const {
    name,
    clips_folder,
    audio_folder,
    thumbnails_folder,
    title_template,
    description_template,
    tags,
    videos_per_day,
    upload_time,
    start_date,
    end_date,
    is_active
  } = req.body;
  
  const updates = [];
  const values = [];
  
  if (name !== undefined) { updates.push('name = ?'); values.push(name); }
  if (clips_folder !== undefined) { updates.push('clips_folder = ?'); values.push(clips_folder); }
  if (audio_folder !== undefined) { updates.push('audio_folder = ?'); values.push(audio_folder); }
  if (thumbnails_folder !== undefined) { updates.push('thumbnails_folder = ?'); values.push(thumbnails_folder); }
  if (title_template !== undefined) { updates.push('title_template = ?'); values.push(title_template); }
  if (description_template !== undefined) { updates.push('description_template = ?'); values.push(description_template); }
  if (tags !== undefined) { updates.push('tags = ?'); values.push(tags); }
  if (videos_per_day !== undefined) { updates.push('videos_per_day = ?'); values.push(videos_per_day); }
  if (upload_time !== undefined) { updates.push('upload_time = ?'); values.push(upload_time); }
  if (start_date !== undefined) { updates.push('start_date = ?'); values.push(start_date); }
  if (end_date !== undefined) { updates.push('end_date = ?'); values.push(end_date); }
  if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  
  database.run(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
    values,
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Project updated successfully' });
    }
  );
});

// Delete project
router.delete('/:id', (req, res) => {
  const database = db.getDb();
  const { id } = req.params;
  
  database.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Project deleted successfully' });
  });
});

// Helper function to count files in directory
function countFiles(folderPath) {
  try {
    if (!fs.existsSync(folderPath)) return 0;
    const files = fs.readdirSync(folderPath);
    return files.filter(file => {
      const fullPath = path.join(folderPath, file);
      return fs.statSync(fullPath).isFile();
    }).length;
  } catch (error) {
    return 0;
  }
}

module.exports = router;

