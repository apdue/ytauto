const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// YouTube API scopes - need multiple scopes for upload, channel info, and scheduling
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtubepartner'
];

/**
 * Get OAuth2 client
 */
const getOAuth2Client = (clientId, clientSecret, redirectUri) => {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

/**
 * Get authorization URL
 */
const getAuthUrl = (clientId, clientSecret, redirectUri, state = null) => {
  const oauth2Client = getOAuth2Client(clientId, clientSecret, redirectUri);
  const params = {
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  };
  if (state) {
    params.state = state;
  }
  return oauth2Client.generateAuthUrl(params);
};

/**
 * Get tokens from authorization code
 */
const getTokensFromCode = async (code, clientId, clientSecret, redirectUri) => {
  const oauth2Client = getOAuth2Client(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

/**
 * Get authenticated YouTube client
 */
const getYouTubeClient = (accessToken, refreshToken, clientId, clientSecret, redirectUri) => {
  const oauth2Client = getOAuth2Client(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  return google.youtube({ version: 'v3', auth: oauth2Client });
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken, clientId, clientSecret, redirectUri) => {
  const oauth2Client = getOAuth2Client(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials;
  } catch (error) {
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
};

/**
 * Get channel information
 */
const getChannelInfo = async (accessToken, refreshToken, clientId, clientSecret, redirectUri) => {
  try {
    const youtube = getYouTubeClient(accessToken, refreshToken, clientId, clientSecret, redirectUri);
    const response = await youtube.channels.list({
      part: 'snippet,contentDetails',
      mine: true
    });
    
    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      return {
        id: channel.id,
        name: channel.snippet.title,
        description: channel.snippet.description
      };
    }
    return null;
  } catch (error) {
    // Try refreshing token
    if (error.message.includes('invalid_grant') || error.message.includes('token')) {
      const credentials = await refreshAccessToken(refreshToken, clientId, clientSecret, redirectUri);
      const youtube = getYouTubeClient(credentials.access_token, refreshToken, clientId, clientSecret, redirectUri);
      const response = await youtube.channels.list({
        part: 'snippet,contentDetails',
        mine: true
      });
      
      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          id: channel.id,
          name: channel.snippet.title,
          description: channel.snippet.description,
          newAccessToken: credentials.access_token,
          newTokenExpiry: credentials.expiry_date
        };
      }
    }
    throw error;
  }
};

/**
 * Upload video to YouTube
 */
const uploadToYouTube = async (
  videoPath,
  thumbnailPath,
  title,
  description,
  tags,
  scheduledDate,
  accessToken,
  refreshToken,
  clientId,
  clientSecret,
  redirectUri,
  publishImmediately = false
) => {
  try {
    // Always refresh token first to ensure we have a valid one
    let accessTokenToUse = accessToken;
    let tokenExpiry = null;
    
    console.log('Refreshing access token before upload...');
    try {
      const credentials = await refreshAccessToken(refreshToken, clientId, clientSecret, redirectUri);
      accessTokenToUse = credentials.access_token;
      tokenExpiry = credentials.expiry_date;
      console.log('Token refreshed successfully');
    } catch (refreshError) {
      console.error('Token refresh failed, trying with existing token:', refreshError.message);
      // If refresh fails, try with existing token
      // But first verify it works
      try {
        const testYoutube = getYouTubeClient(accessToken, refreshToken, clientId, clientSecret, redirectUri);
        await testYoutube.channels.list({ part: 'id', mine: true });
        console.log('Existing token is valid');
      } catch (testError) {
        throw new Error(`Token validation failed: ${testError.message}. Please re-authenticate.`);
      }
    }

    const oauth2Client = getOAuth2Client(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({
      access_token: accessTokenToUse,
      refresh_token: refreshToken
    });
    
    // Auto-refresh if needed
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.access_token) {
        accessTokenToUse = tokens.access_token;
        tokenExpiry = tokens.expiry_date;
      }
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Prepare video metadata
    const videoMetadata = {
      snippet: {
        title: title,
        description: description || '',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        categoryId: '22' // People & Blogs
      },
      status: {
        privacyStatus: publishImmediately ? 'public' : (scheduledDate ? 'private' : 'public'), // Private if scheduled, public otherwise
        selfDeclaredMadeForKids: false
      }
    };

    // If scheduled date is provided and not publishing immediately, set publishAt
    if (scheduledDate && !publishImmediately) {
      videoMetadata.status.publishAt = new Date(scheduledDate).toISOString();
      videoMetadata.status.privacyStatus = 'private'; // Must be private for scheduled videos
    }

    // Upload video
    const response = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: videoMetadata,
      media: {
        body: fs.createReadStream(videoPath)
      }
    });

    const videoId = response.data.id;

    // Upload thumbnail if provided
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      try {
        await youtube.thumbnails.set({
          videoId: videoId,
          media: {
            body: fs.createReadStream(thumbnailPath)
          }
        });
      } catch (thumbnailError) {
        console.error('Thumbnail upload failed:', thumbnailError);
        // Don't fail the whole upload if thumbnail fails
      }
    }

    return {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      newAccessToken: accessTokenToUse !== accessToken ? accessTokenToUse : null,
      newTokenExpiry: tokenExpiry
    };
  } catch (error) {
    console.error('YouTube upload error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    
    // Provide more helpful error messages
    if (error.message.includes('Invalid Credentials') || error.message.includes('invalid_grant')) {
      throw new Error('Invalid Credentials: Please re-link your YouTube account. The access token may have expired.');
    }
    if (error.message.includes('insufficient')) {
      throw new Error('Insufficient permissions: Please ensure YouTube Data API v3 is enabled and all required scopes are granted.');
    }
    
    throw new Error(`YouTube upload failed: ${error.message}`);
  }
};

module.exports = {
  getAuthUrl,
  getTokensFromCode,
  getChannelInfo,
  uploadToYouTube,
  refreshAccessToken
};

