const cron = require('node-cron');
const db = require('../database/db');
const queueManager = require('./queueManager');
const videoGenerator = require('./videoGenerator');
const youtubeService = require('./youtubeService');
const fs = require('fs-extra');

/**
 * Check if project should generate videos today
 */
const shouldGenerateToday = (project) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(project.start_date);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(project.end_date);
  endDate.setHours(23, 59, 59, 999);
  
  // Check if today is within date range
  if (today < startDate || today > endDate) {
    return false;
  }
  
  // Check if project is active
  if (!project.is_active) {
    return false;
  }
  
  // Check if YouTube is authenticated
  if (!project.refresh_token) {
    return false;
  }
  
  // Check if we have clips and audio
  const hasClips = videoGenerator.getRandomFile(project.clips_folder) !== null;
  const hasAudio = videoGenerator.getRandomFile(project.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']) !== null;
  
  if (!hasClips || !hasAudio) {
    return false;
  }
  
  return true;
};

/**
 * Get videos generated today for project
 */
const getVideosGeneratedToday = (projectId) => {
  return new Promise((resolve, reject) => {
    const database = db.getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    database.get(
      `SELECT COUNT(*) as count FROM videos 
       WHERE project_id = ? AND DATE(created_at) = DATE(?)`,
      [projectId, today.toISOString()],
      (err, row) => {
        if (err) return reject(err);
        resolve(row.count || 0);
      }
    );
  });
};

/**
 * Generate videos for a project
 */
const generateVideosForProject = async (project) => {
  try {
    const videosGeneratedToday = await getVideosGeneratedToday(project.id);
    const videosPerDay = project.videos_per_day || 1;
    const videosNeeded = videosPerDay - videosGeneratedToday;
    
    if (videosNeeded <= 0) {
      console.log(`Project ${project.name}: Already generated ${videosGeneratedToday} videos today`);
      return;
    }
    
    console.log(`Project ${project.name}: Generating ${videosNeeded} videos`);
    
    // Add videos to queue
    for (let i = 0; i < videosNeeded; i++) {
      await queueManager.addToQueue(project.id, null, 0);
    }
  } catch (error) {
    console.error(`Error generating videos for project ${project.name}:`, error);
  }
};

/**
 * Daily check for all projects
 */
const dailyCheck = async () => {
  console.log('Running daily check for all projects...');
  
  const database = db.getDb();
  database.all('SELECT * FROM projects WHERE is_active = 1', async (err, projects) => {
    if (err) {
      console.error('Error fetching projects:', err);
      return;
    }
    
    for (const project of projects) {
      if (shouldGenerateToday(project)) {
        await generateVideosForProject(project);
      } else {
        console.log(`Project ${project.name}: Skipping (outside date range or missing resources)`);
      }
    }
  });
};

/**
 * Check if create video should publish today based on schedule_gap
 */
const shouldPublishToday = (createVideo) => {
  if (!createVideo.schedule_gap) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Get the last published date or start date
  let lastPublishDate = null;
  if (createVideo.last_published_date) {
    lastPublishDate = new Date(createVideo.last_published_date);
    lastPublishDate.setHours(0, 0, 0, 0);
  } else if (createVideo.start_date) {
    lastPublishDate = new Date(createVideo.start_date);
    lastPublishDate.setHours(0, 0, 0, 0);
  } else {
    // If no start date, publish today
    return true;
  }

  const daysSinceLastPublish = Math.floor((today - lastPublishDate) / (1000 * 60 * 60 * 24));

  switch (createVideo.schedule_gap) {
    case 'daily':
      return daysSinceLastPublish >= 1;
    case '2days':
      return daysSinceLastPublish >= 2;
    case '3days':
      return daysSinceLastPublish >= 3;
    case '4days':
      return daysSinceLastPublish >= 4;
    case '5days':
      return daysSinceLastPublish >= 5;
    case 'weekly':
      return daysSinceLastPublish >= 7;
    default:
      return false;
  }
};

/**
 * Check if current IST time matches publish_time (within 1 minute window)
 */
