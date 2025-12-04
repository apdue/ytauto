const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');

const OUTPUT_DIR = path.join(__dirname, '../../data/output');

// Ensure output directory exists
fs.ensureDirSync(OUTPUT_DIR);

/**
 * Merge video clip with audio file
 * @param {string} clipPath - Path to video clip
 * @param {string} audioPath - Path to audio file
 * @param {string} outputPath - Path for output video
 * @param {Object} options - Options for video processing
 * @returns {Promise<string>} - Path to generated video
 */
const mergeVideo = (clipPath, audioPath, outputPath, options = {}) => {
  return new Promise((resolve, reject) => {
    // Validate inputs
    if (!fs.existsSync(clipPath)) {
      return reject(new Error(`Clip file not found: ${clipPath}`));
    }
    if (!fs.existsSync(audioPath)) {
      return reject(new Error(`Audio file not found: ${audioPath}`));
    }

    const {
      fadeIn = 1,
      fadeOut = 1,
      volume = 0.7,
      audioVolume = 0.5
    } = options;

    // Get audio duration first
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to probe audio: ${err.message}`));
      }

      const audioDuration = metadata.format.duration;
      
      // Get video duration
      ffmpeg.ffprobe(clipPath, (err, videoMetadata) => {
        if (err) {
          return reject(new Error(`Failed to probe video: ${err.message}`));
        }

        const videoDuration = videoMetadata.format.duration;
        const hasVideoAudio = videoMetadata.streams && videoMetadata.streams.some(s => s.codec_type === 'audio');
        const targetDuration = Math.min(audioDuration, videoDuration);

        // Build FFmpeg command
        let command = ffmpeg(clipPath)
          .input(audioPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset medium',
            '-crf 23',
            '-pix_fmt yuv420p',
            '-movflags +faststart'
          ])
          .size('1920x1080')
          .fps(30)
          .duration(targetDuration);

        // Add fade in/out
        let videoFilters = [];
        if (fadeIn > 0) {
          videoFilters.push(`fade=t=in:st=0:d=${fadeIn}`);
        }
        if (fadeOut > 0 && targetDuration > fadeOut) {
          videoFilters.push(`fade=t=out:st=${targetDuration - fadeOut}:d=${fadeOut}`);
        }
        
        if (videoFilters.length > 0) {
          command = command.videoFilters(videoFilters.join(','));
        }

        // Audio handling: mix video audio (if exists) with background audio
        if (hasVideoAudio) {
          // Mix both audio tracks
          command = command
            .complexFilter([
              `[0:a]volume=${volume}[vidaudio]`,
              `[1:a]volume=${audioVolume}[bgaudio]`,
              `[vidaudio][bgaudio]amix=inputs=2:duration=shortest:dropout_transition=2[audioout]`
            ])
            .outputOptions('-map 0:v')
            .outputOptions('-map [audioout]');
        } else {
          // Use only background audio
          command = command
            .outputOptions(`-filter:a volume=${audioVolume}`)
            .outputOptions('-map 0:v')
            .outputOptions('-map 1:a');
        }

        // If video is shorter than audio, loop it
        if (videoDuration < audioDuration) {
          command = command
            .inputOptions('-stream_loop -1')
            .outputOptions('-shortest');
        }

        // Execute
        command
          .on('start', (commandLine) => {
            console.log('FFmpeg command:', commandLine);
          })
          .on('progress', (progress) => {
            console.log(`Processing: ${Math.round(progress.percent || 0)}%`);
          })
          .on('end', () => {
            console.log('Video generation completed');
            resolve(outputPath);
          })
          .on('error', (err) => {
            console.error('FFmpeg error:', err);
            reject(new Error(`Video generation failed: ${err.message}`));
          })
          .save(outputPath);
      });
    });
  });
};

/**
 * Merge multiple video clips with audio file (concatenate clips to match audio duration)
 */
const mergeVideoWithClips = (clipPaths, audioPath, outputPath, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!clipPaths || clipPaths.length === 0) {
      return reject(new Error('No clips provided'));
    }
    if (!fs.existsSync(audioPath)) {
      return reject(new Error(`Audio file not found: ${audioPath}`));
    }
    
    // Resolve to absolute path and normalize to handle spaces
    const absoluteOutputPath = path.resolve(outputPath);
    const normalizedOutputPath = path.normalize(absoluteOutputPath);
    
    // Ensure output directory exists
    const outputDir = path.dirname(normalizedOutputPath);
    fs.ensureDirSync(outputDir);
    
    // Use /tmp directory (no spaces) for temp file to avoid FFmpeg path issues
    const tempFilename = `video_${uuidv4()}.mp4`;
    const tempOutputPath = path.join('/tmp', tempFilename);
    
    console.log('Output path:', normalizedOutputPath);
    console.log('Temp path:', tempOutputPath);

    const {
      fadeIn = 1,
      fadeOut = 1,
      volume = 0.7,
      audioVolume = 0.5
    } = options;

    // Get audio duration first
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`Failed to probe audio: ${err.message}`));
      }

      const audioDuration = metadata.format.duration;
      
      // Use concat demuxer for better handling of many inputs and paths with spaces
      // Create a temporary concat file in /tmp to avoid path issues
      const concatListPath = path.join('/tmp', `concat_${uuidv4()}.txt`);
      const concatListContent = clipPaths
        .filter(clipPath => fs.existsSync(clipPath))
        .map(clipPath => {
          // Escape single quotes and wrap in quotes for paths with spaces
          const escapedPath = clipPath.replace(/'/g, "'\\''");
          return `file '${escapedPath}'`;
        })
        .join('\n');
      
      fs.writeFileSync(concatListPath, concatListContent);
      console.log('Concat file created at:', concatListPath);
      
      // Build FFmpeg command using concat demuxer
      // Use absolute path for concat file
      // For audio path with spaces, use inputOptions to ensure proper handling
      let command = ffmpeg(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .input(audioPath)
        .inputOptions(['-i', audioPath]); // Explicitly add as input option to ensure proper quoting
      
      // Check if any clip has audio
      let hasVideoAudio = false;
      Promise.all(clipPaths.map(clipPath => {
        return new Promise((resolve) => {
          ffmpeg.ffprobe(clipPath, (err, metadata) => {
            if (!err && metadata.streams && metadata.streams.some(s => s.codec_type === 'audio')) {
              hasVideoAudio = true;
            }
            resolve();
          });
        });
      })).then(() => {
        // Build complex filter
        const filters = [];
        
        if (hasVideoAudio) {
          // Mix video audio with background audio
          filters.push(`[0:a]volume=${volume}[vidaudio]`);
          filters.push(`[1:a]volume=${audioVolume}[bgaudio]`);
          filters.push(`[vidaudio][bgaudio]amix=inputs=2:duration=shortest:dropout_transition=2[audioout]`);
        } else {
          // Use only background audio
          filters.push(`[1:a]volume=${audioVolume}[audioout]`);
        }
        
        // Add fade in/out
        if (fadeIn > 0) {
          filters.push(`[0:v]fade=t=in:st=0:d=${fadeIn}[fadein]`);
        }
        if (fadeOut > 0 && audioDuration > fadeOut) {
          const fadeStart = audioDuration - fadeOut;
          filters.push(`[${fadeIn > 0 ? 'fadein' : '0:v'}]fade=t=out:st=${fadeStart}:d=${fadeOut}[finalv]`);
        }
        
        const finalVideo = (fadeIn > 0 || fadeOut > 0) ? 'finalv' : '0:v';
        
        // Build FFmpeg command manually with proper quoting to avoid fluent-ffmpeg path issues
        const filterComplex = filters.join(';');
        const ffmpegCmd = `ffmpeg -f concat -safe 0 -i '${concatListPath}' -i '${audioPath}' -filter_complex '${filterComplex}' -map '[${finalVideo}]' -map '[audioout]' -vcodec libx264 -acodec aac -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart -shortest -t ${audioDuration} -r 30 -s 1920x1080 -y '${tempOutputPath}'`;
        
        console.log('Executing FFmpeg command with proper quoting...');
        console.log('Command:', ffmpegCmd);
        
        // Execute FFmpeg directly with proper quoting
        try {
          execSync(ffmpegCmd, { 
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
          });
          
          // Clean up concat list file
          try {
            fs.unlinkSync(concatListPath);
          } catch (e) {
            console.warn('Failed to delete concat list file:', e);
          }
          
          // Move temp file to final location
          if (fs.existsSync(tempOutputPath)) {
            fs.moveSync(tempOutputPath, normalizedOutputPath, { overwrite: true });
            console.log('Video generation completed');
            resolve(normalizedOutputPath);
          } else {
            reject(new Error('Temp output file not found'));
          }
        } catch (execErr) {
          // Clean up concat list file on error
          try {
            fs.unlinkSync(concatListPath);
          } catch (e) {
            // Ignore cleanup errors
          }
          // Clean up temp file on error
          try {
            if (fs.existsSync(tempOutputPath)) {
              fs.unlinkSync(tempOutputPath);
            }
          } catch (e) {
            // Ignore cleanup errors
          }
          console.error('FFmpeg execution error:', execErr.message);
          console.error('Output path:', normalizedOutputPath);
          console.error('Temp path:', tempOutputPath);
          reject(new Error(`Video generation failed: ${execErr.message}`));
        }
      });
    });
  });
};

/**
 * Generate video with all processing
 * @param {string|string[]} clipPathOrPaths - Single clip path or array of clip paths
 * @param {string} audioPath - Path to audio file
 * @param {string} thumbnailPath - Path to thumbnail (optional)
 * @param {Object} options - Processing options
 */
const generateVideo = async (clipPathOrPaths, audioPath, thumbnailPath = null, options = {}) => {
  const outputFilename = `video_${uuidv4()}.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  
  // Resolve to absolute path and normalize to handle spaces
  const absoluteOutputPath = path.resolve(outputPath);
  const normalizedOutputPath = path.normalize(absoluteOutputPath);

  try {
    // Ensure output directory exists and is writable
    fs.ensureDirSync(OUTPUT_DIR);
    
    console.log('Generating video to:', normalizedOutputPath);
    console.log('Will use temp file first to avoid path issues');
    
    // Handle both single clip and multiple clips
    const clipPaths = Array.isArray(clipPathOrPaths) ? clipPathOrPaths : [clipPathOrPaths];
    await mergeVideoWithClips(clipPaths, audioPath, normalizedOutputPath, options);
    
    return {
      outputPath: normalizedOutputPath,
      thumbnailPath,
      duration: await getVideoDuration(normalizedOutputPath)
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get video duration
 */
const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration);
    });
  });
};

