const express = require('express');
const router = express.Router();
const db = require('../database/db');
const queueManager = require('../services/queueManager');

// Get queue status
router.get('/', (req, res) => {
  const database = db.getDb();
  
  database.all(
    `SELECT q.*, p.name as project_name 
     FROM queue q 
     JOIN projects p ON q.project_id = p.id 
     ORDER BY q.created_at DESC 
     LIMIT 50`,
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    }
  );
});

// Get queue stats
router.get('/stats', (req, res) => {
  const database = db.getDb();
  
  database.get(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
     FROM queue`,
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(row);
    }
  );
});

// Manually trigger video generation
router.post('/generate/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const { count = 1 } = req.body;
  
  try {
    for (let i = 0; i < count; i++) {
      await queueManager.addToQueue(projectId, null, 1); // Higher priority
    }
    res.json({ message: `${count} video(s) added to queue` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

