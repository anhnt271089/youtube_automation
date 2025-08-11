#!/usr/bin/env node

import { google } from 'googleapis';
import { config } from '../config/config.js';

async function checkDriveFolder() {
  console.log('🔍 Checking VID-0001 Google Drive Folder Contents...\n');

  try {
    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.google.clientEmail,
        private_key: config.google.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/drive']
    });

    const drive = google.drive({ version: 'v3', auth });

    // VID-0001 thumbnails subfolder ID
    const folderId = '12H4s1r1U4JRrbQzGmu_tGpCD1W6Yc487';

    console.log('📁 Checking folder:', `https://drive.google.com/drive/folders/${folderId}`);

    // List files in the folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, size, createdTime, mimeType, webViewLink, webContentLink)',
      orderBy: 'createdTime desc'
    });

    const files = response.data.files;
    
    if (!files || files.length === 0) {
      console.log('❌ No files found in the folder');
      return;
    }

    console.log(`✅ Found ${files.length} files in VID-0001 folder:\n`);

    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file.name}`);
      console.log(`   ID: ${file.id}`);
      console.log(`   Size: ${file.size ? `${Math.round(file.size / 1024 / 1024 * 100) / 100} MB` : 'N/A'}`);
      console.log(`   Type: ${file.mimeType}`);
      console.log(`   Created: ${new Date(file.createdTime).toLocaleString()}`);
      console.log(`   View Link: ${file.webViewLink}`);
      console.log(`   Direct Link: https://drive.google.com/uc?id=${file.id}`);
      console.log('');
    });

    // Look for thumbnail files specifically
    const thumbnailFiles = files.filter(file => 
      file.name.toLowerCase().includes('thumbnail') || 
      file.name.toLowerCase().endsWith('.jpg') ||
      file.name.toLowerCase().endsWith('.png')
    );

    if (thumbnailFiles.length > 0) {
      console.log(`🖼️ Found ${thumbnailFiles.length} potential thumbnail files:`);
      thumbnailFiles.forEach((file, index) => {
        console.log(`\nThumbnail ${index + 1}: ${file.name}`);
        console.log(`Direct Link: https://drive.google.com/uc?id=${file.id}`);
      });
    } else {
      console.log('❌ No thumbnail files found in folder');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the check
checkDriveFolder().catch(console.error);