/**
 * Get all files from directory with their durations
 */
const getAllClipsWithDuration = async (dirPath, extensions = ['.mp4', '.mov', '.avi', '.mkv']) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(dirPath).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext) && fs.statSync(path.join(dirPath, file)).isFile();
    });
    
    const clipsWithDuration = [];
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      try {
        const duration = await getVideoDuration(filePath);
        clipsWithDuration.push({ path: filePath, duration });
      } catch (error) {
        console.error(`Error getting duration for ${file}:`, error);
      }
    }
    return clipsWithDuration;
  } catch (error) {
    console.error('Error getting clips:', error);
    return [];
  }
};

/**
 * Select random clips to match audio duration (no repeat until all used)
 */
const selectClipsForDuration = (clips, targetDuration) => {
  if (clips.length === 0) {
    return [];
  }
  
  // Shuffle clips randomly
  const shuffled = [...clips].sort(() => Math.random() - 0.5);
  const selected = [];
  let totalDuration = 0;
  let clipIndex = 0;
  
  while (totalDuration < targetDuration && shuffled.length > 0) {
    // If we've used all clips, reshuffle and start over
    if (clipIndex >= shuffled.length) {
      clipIndex = 0;
      // Reshuffle for next round
      shuffled.sort(() => Math.random() - 0.5);
    }
    
    const clip = shuffled[clipIndex];
    selected.push(clip.path);
    totalDuration += clip.duration;
    clipIndex++;
  }
  
  return selected;
};

