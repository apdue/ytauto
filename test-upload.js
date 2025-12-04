/**
 * Test script to upload a video to YouTube
 * Usage: node test-upload.js <projectId>
 */

require('dotenv').config();
const db = require('./backend/database/db');
const videoGenerator = require('./backend/services/videoGenerator');
const youtubeService = require('./backend/services/youtubeService');
const path = require('path');

const projectId = process.argv[2];

if (!projectId) {
  console.error('Usage: node test-upload.js <projectId>');
  process.exit(1);
}

async function testUpload() {
  try {
    await db.init();
    const database = db.getDb();

    // Get project
    const project = await new Promise((resolve, reject) => {
      database.get('SELECT * FROM projects WHERE id = ?', [projectId], (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Project not found'));
        resolve(row);
      });
    });

    console.log('Project:', project.name);
    console.log('YouTube Channel:', project.youtube_channel_name || 'Not linked');

    if (!project.refresh_token) {
      console.error('❌ YouTube account not linked!');
      process.exit(1);
    }

    // Get audio
    const audioPath = videoGenerator.getRandomFile(project.audio_folder, ['.mp3', '.wav', '.m4a', '.aac']);
    if (!audioPath) {
      console.error('❌ No audio files found');
      process.exit(1);
    }
    console.log('Audio:', audioPath);

    // Get audio duration
    const audioDuration = await videoGenerator.getVideoDuration(audioPath);
    console.log('Audio duration:', audioDuration.toFixed(2), 'seconds');

    // Get clips
    const allClips = await videoGenerator.getAllClipsWithDuration(project.clips_folder);
    if (allClips.length === 0) {
      console.error('❌ No clips found');
      process.exit(1);
    }
    console.log('Available clips:', allClips.length);

    // Select clips
    const selectedClips = videoGenerator.selectClipsForDuration(allClips, audioDuration);
    console.log('Selected clips:', selectedClips.length);

    // Get thumbnail
    const thumbnailPath = videoGenerator.getRandomImage(project.thumbnails_folder);
    console.log('Thumbnail:', thumbnailPath || 'None');

    // Generate video
    console.log('\n🎬 Generating video...');
    const { outputPath } = await videoGenerator.generateVideo(
      selectedClips,
      audioPath,
      thumbnailPath,
      { fadeIn: 1, fadeOut: 1, volume: 0.7, audioVolume: 0.5 }
    );
    console.log('✅ Video generated:', outputPath);

    // Upload to YouTube
    console.log('\n📤 Uploading to YouTube...');
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;

    const uploadResult = await youtubeService.uploadToYouTube(
      outputPath,
      thumbnailPath,
      `Test Video - ${new Date().toLocaleString()}`,
      'This is a test video uploaded via the Auto Video Create system.',
      'test, automation',
      null,
      project.access_token,
      project.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
      true // publish immediately
    );

    console.log('\n✅ Upload successful!');
    console.log('Video ID:', uploadResult.videoId);
    console.log('URL:', uploadResult.url);

    // Update project tokens if refreshed
    if (uploadResult.newAccessToken) {
      database.run(
        `UPDATE projects SET access_token = ?, token_expiry = ? WHERE id = ?`,
        [uploadResult.newAccessToken, uploadResult.newTokenExpiry, projectId]
      );
      console.log('✅ Tokens updated in database');
    }

    // Clean up
    const fs = require('fs-extra');
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log('✅ Cleaned up generated video file');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testUpload();

