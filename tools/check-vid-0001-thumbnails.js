#!/usr/bin/env node

import { google } from 'googleapis';
import { config } from '../config/config.js';

async function checkVID0001Thumbnails() {
  console.log('🔍 Checking VID-0001 Thumbnail Status in Google Sheets...\n');

  try {
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: config.google.clientEmail,
        private_key: config.google.privateKey,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Get data from the main sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.google.masterSheetId,
      range: 'A1:Z100', // Get all data
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No data found in spreadsheet');
      return;
    }

    // Find header row
    const headers = rows[0];
    const videoIdIndex = headers.indexOf('🤖 Video ID');
    const titleIndex = headers.indexOf('🤖 Title');
    const statusIndex = headers.indexOf('🤖 Status');
    const thumbnail1Index = headers.indexOf('🤖 Thumbnail 1');
    const thumbnail2Index = headers.indexOf('🤖 Thumbnail 2');
    const videoFolderIndex = headers.indexOf('🤖 Drive Folder Link');

    console.log('📊 Sheet Structure:');
    console.log('Headers:', headers.join(', '));
    console.log(`Video ID column: ${videoIdIndex}, Title: ${titleIndex}, Status: ${statusIndex}`);
    console.log(`Thumbnail 1: ${thumbnail1Index}, Thumbnail 2: ${thumbnail2Index}, Folder: ${videoFolderIndex}\n`);

    // Find VID-0001 row
    let vid0001Row = null;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][videoIdIndex] === 'VID-0001') {
        vid0001Row = rows[i];
        break;
      }
    }

    if (!vid0001Row) {
      console.log('❌ VID-0001 not found in spreadsheet');
      return;
    }

    console.log('✅ Found VID-0001 Data:');
    console.log('Title:', vid0001Row[titleIndex] || 'N/A');
    console.log('Status:', vid0001Row[statusIndex] || 'N/A');
    console.log('Video Folder:', vid0001Row[videoFolderIndex] || 'N/A');
    console.log('Thumbnail 1:', vid0001Row[thumbnail1Index] || 'N/A');
    console.log('Thumbnail 2:', vid0001Row[thumbnail2Index] || 'N/A');

    // Test thumbnail links
    if (vid0001Row[thumbnail1Index]) {
      console.log('\n🔗 Testing Thumbnail Links...');
      await testLink('Thumbnail 1', vid0001Row[thumbnail1Index]);
    }
    if (vid0001Row[thumbnail2Index]) {
      await testLink('Thumbnail 2', vid0001Row[thumbnail2Index]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function testLink(name, url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      console.log(`✅ ${name}: Working (${response.status})`);
      console.log(`   ${url}`);
    } else {
      console.log(`❌ ${name}: Failed (${response.status})`);
      console.log(`   ${url}`);
    }
  } catch (error) {
    console.log(`❌ ${name}: Error - ${error.message}`);
    console.log(`   ${url}`);
  }
}

// Run the check
checkVID0001Thumbnails().catch(console.error);