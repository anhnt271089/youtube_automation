#!/usr/bin/env node

/**
 * Exchange OAuth authorization code for access and refresh tokens
 */

import axios from 'axios';
import fs from 'fs';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

async function exchangeCodeForTokens(authCode) {
  try {
    console.log('🔄 Exchanging authorization code for tokens...');

    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code: authCode,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const { access_token, refresh_token } = response.data;

    console.log('✅ Successfully got tokens!');
    console.log('\n📋 Update your .env file with these tokens:');
    console.log(`GOOGLE_ACCESS_TOKEN=${access_token}`);
    console.log(`GOOGLE_REFRESH_TOKEN=${refresh_token}`);

    // Optionally update .env file automatically
    const envPath = '.env';
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Update or add tokens
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
      console.log('\n✅ .env file updated automatically!');
      console.log('🚀 The automation system should now be able to access Google Sheets');
    }

  } catch (error) {
    console.error('❌ Error exchanging code for tokens:', error.response?.data || error.message);

    if (error.response?.status === 400) {
      console.log('\n💡 Common fixes for 400 errors:');
      console.log('1. Make sure the authorization code is fresh (use within 10 minutes)');
      console.log('2. Check that you copied the entire code (no extra characters)');
      console.log('3. Try getting a new authorization code from the URL');
    }
  }
}

// Get auth code from command line argument
const authCode = process.argv[2];

if (!authCode) {
  console.log('❌ Please provide the authorization code as an argument');
  console.log('\n📋 Usage: node exchange-oauth-code.js YOUR_AUTHORIZATION_CODE');
  console.log('\n🔗 Get authorization code from:');
  const params = new URLSearchParams({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI
  });
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  process.exit(1);
}

exchangeCodeForTokens(authCode);