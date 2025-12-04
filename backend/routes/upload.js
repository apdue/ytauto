const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');

// Configure storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { projectId, createVideoId, type } = req.params; // type: clips, audio, thumbnails
    // Use 'temp' if createVideoId is 'temp' or not provided
    const cvId = createVideoId === 'temp' ? 'temp' : createVideoId;
    const uploadDir = path.join(__dirname, '../../data/uploads', projectId || 'temp', cvId, type || 'temp');
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  },
  fileFilter: (req, file, cb) => {
    const { type } = req.params;
    let allowedExtensions = [];

    if (type === 'clips') {
      allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    } else if (type === 'audio') {
      allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac', '.ogg'];
    } else if (type === 'thumbnails') {
      allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    }

    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`));
    }
  }
});

// Upload files for Create Video or Long Video
router.post('/:projectId/:createVideoId/:type', upload.array('files', 50), async (req, res) => {
  try {
    const { projectId, createVideoId, type } = req.params;
    const cvId = createVideoId === 'temp' ? 'temp' : createVideoId;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedFiles = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path,
      size: file.size
    }));

    res.json({
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles,
      folder: path.dirname(req.files[0].path)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uploaded files
router.get('/:projectId/:createVideoId/:type', async (req, res) => {
  try {
    const { projectId, createVideoId, type } = req.params;
    const cvId = createVideoId === 'temp' ? 'temp' : createVideoId;
    const uploadDir = path.join(__dirname, '../../data/uploads', projectId, cvId, type);
    
    if (!fs.existsSync(uploadDir)) {
      return res.json({ files: [], folder: uploadDir });
    }

    const files = fs.readdirSync(uploadDir).map(filename => {
      const filePath = path.join(uploadDir, filename);
      const stats = fs.statSync(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        created: stats.birthtime
      };
    });

    res.json({ files, folder: uploadDir });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
router.delete('/:projectId/:createVideoId/:type/:filename', async (req, res) => {
  try {
    const { projectId, createVideoId, type, filename } = req.params;
    const cvId = createVideoId === 'temp' ? 'temp' : createVideoId;
    const filePath = path.join(__dirname, '../../data/uploads', projectId, cvId, type, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