const isPublishTime = (createVideo) => {
  if (!createVideo.publish_time) return false;

  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const istNow = new Date(now.getTime() + istOffset);

  const [hours, minutes] = createVideo.publish_time.split(':').map(Number);
  const publishTime = new Date(istNow);
  publishTime.setHours(hours, minutes, 0, 0);

  // Check if current time is within 1 minute of publish time
  const diffMinutes = Math.abs((istNow - publishTime) / (1000 * 60));
  return diffMinutes <= 1;
};

/**
 * Generate and publish video for portal schedule
 */
const generateAndPublishVideo = async (createVideo, project) => {
  try {
    const database = db.getDb();
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

    // Parse JSON arrays
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
    const clipsFiles = parseJSON(createVideo.clips_files);
    const audioFiles = parseJSON(createVideo.audio_files);
    const thumbnailFiles = parseJSON(createVideo.thumbnail_files);

    // Random select from arrays
    const selectedTitle = titles.length > 0 ? titles[Math.floor(Math.random() * titles.length)] : 'Untitled Video';
    const selectedDescription = descriptions.length > 0 ? descriptions[Math.floor(Math.random() * descriptions.length)] : '';

    // Get random files
    let audioPath, thumbnailPath;
    
    if (audioFiles.length > 0) {
      const randomAudio = audioFiles[Math.floor(Math.random() * audioFiles.length)];
      audioPath = typeof randomAudio === 'string' ? randomAudio : randomAudio.path || randomAudio;
    } else {
      audioPath = videoGenerator.getRandomFile(createVideo.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      throw new Error('No audio file found');
    }

    const audioDuration = await videoGenerator.getVideoDuration(audioPath);

    // Get clips
    let allClips = [];
    if (clipsFiles.length > 0) {
      for (const clipFile of clipsFiles) {
        const clipPath = typeof clipFile === 'string' ? clipFile : clipFile.path || clipFile;
        if (fs.existsSync(clipPath)) {
          const duration = await videoGenerator.getVideoDuration(clipPath);
          allClips.push({ path: clipPath, duration });
        }
      }
    } else {
      allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
    }

    if (allClips.length === 0) {
      throw new Error('No clips found');
    }

    const selectedClips = videoGenerator.selectClipsForDuration(allClips, audioDuration);

    if (thumbnailFiles.length > 0) {
      const randomThumbnail = thumbnailFiles[Math.floor(Math.random() * thumbnailFiles.length)];
      thumbnailPath = typeof randomThumbnail === 'string' ? randomThumbnail : randomThumbnail.path || randomThumbnail;
    } else {
      thumbnailPath = videoGenerator.getRandomImage(createVideo.thumbnails_folder);
    }

    // Generate video
    const { outputPath } = await videoGenerator.generateVideo(
      selectedClips,
      audioPath,
      thumbnailPath,
      { fadeIn: 1, fadeOut: 1, volume: 0.7, audioVolume: 0.5 }
    );

    // Upload to YouTube immediately
    const uploadResult = await youtubeService.uploadToYouTube(
      outputPath,
      thumbnailPath,
      selectedTitle,
      selectedDescription,
      createVideo.tags || '',
      null, // No scheduled date for portal
      project.access_token,
      project.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
      true // Publish immediately
    );

    // Update project tokens if refreshed
    if (uploadResult.newAccessToken) {
      database.run(
        `UPDATE projects SET access_token = ?, token_expiry = ? WHERE id = ?`,
        [uploadResult.newAccessToken, uploadResult.newTokenExpiry, project.id]
      );
    }

    // Update create video with last published date
    const today = new Date().toISOString().split('T')[0];
    database.run(
      `UPDATE create_videos SET 
        last_published_date = ?,
        youtube_video_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [today, uploadResult.videoId, createVideo.id]
    );

    // Log to logs table
    database.run(
      `INSERT INTO logs (project_id, message, type, created_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        project.id,
        `Portal schedule: Published video "${selectedTitle}" (${uploadResult.videoId})`,
        'success'
      ]
    );

    console.log(`Portal schedule: Published video "${selectedTitle}" for create_video ${createVideo.id}`);
    return uploadResult;
  } catch (error) {
    console.error(`Error generating and publishing video for create_video ${createVideo.id}:`, error);
    
    // Log error
    const database = db.getDb();
    database.run(
      `INSERT INTO logs (project_id, message, type, created_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        createVideo.project_id,
        `Portal schedule error: ${error.message}`,
        'error'
      ]
    );
    
    throw error;
  }
};

/**
 * Generate and publish long video for portal schedule
 */
const generateAndPublishLongVideo = async (longVideo, project) => {
  try {
    const database = db.getDb();
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
    const path = require('path');
    const { execSync } = require('child_process');

    // Parse JSON arrays
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

    // Random select from arrays
    const selectedTitle = titles.length > 0 ? titles[Math.floor(Math.random() * titles.length)] : 'Untitled Long Video';
    const selectedDescription = descriptions.length > 0 ? descriptions[Math.floor(Math.random() * descriptions.length)] : '';

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
      const audioPath = videoGenerator.getRandomFile(createVideo.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
      if (!audioPath) {
        throw new Error(`No audio files in ${createVideo.audio_folder}`);
      }

      const audioDuration = await videoGenerator.getVideoDuration(audioPath);
      const allClips = await videoGenerator.getAllClipsWithDuration(createVideo.clips_folder);
      if (allClips.length === 0) {
        throw new Error(`No clips in ${createVideo.clips_folder}`);
      }

      const selectedClips = videoGenerator.selectClipsForDuration(allClips, audioDuration);
      const thumbnailPath = videoGenerator.getRandomImage(createVideo.thumbnails_folder);

      const { outputPath } = await videoGenerator.generateVideo(
        selectedClips,
        audioPath,
        thumbnailPath,
        { fadeIn: 1, fadeOut: 1, volume: 0.7, audioVolume: 0.5 }
      );

      generatedVideoPaths.push(outputPath);
    }

    // Merge all videos into one long video
    const finalOutputPath = path.join(path.dirname(generatedVideoPaths[0]), `long_video_${require('uuid').v4()}.mp4`);
    
    const concatFile = path.join('/tmp', `concat_long_${require('uuid').v4()}.txt`);
    const concatContent = generatedVideoPaths.map(p => `file '${p}'`).join('\n');
    fs.writeFileSync(concatFile, concatContent);

    const tempOutput = path.join('/tmp', `long_temp_${require('uuid').v4()}.mp4`);
    
    execSync(`ffmpeg -f concat -safe 0 -i '${concatFile}' -c copy -y '${tempOutput}'`, {
      stdio: 'ignore',
      maxBuffer: 10 * 1024 * 1024
    });

    fs.moveSync(tempOutput, finalOutputPath, { overwrite: true });
    fs.unlinkSync(concatFile);

    // Get thumbnail
    const thumbnailFolder = longVideo.thumbnails_folder || project.thumbnails_folder;
    const thumbnailPath = videoGenerator.getRandomImage(thumbnailFolder);

    // Upload to YouTube immediately
    const uploadResult = await youtubeService.uploadToYouTube(
      finalOutputPath,
      thumbnailPath,
      selectedTitle,
      selectedDescription,
      longVideo.tags || '',
      null, // No scheduled date for portal
      project.access_token,
      project.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
      true // Publish immediately
    );

    // Update project tokens if refreshed
    if (uploadResult.newAccessToken) {
      database.run(
        `UPDATE projects SET access_token = ?, token_expiry = ? WHERE id = ?`,
        [uploadResult.newAccessToken, uploadResult.newTokenExpiry, project.id]
      );
    }

    // Update long video with last published date
    const today = new Date().toISOString().split('T')[0];
    database.run(
      `UPDATE long_videos SET 
        last_published_date = ?,
        youtube_video_id = ?,
        output_path = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [today, uploadResult.videoId, finalOutputPath, longVideo.id]
    );

    // Log to logs table
    database.run(
      `INSERT INTO logs (project_id, message, type, created_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        project.id,
        `Portal schedule: Published long video "${selectedTitle}" (${uploadResult.videoId})`,
        'success'
      ]
    );

    console.log(`Portal schedule: Published long video "${selectedTitle}" for long_video ${longVideo.id}`);
    return uploadResult;
  } catch (error) {
    console.error(`Error generating and publishing long video for long_video ${longVideo.id}:`, error);
    
    // Log error
    const database = db.getDb();
    database.run(
      `INSERT INTO logs (project_id, message, type, created_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        longVideo.project_id,
        `Portal schedule error (long video): ${error.message}`,
        'error'
      ]
    );
    
    throw error;
  }
};

/**
 * Process portal schedule - check all scheduled create_videos and long_videos
 */
const processPortalSchedule = async () => {
  const database = db.getDb();
  
  // Process create videos
  database.all(
    `SELECT cv.*, 
            p.id as project_id_full,
            p.refresh_token, 
            p.access_token, 
            p.youtube_channel_id, 
            p.youtube_channel_name
     FROM create_videos cv
     JOIN projects p ON cv.project_id = p.id
     WHERE cv.status = 'scheduled' 
     AND cv.schedule_type = 'portal'
     AND p.refresh_token IS NOT NULL`,
    async (err, createVideos) => {
      if (err) {
        console.error('Error fetching portal scheduled videos:', err);
        return;
      }

      for (const createVideo of createVideos) {
        try {
          // Check if should publish today
          if (!shouldPublishToday(createVideo)) {
            continue;
          }

          // Check if it's publish time
          if (!isPublishTime(createVideo)) {
            continue;
          }

          // Check videos per day limit
          const today = new Date().toISOString().split('T')[0];
          const videosPublishedToday = await new Promise((resolve, reject) => {
            database.get(
              `SELECT COUNT(*) as count FROM create_videos 
               WHERE id = ? AND DATE(last_published_date) = ?`,
              [createVideo.id, today],
              (err, row) => {
                if (err) return reject(err);
                resolve(row?.count || 0);
              }
            );
          });

          if (videosPublishedToday >= (createVideo.videos_per_day || 1)) {
            console.log(`Create video ${createVideo.id}: Already published ${videosPublishedToday} videos today`);
            continue;
          }

          // Generate and publish
          const project = {
            id: createVideo.project_id || createVideo.project_id_full,
            refresh_token: createVideo.refresh_token,
            access_token: createVideo.access_token,
            youtube_channel_id: createVideo.youtube_channel_id,
            youtube_channel_name: createVideo.youtube_channel_name
          };

          await generateAndPublishVideo(createVideo, project);
        } catch (error) {
          console.error(`Error processing portal schedule for create_video ${createVideo.id}:`, error);
        }
      }
    }
  );

  // Process long videos
  database.all(
    `SELECT lv.*, 
            p.id as project_id_full,
            p.refresh_token, 
            p.access_token, 
            p.youtube_channel_id, 
            p.youtube_channel_name
     FROM long_videos lv
     JOIN projects p ON lv.project_id = p.id
     WHERE lv.status = 'scheduled' 
     AND lv.schedule_type = 'portal'
     AND p.refresh_token IS NOT NULL
     AND lv.publish_time IS NOT NULL`,
    async (err, longVideos) => {
      if (err) {
        console.error('Error fetching portal scheduled long videos:', err);
        return;
      }

      for (const longVideo of longVideos) {
        try {
          // Check if it's publish time
          if (!isPublishTime(longVideo)) {
            continue;
          }

          // Check if already published today
          const today = new Date().toISOString().split('T')[0];
          if (longVideo.last_published_date === today) {
            console.log(`Long video ${longVideo.id}: Already published today`);
            continue;
          }

          // Generate and publish
          const project = {
            id: longVideo.project_id || longVideo.project_id_full,
            refresh_token: longVideo.refresh_token,
            access_token: longVideo.access_token,
            youtube_channel_id: longVideo.youtube_channel_id,
            youtube_channel_name: longVideo.youtube_channel_name
          };

          await generateAndPublishLongVideo(longVideo, project);
        } catch (error) {
          console.error(`Error processing portal schedule for long_video ${longVideo.id}:`, error);
        }
      }
    }
  );
};

/**
 * Start scheduler
 */
const start = () => {
  // Run daily check at 1 AM
  cron.schedule('0 1 * * *', () => {
    dailyCheck();
  });
  
  // Run portal schedule check every minute
  cron.schedule('* * * * *', () => {
    processPortalSchedule();
  });
  
  // Also run immediately on startup
  setTimeout(() => {
    dailyCheck();
  }, 10000); // Wait 10 seconds for DB to be ready
  
  console.log('Scheduler started - will run daily at 1 AM and portal schedule every minute');
};

module.exports = {
  start,
  dailyCheck,
  generateVideosForProject,
  processPortalSchedule,
  shouldPublishToday,
  isPublishTime,
  generateAndPublishVideo,
  generateAndPublishLongVideo
};

