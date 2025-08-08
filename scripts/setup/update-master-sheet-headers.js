#!/usr/bin/env node

/**
 * Update Master Sheet Headers Script
 * 
 * This script updates existing master sheets to use the new simplified icon-only headers
 * without the "Auto:", "Manual:", "Input:" prefixes.
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import logger from '../../src/utils/logger.js';

class MasterSheetHeaderUpdater {
  constructor() {
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
  }

  async updateMasterSheetHeaders() {
    console.log('🔄 Updating Master Sheet Headers...');

    try {
      const spreadsheetId = config.google.masterSheetId;
      
      if (!spreadsheetId) {
        throw new Error('GOOGLE_MASTER_SHEET_ID not found in environment variables');
      }

      // New simplified icon-only headers (A-P = 16 columns)
      const newHeaders = [
        '🤖 Video ID',           // A: Auto-generated VID-XXXX format
        '🔧 YouTube URL',        // B: User input required
        '🤖 Title',              // C: Automatically populated
        '🤖 Status',             // D: Automatically populated 
        '🤖 Channel',            // E: Automatically populated
        '🤖 Duration',           // F: Automatically populated
        '🤖 View Count',         // G: Automatically populated
        '🤖 Published Date',     // H: Automatically populated
        '🤖 YouTube Video ID',   // I: Automatically populated
        '👤 Script Approved',    // J: Requires human interaction
        '👤 Voice Generation Status', // K: Requires human interaction
        '👤 Video Editing Status',    // L: Requires human interaction
        '🤖 Drive Folder Link',  // M: Automatically populated
        '🤖 Detail Workbook URL', // N: Automatically populated
        '🤖 Created Time',       // O: Automatically populated
        '🤖 Last Edited Time'    // P: Automatically populated
      ];

      // Update headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Videos!A1:P1', // Updated to P (16 columns)
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [newHeaders]
        }
      });

      console.log('   ✅ Headers updated successfully');

      // Get sheet metadata to find sheetId
      const sheetInfo = await this.sheets.spreadsheets.get({
        spreadsheetId
      });
      
      const videoSheet = sheetInfo.data.sheets.find(sheet => 
        sheet.properties.title === 'Videos'
      );
      
      if (!videoSheet) {
        throw new Error('Videos sheet not found');
      }

      const sheetId = videoSheet.properties.sheetId;

      // Ensure proper data validation for the updated columns
      await this.updateDataValidation(spreadsheetId, sheetId);

      // Verify the update
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Videos!A1:P1'
      });

      const updatedHeaders = response.data.values[0];
      console.log('   📋 Updated headers:');
      updatedHeaders.forEach((header, index) => {
        const column = String.fromCharCode(65 + index); // A, B, C...
        console.log(`     ${column}: ${header}`);
      });

      console.log('\n🎉 Master sheet headers updated successfully!');
      console.log('✅ Your sheet now uses clean, icon-only headers');
      console.log('🔗 Sheet URL: https://docs.google.com/spreadsheets/d/' + spreadsheetId);
      
      return {
        success: true,
        spreadsheetId,
        updatedHeaders
      };

    } catch (error) {
      console.error('❌ Failed to update master sheet headers:', error.message);
      logger.error('Master sheet header update failed:', error);
      throw error;
    }
  }

  async updateDataValidation(spreadsheetId, sheetId) {
    console.log('   🔧 Updating data validation rules...');

    try {
      // Clear existing validation rules first
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            // Clear existing validation for entire sheet
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 0,
                  endColumnIndex: 16
                },
                rule: null // Clear all validation
              }
            }
          ]
        }
      });

      // Add new validation rules for updated column positions
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            // Status validation (D column - index 3)
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 3,
                  endColumnIndex: 4
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'New' },
                      { userEnteredValue: 'Processing' },
                      { userEnteredValue: 'Script Separated' },
                      { userEnteredValue: 'Approved' },
                      { userEnteredValue: 'Generating Images' },
                      { userEnteredValue: 'Completed' },
                      { userEnteredValue: 'Error' }
                    ]
                  },
                  showCustomUi: true
                }
              }
            },
            // Script Approved validation (J column - index 9)
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 9,
                  endColumnIndex: 10
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Pending' },
                      { userEnteredValue: 'Approved' },
                      { userEnteredValue: 'Needs Changes' }
                    ]
                  },
                  showCustomUi: true
                }
              }
            },
            // Voice Generation Status validation (K column - index 10)
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 10,
                  endColumnIndex: 11
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Not Ready' },
                      { userEnteredValue: 'Not Started' },
                      { userEnteredValue: 'In Progress' },
                      { userEnteredValue: 'Completed' },
                      { userEnteredValue: 'Need Changes' }
                    ]
                  },
                  showCustomUi: true
                }
              }
            },
            // Video Editing Status validation (L column - index 11)
            {
              setDataValidation: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 11,
                  endColumnIndex: 12
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'Not Ready' },
                      { userEnteredValue: 'Not Started' },
                      { userEnteredValue: 'In Progress' },
                      { userEnteredValue: 'First Draft' },
                      { userEnteredValue: 'Completed' },
                      { userEnteredValue: 'Published' }
                    ]
                  },
                  showCustomUi: true
                }
              }
            }
          ]
        }
      });

      console.log('   ✅ Data validation rules updated');

    } catch (error) {
      console.warn('   ⚠️  Warning: Could not update data validation:', error.message);
      // Don't throw here, as header update is more important than validation
    }
  }

  async verifySheetStructure() {
    console.log('🔍 Verifying sheet structure...');

    try {
      const spreadsheetId = config.google.masterSheetId;
      
      // Get current data to verify structure
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Videos!A1:P10' // Get first 10 rows to check structure
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        console.log('   ⚠️  Sheet appears to be empty');
        return false;
      }

      const headers = rows[0];
      console.log(`   📊 Found ${headers.length} columns`);
      
      // Check if we have the expected 16 columns
      if (headers.length !== 16) {
        console.log(`   ⚠️  Expected 16 columns, found ${headers.length}`);
        console.log('   💡 This is normal for new installations');
      }

      // Check for data rows
      const dataRows = rows.slice(1).filter(row => row.length > 0);
      console.log(`   📝 Found ${dataRows.length} data rows`);

      if (dataRows.length > 0) {
        console.log('   ✅ Existing data preserved');
      } else {
        console.log('   ℹ️  No existing data found (clean sheet)');
      }

      return true;

    } catch (error) {
      console.error('   ❌ Failed to verify sheet structure:', error.message);
      return false;
    }
  }
}

// Main execution
async function main() {
  console.log('🏗️  Updating Google Sheets Master Headers...\n');

  const updater = new MasterSheetHeaderUpdater();

  try {
    // Verify current structure
    await updater.verifySheetStructure();
    console.log();

    // Update headers
    const result = await updater.updateMasterSheetHeaders();
    console.log();

    // Final verification
    await updater.verifySheetStructure();

    console.log('\n✅ Header update completed successfully!');
    console.log('💡 Next steps:');
    console.log('1. Review your updated sheet structure');
    console.log('2. Test the integration: npm run test-google');
    console.log('3. Your existing data should remain intact\n');

  } catch (error) {
    console.error('❌ Failed to update headers:', error.message);
    logger.error('Header update failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MasterSheetHeaderUpdater;