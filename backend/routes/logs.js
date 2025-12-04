const express = require('express');
const router = express.Router();
const db = require('../database/db');

// Get logs for a project
router.get('/project/:projectId', (req, res) => {
  const database = db.getDb();
  const { projectId } = req.params;
  const { type, limit = 100 } = req.query;
  
  let query = 'SELECT * FROM logs WHERE project_id = ?';
  const params = [projectId];
  
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  database.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get all logs
router.get('/', (req, res) => {
  const database = db.getDb();
  const { type, limit = 100 } = req.query;
  
  let query = 'SELECT * FROM logs';
  const params = [];
  
  if (type) {
    query += ' WHERE type = ?';
    params.push(type);
  }
  
  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  
  database.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;

