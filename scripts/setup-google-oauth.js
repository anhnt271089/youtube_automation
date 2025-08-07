#!/usr/bin/env node

/**
 * Google OAuth Setup Script
 * 
 * This script helps set up OAuth authentication for Google Sheets and Drive APIs.
 * Run this once to obtain the access and refresh tokens needed for the application.
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { createServer } from 'http';
import { URL } from 'url';
import open from 'open';
import { config } from '../config/config.js';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive'
];

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

class GoogleOAuthSetup {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      REDIRECT_URI
    );
  }

  async startAuthFlow() {
    console.log('🚀 Starting Google OAuth setup...\n');

    // Validate required environment variables
    if (!config.google.clientId || !config.google.clientSecret) {
      console.error('❌ Missing Google OAuth credentials!');
      console.error('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file.');
      console.error('Get these from: https://console.cloud.google.com/apis/credentials\n');
      process.exit(1);
    }

    console.log('✅ OAuth credentials found');
    console.log('🌐 Setting up local server for authentication...\n');

    return new Promise((resolve, reject) => {
      const server = createServer(async (req, res) => {
        try {
          const url = new URL(req.url, `http://localhost:${PORT}`);
          
          if (url.pathname === '/auth/callback') {
            const code = url.searchParams.get('code');
            
            if (code) {
              console.log('✅ Authorization code received');
              
              // Exchange code for tokens
              const { tokens } = await this.oauth2Client.getToken(code);
              
              console.log('✅ Tokens obtained successfully');
              
              // Save tokens to .env file
              await this.saveTokensToEnv(tokens);
              
              // Test the connection
              await this.testConnection(tokens);
              
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(`
                <html>
                  <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                    <h2 style="color: green;">✅ Authentication Successful!</h2>
                    <p>You can close this tab and return to the terminal.</p>
                    <p>Your tokens have been saved to the .env file.</p>
                  </body>
                </html>
              `);
              
              server.close();
              resolve(tokens);
            } else {
              throw new Error('No authorization code received');
            }
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } catch (error) {
          console.error('❌ Authentication error:', error.message);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: red;">❌ Authentication Failed</h2>
                <p>Error: ${error.message}</p>
                <p>Please check the terminal for more details.</p>
              </body>
            </html>
          `);
          server.close();
          reject(error);
        }
      });

      server.listen(PORT, () => {
        console.log(`🌐 Local server started on http://localhost:${PORT}`);
        
        // Generate auth URL
        const authUrl = this.oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
        });

        console.log('🔐 Opening browser for authentication...\n');
        console.log('If browser doesn\'t open automatically, visit this URL:');
        console.log(authUrl + '\n');

        // Open browser
        open(authUrl).catch(() => {
          console.log('Failed to open browser automatically. Please copy the URL above.');
        });
      });
    });
  }

  async saveTokensToEnv(tokens) {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Update access token
      if (tokens.access_token) {
        if (envContent.includes('GOOGLE_ACCESS_TOKEN=')) {
          envContent = envContent.replace(
            /GOOGLE_ACCESS_TOKEN=.*/,
            `GOOGLE_ACCESS_TOKEN=${tokens.access_token}`
          );
        } else {
          envContent += `\nGOOGLE_ACCESS_TOKEN=${tokens.access_token}`;
        }
      }

      // Update refresh token
      if (tokens.refresh_token) {
        if (envContent.includes('GOOGLE_REFRESH_TOKEN=')) {
          envContent = envContent.replace(
            /GOOGLE_REFRESH_TOKEN=.*/,
            `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
          );
        } else {
          envContent += `\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`;
        }
      }

      fs.writeFileSync(envPath, envContent);
      console.log('✅ Tokens saved to .env file');
    } catch (error) {
      console.error('❌ Failed to save tokens to .env file:', error.message);
      console.log('\n📝 Please manually add these tokens to your .env file:');
      if (tokens.access_token) {
        console.log(`GOOGLE_ACCESS_TOKEN=${tokens.access_token}`);
      }
      if (tokens.refresh_token) {
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      }
    }
  }

  async testConnection(tokens) {
    try {
      console.log('\n🧪 Testing connection...');
      
      this.oauth2Client.setCredentials(tokens);
      
      const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

      // Test Sheets API
      try {
        const response = await sheets.spreadsheets.create({
          resource: {
            properties: {
              title: 'YouTube Automation Test Sheet'
            }
          }
        });

        const testSheetId = response.data.spreadsheetId;
        console.log('✅ Google Sheets API: Working');
        console.log(`   Test sheet created: ${response.data.properties.title}`);

        // Delete test sheet
        await drive.files.delete({
          fileId: testSheetId
        });
        console.log('   Test sheet deleted');
      } catch (error) {
        console.error('❌ Google Sheets API test failed:', error.message);
      }

      // Test Drive API
      try {
        const response = await drive.about.get({
          fields: 'user, storageQuota'
        });

        console.log('✅ Google Drive API: Working');
        console.log(`   Connected as: ${response.data.user.emailAddress}`);

        const quota = response.data.storageQuota;
        if (quota && quota.limit && quota.limit !== '0') {
          const usedGB = (parseInt(quota.usage) / 1024 / 1024 / 1024).toFixed(2);
          const limitGB = (parseInt(quota.limit) / 1024 / 1024 / 1024).toFixed(2);
          console.log(`   Storage: ${usedGB}GB / ${limitGB}GB used`);
        } else {
          console.log('   Storage: Available (quota info not accessible)');
        }
      } catch (error) {
        console.error('❌ Google Drive API test failed:', error.message);
      }

    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
    }
  }

  async refreshTokens() {
    try {
      console.log('🔄 Refreshing tokens...');
      
      if (!config.google.refreshToken) {
        throw new Error('No refresh token available. Please run the full authentication flow.');
      }

      this.oauth2Client.setCredentials({
        refresh_token: config.google.refreshToken
      });

      const { tokens } = await this.oauth2Client.refreshAccessToken();
      
      await this.saveTokensToEnv(tokens);
      console.log('✅ Tokens refreshed successfully');

      return tokens;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const setup = new GoogleOAuthSetup();

  try {
    if (args.includes('--refresh')) {
      await setup.refreshTokens();
    } else {
      await setup.startAuthFlow();
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📚 Next steps:');
    console.log('1. Create your master tracking sheet following the documentation');
    console.log('2. Create a template workbook for video details');
    console.log('3. Update GOOGLE_MASTER_SHEET_ID and GOOGLE_TEMPLATE_WORKBOOK_ID in .env');
    console.log('4. Run a test: npm run test:google-integration\n');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default GoogleOAuthSetup;