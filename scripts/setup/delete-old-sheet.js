#!/usr/bin/env node

/**
 * Script to delete the old Google Sheets master file
 * Only run this after you're satisfied with the new sheet
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import readline from 'readline';

class OldSheetDeleter {
  constructor() {
    // Set up Google authentication
    const auth = new google.auth.OAuth2({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri
    });

    auth.setCredentials({
      access_token: config.google.accessToken,
      refresh_token: config.google.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Find old sheet by searching for sheets with "YouTube Automation" in the name
   */
  async findOldSheets() {
    try {
      const response = await this.drive.files.list({
        q: "name contains 'YouTube Automation' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, createdTime, modifiedTime)'
      });

      const files = response.data.files || [];
      const currentSheetId = config.google.masterSheetId;
      
      // Filter out the current sheet
      const oldSheets = files.filter(file => file.id !== currentSheetId);
      
      return oldSheets;
    } catch (error) {
      console.error('❌ Failed to search for old sheets:', error.message);
      return [];
    }
  }

  /**
   * Get user confirmation before deletion
   */
  async getConfirmation(sheetName, sheetId) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`\n⚠️  Are you sure you want to delete "${sheetName}" (${sheetId})? (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  /**
   * Delete a sheet (move to trash)
   */
  async deleteSheet(sheetId, sheetName) {
    try {
      await this.drive.files.update({
        fileId: sheetId,
        resource: {
          trashed: true
        }
      });
      
      console.log(`✅ Moved "${sheetName}" to trash`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete "${sheetName}":`, error.message);
      return false;
    }
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🗑️  Searching for old YouTube Automation sheets...\n');

    try {
      const oldSheets = await this.findOldSheets();
      
      if (oldSheets.length === 0) {
        console.log('✅ No old sheets found to delete');
        return;
      }

      console.log(`📊 Found ${oldSheets.length} old sheet(s):`);
      oldSheets.forEach((sheet, index) => {
        console.log(`   ${index + 1}. "${sheet.name}" (${sheet.id})`);
        console.log(`      Created: ${new Date(sheet.createdTime).toLocaleDateString()}`);
        console.log(`      Modified: ${new Date(sheet.modifiedTime).toLocaleDateString()}\n`);
      });

      // Ask for confirmation for each sheet
      for (const sheet of oldSheets) {
        const confirmed = await this.getConfirmation(sheet.name, sheet.id);
        
        if (confirmed) {
          await this.deleteSheet(sheet.id, sheet.name);
        } else {
          console.log(`⏭️  Skipped "${sheet.name}"`);
        }
      }

      console.log('\n✅ Sheet cleanup completed');

    } catch (error) {
      console.error('\n💥 Failed to delete old sheets:', error.message);
      process.exit(1);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deleter = new OldSheetDeleter();
  deleter.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default OldSheetDeleter;