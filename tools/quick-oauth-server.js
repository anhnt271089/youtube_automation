#!/usr/bin/env node

/**
 * Quick OAuth server for Google authentication
 */

import { createServer } from 'http';
import { URL } from 'url';
import axios from 'axios';
import fs from 'fs';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';
const PORT = 3000;

// Create the server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>❌ Authorization Error</h1>
            <p>Error: ${error}</p>
            <p>Please try again.</p>
          </body>
        </html>
      `);
      return;
    }

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>❌ No Authorization Code</h1>
            <p>No authorization code received.</p>
          </body>
        </html>
      `);
      return;
    }

    try {
      console.log('🔄 Exchanging authorization code for tokens...');

      const response = await axios.post('https://oauth2.googleapis.com/token', {
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      });

      const { access_token, refresh_token } = response.data;

      console.log('✅ Successfully got tokens!');

      // Update .env file
      const envPath = '.env';
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Update tokens in .env
      if (envContent.includes('GOOGLE_ACCESS_TOKEN=')) {
        envContent = envContent.replace(/GOOGLE_ACCESS_TOKEN=.*/, `GOOGLE_ACCESS_TOKEN=${access_token}`);
      } else {
        envContent += `\nGOOGLE_ACCESS_TOKEN=${access_token}`;
      }

      if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
        envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refresh_token}`);
      } else {
        envContent += `\nGOOGLE_REFRESH_TOKEN=${refresh_token}`;
      }

      fs.writeFileSync(envPath, envContent);
      console.log('✅ .env file updated!');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>✅ Success!</h1>
            <p>Google OAuth tokens have been obtained and saved to .env file.</p>
            <p>Your YouTube automation system is now authorized to access Google Sheets and Drive.</p>
            <p><strong>You can close this window.</strong></p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);

      // Close server after success
      setTimeout(() => {
        console.log('🎉 OAuth setup complete! Closing server...');
        server.close();
        process.exit(0);
      }, 5000);

    } catch (error) {
      console.error('❌ Error exchanging tokens:', error.response?.data || error.message);

      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body>
            <h1>❌ Token Exchange Error</h1>
            <p>Error: ${error.message}</p>
            <p>Please try again.</p>
          </body>
        </html>
      `);
    }
  } else {
    // Show instructions
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
        <body>
          <h1>🔐 Google OAuth Setup</h1>
          <p>Server is running and ready for OAuth callback.</p>
          <p><strong>Click this link to authorize:</strong></p>
          <p><a href="${getAuthUrl()}" target="_blank">Authorize YouTube Automation</a></p>
          <p>Or copy this URL to your browser:</p>
          <p><code>${getAuthUrl()}</code></p>
        </body>
      </html>
    `);
  }
});

function getAuthUrl() {
  const params = new URLSearchParams({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

server.listen(PORT, () => {
  console.log(`🌐 OAuth server running at http://localhost:${PORT}`);
  console.log('🔗 Authorization URL:');
  console.log(getAuthUrl());
  console.log('\n📋 Instructions:');
  console.log('1. Click the authorization URL above');
  console.log('2. Sign in with your Google account');
  console.log('3. Grant permissions');
  console.log('4. You will be redirected back and tokens will be saved automatically');
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down OAuth server...');
  server.close();
  process.exit(0);
});