#!/usr/bin/env node

/**
 * Script to recreate Google Sheets master file with updated structure
 * This script will:
 * 1. Find and optionally delete the old master sheet
 * 2. Create a new Google Sheet with proper structure
 * 3. Set up headers, formatting, and data validation
 * 4. Update the config with the new sheet ID
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MasterSheetRecreator {
  constructor() {
    // Set up Google Sheets authentication
    const auth = new google.auth.OAuth2({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri
    });

    auth.setCredentials({
      access_token: config.google.accessToken,
      refresh_token: config.google.refreshToken
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Define the master sheet structure
   */
  getMasterSheetStructure() {
    return {
      headers: [
        'Video ID',           // A - VID-XXXX format
        'YouTube URL',        // B - Source video URL
        'Title',              // C - Video title
        'Status',             // D - Workflow status
        'Channel',            // E - YouTube channel
        'Duration',           // F - Video duration
        'View Count',         // G - YouTube view count
        'Published Date',     // H - Video publish date
        'YouTube Video ID',   // I - YouTube video identifier
        'Script Approved',    // J - Script approval dropdown
        'Voice Status',       // K - Legacy voice checkbox
        'Voice Generation Status', // L - Voice workflow status
        'Video Editing Status',     // M - Video editing workflow status
        'Drive Folder',       // N - Google Drive folder link
        'Detail Workbook URL', // O - Link to detail workbook
        'Created Time',       // P - Creation timestamp
        'Last Edited Time'    // Q - Last modified timestamp
      ],
      statusOptions: [
        'New',
        'Processing', 
        'Script Separated',
        'Approved',
        'Generating Images',
        'Completed',
        'Error'
      ],
      scriptApprovedOptions: [
        'Pending',
        'Approved', 
        'Needs Changes'
      ],
      voiceGenerationOptions: [
        'Not Ready',
        'Not Started',
        'In Progress',
        'Completed',
        'Need Changes'
      ],
      videoEditingOptions: [
        'Not Ready',
        'Not Started',
        'In Progress',
        'First Draft',
        'Completed',
        'Published'
      ]
    };
  }

  /**
   * Find existing master sheet by ID
   */
  async findExistingSheet(sheetId) {
    if (!sheetId) {
      console.log('❌ No master sheet ID found in config');
      return null;
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });
      
      console.log(`✅ Found existing sheet: "${response.data.properties.title}"`);
      return response.data;
    } catch (error) {
      console.log(`❌ Could not find sheet with ID: ${sheetId}`);
      console.log(`   Error: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete existing sheet (move to trash)
   */
  async deleteExistingSheet(sheetId) {
    try {
      await this.drive.files.update({
        fileId: sheetId,
        resource: {
          trashed: true
        }
      });
      console.log('✅ Moved old master sheet to trash');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete old sheet:', error.message);
      return false;
    }
  }

  /**
   * Create new Google Sheet
   */
  async createNewSheet() {
    const structure = this.getMasterSheetStructure();
    
    try {
      // Create new spreadsheet
      const response = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: `YouTube Automation - Video Tracker (${new Date().toISOString().split('T')[0]})`
          },
          sheets: [{
            properties: {
              title: 'Videos',
              sheetId: 0, // Explicitly set sheet ID
              gridProperties: {
                rowCount: 1000,
                columnCount: 17 // A-Q columns
              }
            }
          }]
        }
      });

      const spreadsheetId = response.data.spreadsheetId;
      console.log(`✅ Created new sheet: ${response.data.properties.title}`);
      console.log(`   Sheet ID: ${spreadsheetId}`);
      console.log(`   URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);

      // Get the actual sheet ID for formatting operations
      const sheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      
      const videosSheetId = sheetInfo.data.sheets.find(sheet => 
        sheet.properties.title === 'Videos'
      ).properties.sheetId;

      return { 
        spreadsheetId, 
        url: response.data.spreadsheetUrl,
        videosSheetId 
      };
    } catch (error) {
      console.error('❌ Failed to create new sheet:', error.message);
      throw error;
    }
  }

  /**
   * Set up sheet headers
   */
  async setupHeaders(spreadsheetId) {
    const structure = this.getMasterSheetStructure();
    
    try {
      // Add headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Videos!A1:Q1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [structure.headers]
        }
      });

      console.log('✅ Added headers to sheet');
    } catch (error) {
      console.error('❌ Failed to setup headers:', error.message);
      throw error;
    }
  }

  /**
   * Apply formatting to the sheet
   */
  async applyFormatting(spreadsheetId, videosSheetId) {
    try {
      const requests = [];

      // Format header row
      requests.push({
        repeatCell: {
          range: {
            sheetId: videosSheetId, // Use the actual sheet ID
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 17
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
              textFormat: { 
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true 
              },
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)'
        }
      });

      // Freeze header row
      requests.push({
        updateSheetProperties: {
          properties: {
            sheetId: videosSheetId,
            gridProperties: {
              frozenRowCount: 1
            }
          },
          fields: 'gridProperties.frozenRowCount'
        }
      });

      // Auto-resize columns
      requests.push({
        autoResizeDimensions: {
          dimensions: {
            sheetId: videosSheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 17
          }
        }
      });

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });

      console.log('✅ Applied formatting to sheet');
    } catch (error) {
      console.error('❌ Failed to apply formatting:', error.message);
      throw error;
    }
  }

  /**
   * Set up data validation for dropdown columns
   */
  async setupDataValidation(spreadsheetId, videosSheetId) {
    const structure = this.getMasterSheetStructure();
    
    try {
      const requests = [];

      // Status column (D) validation
      requests.push({
        setDataValidation: {
          range: {
            sheetId: videosSheetId,
            startRowIndex: 1, // Skip header
            endRowIndex: 1000,
            startColumnIndex: 3, // Column D (Status)
            endColumnIndex: 4
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: structure.statusOptions.map(option => ({ userEnteredValue: option }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      });

      // Script Approved column (J) validation  
      requests.push({
        setDataValidation: {
          range: {
            sheetId: videosSheetId,
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 9, // Column J (Script Approved)
            endColumnIndex: 10
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: structure.scriptApprovedOptions.map(option => ({ userEnteredValue: option }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      });

      // Voice Generation Status column (L) validation
      requests.push({
        setDataValidation: {
          range: {
            sheetId: videosSheetId,
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 11, // Column L (Voice Generation Status)
            endColumnIndex: 12
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: structure.voiceGenerationOptions.map(option => ({ userEnteredValue: option }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      });

      // Video Editing Status column (M) validation
      requests.push({
        setDataValidation: {
          range: {
            sheetId: videosSheetId,
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 12, // Column M (Video Editing Status)
            endColumnIndex: 13
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: structure.videoEditingOptions.map(option => ({ userEnteredValue: option }))
            },
            showCustomUi: true,
            strict: true
          }
        }
      });

      // Voice Status column (K) - checkbox validation
      requests.push({
        setDataValidation: {
          range: {
            sheetId: videosSheetId,
            startRowIndex: 1,
            endRowIndex: 1000,
            startColumnIndex: 10, // Column K (Voice Status)
            endColumnIndex: 11
          },
          rule: {
            condition: {
              type: 'BOOLEAN'
            },
            showCustomUi: true
          }
        }
      });

      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests }
      });

      console.log('✅ Set up data validation for dropdown columns');
    } catch (error) {
      console.error('❌ Failed to setup data validation:', error.message);
      throw error;
    }
  }

  /**
   * Share the sheet (make it accessible)
   */
  async shareSheet(spreadsheetId) {
    try {
      // Make it editable by anyone with the link (adjust as needed)
      await this.drive.permissions.create({
        fileId: spreadsheetId,
        resource: {
          role: 'writer',
          type: 'anyone'
        }
      });
      
      console.log('✅ Sheet shared - anyone with link can edit');
    } catch (error) {
      console.warn('⚠️  Could not share sheet automatically:', error.message);
      console.log('   You may need to manually share the sheet if needed');
    }
  }

  /**
   * Update environment file with new sheet ID
   */
  updateEnvFile(newSheetId) {
    const envPath = path.join(__dirname, '../.env');
    
    if (!fs.existsSync(envPath)) {
      console.log('⚠️  .env file not found, please manually update GOOGLE_MASTER_SHEET_ID');
      return;
    }

    try {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace existing GOOGLE_MASTER_SHEET_ID or add it
      if (envContent.includes('GOOGLE_MASTER_SHEET_ID=')) {
        envContent = envContent.replace(
          /GOOGLE_MASTER_SHEET_ID=.*/,
          `GOOGLE_MASTER_SHEET_ID=${newSheetId}`
        );
      } else {
        envContent += `\nGOOGLE_MASTER_SHEET_ID=${newSheetId}\n`;
      }

      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file with new sheet ID');
    } catch (error) {
      console.error('❌ Failed to update .env file:', error.message);
      console.log(`   Please manually set GOOGLE_MASTER_SHEET_ID=${newSheetId}`);
    }
  }

  /**
   * Test the new sheet with GoogleSheetsService
   */
  async testNewSheet(spreadsheetId) {
    try {
      console.log('\n🧪 Testing new sheet integration...');
      
      // Import and test the service
      const { default: GoogleSheetsService } = await import('../src/services/googleSheetsService.js');
      
      // Temporarily override the config for testing
      const originalSheetId = config.google.masterSheetId;
      config.google.masterSheetId = spreadsheetId;
      
      const service = new GoogleSheetsService();
      const healthCheck = await service.healthCheck();
      
      if (healthCheck.status === 'healthy') {
        console.log('✅ New sheet passed health check');
        
        // Test generating a Video ID
        const nextVideoId = await service.getNextVideoId();
        console.log(`✅ Next Video ID would be: ${nextVideoId}`);
        
      } else {
        console.error('❌ Health check failed:', healthCheck.error);
      }
      
      // Restore original config
      config.google.masterSheetId = originalSheetId;
      
    } catch (error) {
      console.error('❌ Testing failed:', error.message);
    }
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🚀 Starting Google Sheets master file recreation...\n');

    try {
      // Step 1: Check for existing sheet
      const existingSheet = await this.findExistingSheet(config.google.masterSheetId);
      
      if (existingSheet) {
        console.log('\n❓ Found existing master sheet. Delete it? (y/N):');
        
        // For automated execution, we'll skip deletion confirmation
        // In interactive mode, you'd want to prompt the user
        console.log('   Skipping deletion - creating new sheet alongside existing one');
      }

      // Step 2: Create new sheet
      console.log('\n📊 Creating new Google Sheet...');
      const { spreadsheetId, url, videosSheetId } = await this.createNewSheet();

      // Step 3: Setup headers
      console.log('\n📝 Setting up sheet structure...');
      await this.setupHeaders(spreadsheetId);

      // Step 4: Apply formatting
      await this.applyFormatting(spreadsheetId, videosSheetId);

      // Step 5: Setup data validation
      await this.setupDataValidation(spreadsheetId, videosSheetId);

      // Step 6: Share sheet
      await this.shareSheet(spreadsheetId);

      // Step 7: Test the new sheet
      await this.testNewSheet(spreadsheetId);

      // Step 8: Update .env file
      console.log('\n💾 Updating configuration...');
      this.updateEnvFile(spreadsheetId);

      console.log('\n🎉 Successfully recreated master sheet!');
      console.log(`📄 Sheet URL: ${url}`);
      console.log(`🆔 Sheet ID: ${spreadsheetId}`);
      console.log('\n⚠️  Next steps:');
      console.log('   1. Verify the new sheet looks correct');
      console.log('   2. Update your .env file if not done automatically');
      console.log('   3. Test with your YouTube automation system');
      console.log('   4. Delete the old sheet when you\'re satisfied');

    } catch (error) {
      console.error('\n💥 Failed to recreate master sheet:', error.message);
      process.exit(1);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const recreator = new MasterSheetRecreator();
  recreator.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default MasterSheetRecreator;