const express = require('express');
const router = express.Router();
const db = require('../database/db');
const youtubeService = require('../services/youtubeService');

// Get OAuth URL
router.get('/auth-url/:projectId', (req, res) => {
  const { projectId } = req.params;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
  
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !REDIRECT_URI) {
    return res.status(500).json({ error: 'YouTube OAuth not configured' });
  }
  
  // Pass projectId as state parameter for OAuth callback
  const authUrl = youtubeService.getAuthUrl(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI, projectId);
  
  res.json({ authUrl, projectId });
});

// Handle OAuth callback (GET from Google redirect)
router.get('/auth-callback', async (req, res) => {
  const { code, state } = req.query;
  const projectId = state; // Use state parameter to pass projectId
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
  
  if (!code || !projectId) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Authentication Failed</h1>
          <p>Missing authorization code or project ID.</p>
          <p>Please try again from the project settings page.</p>
        </body>
      </html>
    `);
  }
  
  try {
    const tokens = await youtubeService.getTokensFromCode(code, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    
    if (!tokens.refresh_token) {
      return res.status(400).send(`
        <html>
          <body>
            <h1>Authentication Failed</h1>
            <p>No refresh token received. Please revoke access and try again.</p>
            <p>Make sure you select "consent" when authorizing.</p>
          </body>
        </html>
      `);
    }
    
    // Get channel info
    const channelInfo = await youtubeService.getChannelInfo(
      tokens.access_token,
      tokens.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
    
    // Update project with tokens and channel info
    const database = db.getDb();
    database.run(
      `UPDATE projects SET 
        refresh_token = ?,
        access_token = ?,
        token_expiry = ?,
        youtube_channel_id = ?,
        youtube_channel_name = ?
      WHERE id = ?`,
      [
        tokens.refresh_token,
        tokens.access_token,
        tokens.expiry_date,
        channelInfo.id,
        channelInfo.name,
        projectId
      ],
      function(err) {
        if (err) {
          return res.status(500).send(`
            <html>
              <body>
                <h1>Error</h1>
                <p>Failed to save authentication: ${err.message}</p>
              </body>
            </html>
          `);
        }
        res.send(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #28a745;">✓ Successfully Linked!</h1>
              <p>YouTube channel <strong>${channelInfo.name}</strong> has been linked to your project.</p>
              <p>You can close this window and return to the dashboard.</p>
              <script>
                setTimeout(() => {
                  window.close();
                }, 3000);
              </script>
            </body>
          </html>
        `);
      }
    );
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Authentication Error</h1>
          <p>${error.message}</p>
          <p>Please try again.</p>
        </body>
      </html>
    `);
  }
});

// Handle OAuth callback (POST for manual submission)
router.post('/auth-callback', async (req, res) => {
  const { code, projectId } = req.body;
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
  
  if (!code || !projectId) {
    return res.status(400).json({ error: 'Missing code or projectId' });
  }
  
  try {
    const tokens = await youtubeService.getTokensFromCode(code, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
    
    if (!tokens.refresh_token) {
      return res.status(400).json({ error: 'No refresh token received. Please revoke access and try again.' });
    }
    
    // Get channel info
    const channelInfo = await youtubeService.getChannelInfo(
      tokens.access_token,
      tokens.refresh_token,
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      REDIRECT_URI
    );
    
    // Update project with tokens and channel info
    const database = db.getDb();
    database.run(
      `UPDATE projects SET 
        refresh_token = ?,
        access_token = ?,
        token_expiry = ?,
        youtube_channel_id = ?,
        youtube_channel_name = ?
      WHERE id = ?`,
      [
        tokens.refresh_token,
        tokens.access_token,
        tokens.expiry_date,
        channelInfo.id,
        channelInfo.name,
        projectId
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          message: 'YouTube account linked successfully',
          channel: channelInfo
        });
      }
    );
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get channel info
router.get('/channel/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const database = db.getDb();
  
  database.get('SELECT * FROM projects WHERE id = ?', [projectId], async (err, project) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!project.refresh_token) {
      return res.status(400).json({ error: 'YouTube not authenticated' });
    }
    
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI } = process.env;
    
    try {
      const channelInfo = await youtubeService.getChannelInfo(
        project.access_token,
        project.refresh_token,
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        REDIRECT_URI
      );
      
      // Update tokens if refreshed
      if (channelInfo.newAccessToken) {
        database.run(
          `UPDATE projects SET 
            access_token = ?,
            token_expiry = ?
          WHERE id = ?`,
          [channelInfo.newAccessToken, channelInfo.newTokenExpiry, projectId]
        );
      }
      
      res.json(channelInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Unlink YouTube channel
router.post('/unlink/:projectId', (req, res) => {
  const { projectId } = req.params;
  const database = db.getDb();
  
  database.run(
    `UPDATE projects SET 
      refresh_token = NULL,
      access_token = NULL,
      token_expiry = NULL,
      youtube_channel_id = NULL,
      youtube_channel_name = NULL
    WHERE id = ?`,
    [projectId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'YouTube channel unlinked successfully' });
    }
  );
});

module.exports = router;