/**
 * Get random file from directory (for backward compatibility)
 */
const getRandomFile = (dirPath, extensions = ['.mp4', '.mov', '.avi', '.mkv']) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return null;
    }
    const files = fs.readdirSync(dirPath).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext) && fs.statSync(path.join(dirPath, file)).isFile();
    });
    if (files.length === 0) {
      return null;
    }
    const randomFile = files[Math.floor(Math.random() * files.length)];
    return path.join(dirPath, randomFile);
  } catch (error) {
    console.error('Error getting random file:', error);
    return null;
  }
};

/**
 * Get random image from directory
 */
const getRandomImage = (dirPath, extensions = ['.jpg', '.jpeg', '.png', '.webp']) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return null;
    }
    const files = fs.readdirSync(dirPath).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext) && fs.statSync(path.join(dirPath, file)).isFile();
    });
    if (files.length === 0) {
      return null;
    }
    const randomFile = files[Math.floor(Math.random() * files.length)];
    return path.join(dirPath, randomFile);
  } catch (error) {
    console.error('Error getting random image:', error);
    return null;
  }
};

module.exports = {
  mergeVideo,
  mergeVideoWithClips,
  generateVideo,
  getVideoDuration,
  getRandomFile,
  getAllClipsWithDuration,
  selectClipsForDuration,
  getRandomImage
};

