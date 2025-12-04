const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');

const DB_PATH = path.join(__dirname, '../../data/database.db');
const DATA_DIR = path.join(__dirname, '../../data');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

let db = null;

const init = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      createTables().then(resolve).catch(reject);
    });
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Projects table
      db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        youtube_channel_id TEXT,
        youtube_channel_name TEXT,
        clips_folder TEXT,
        audio_folder TEXT,
        thumbnails_folder TEXT,
        title_template TEXT,
        description_template TEXT,
        tags TEXT,
        videos_per_day INTEGER DEFAULT 1,
        upload_time TEXT DEFAULT '14:00',
        start_date TEXT,
        end_date TEXT,
        refresh_token TEXT,
        access_token TEXT,
        token_expiry INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Error creating projects table:', err);
          reject(err);
          return;
        }
      });

      // Videos table
      db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        clip_path TEXT NOT NULL,
        audio_path TEXT NOT NULL,
        thumbnail_path TEXT,
        output_path TEXT,
        title TEXT NOT NULL,
        description TEXT,
        tags TEXT,
        youtube_video_id TEXT,
        status TEXT DEFAULT 'pending',
        scheduled_date TEXT,
        uploaded_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating videos table:', err);
          reject(err);
          return;
        }
      });

      // Logs table
      db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        video_id INTEGER,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (video_id) REFERENCES videos(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating logs table:', err);
          reject(err);
          return;
        }
      });

      // Queue table
      db.run(`CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        video_id INTEGER,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (video_id) REFERENCES videos(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating queue table:', err);
          reject(err);
          return;
        }
      });

      // Create Videos table - Individual video configurations within a project
      db.run(`CREATE TABLE IF NOT EXISTS create_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        clips_folder TEXT,
        audio_folder TEXT,
        thumbnails_folder TEXT,
        title TEXT, -- JSON array for multiple titles
        description TEXT, -- JSON array for multiple descriptions
        tags TEXT,
        publish_time TEXT DEFAULT '07:00',
        videos_per_day INTEGER DEFAULT 1,
        start_date TEXT,
        end_date TEXT,
        is_unlimited INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft', -- draft, saved, published, scheduled
        schedule_type TEXT, -- portal, youtube, instant
        schedule_gap TEXT, -- daily, 2days, 3days, 4days, 5days, weekly (for portal schedule)
        youtube_video_id TEXT,
        scheduled_date TEXT,
        last_published_date TEXT, -- Last date when video was published (for portal schedule)
        clips_files TEXT, -- JSON array of uploaded clip file paths
        audio_files TEXT, -- JSON array of uploaded audio file paths
        thumbnail_files TEXT, -- JSON array of uploaded thumbnail file paths
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating create_videos table:', err);
          reject(err);
          return;
        }
        
        // Add new columns if they don't exist (migration)
        db.run(`ALTER TABLE create_videos ADD COLUMN schedule_gap TEXT`, () => {});
        db.run(`ALTER TABLE create_videos ADD COLUMN last_published_date TEXT`, () => {});
        db.run(`ALTER TABLE create_videos ADD COLUMN clips_files TEXT`, () => {});
        db.run(`ALTER TABLE create_videos ADD COLUMN audio_files TEXT`, () => {});
        db.run(`ALTER TABLE create_videos ADD COLUMN thumbnail_files TEXT`, () => {});
      });

      // Long Videos table - Merged videos from multiple create_videos
      db.run(`CREATE TABLE IF NOT EXISTS long_videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        title TEXT, -- JSON array for multiple titles
        description TEXT, -- JSON array for multiple descriptions
        tags TEXT,
        thumbnails_folder TEXT,
        create_video_sequence TEXT NOT NULL, -- JSON array of create_video IDs in order
        status TEXT DEFAULT 'draft', -- draft, saved, published, scheduled
        schedule_type TEXT, -- portal, youtube, instant
        publish_time TEXT, -- Publish time for portal schedule (IST)
        youtube_video_id TEXT,
        scheduled_date TEXT,
        last_published_date TEXT, -- Last date when video was published (for portal schedule)
        output_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating long_videos table:', err);
          reject(err);
          return;
        }
        
        // Add new columns if they don't exist (migration)
        db.run(`ALTER TABLE long_videos ADD COLUMN publish_time TEXT`, () => {});
        db.run(`ALTER TABLE long_videos ADD COLUMN last_published_date TEXT`, () => {});
        db.run(`ALTER TABLE long_videos ADD COLUMN thumbnails_folder TEXT`, () => {});
      });

      // Bulk Schedules table - For bulk scheduling multiple videos
      db.run(`CREATE TABLE IF NOT EXISTS bulk_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        create_video_id INTEGER,
        number_of_videos INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        publish_time TEXT DEFAULT '07:00',
        schedule_type TEXT DEFAULT 'youtube', -- portal or youtube
        status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (create_video_id) REFERENCES create_videos(id)
      )`, (err) => {
        if (err) {
          console.error('Error creating bulk_schedules table:', err);
          reject(err);
          return;
        }
        resolve();
      });
    });
  });
};

const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call init() first.');
  }
  return db;
};

const close = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

module.exports = {
  init,
  getDb,
  close
};

