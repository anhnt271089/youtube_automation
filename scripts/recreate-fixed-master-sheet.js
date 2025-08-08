#!/usr/bin/env node

/**
 * Recreate Fixed Master Sheet Script
 * 
 * This script deletes the current master sheet and recreates it with:
 * 1. Fixed voice status conflict (removes legacy voiceStatus column)
 * 2. Clear emoji prefixes showing manual vs automation fields
 * 3. Correct 16-column structure (A-P)
 * 4. Proper data validation and formatting
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';

class FixedMasterSheetCreator {
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
    this.drive = google.drive({ version: 'v3', auth });
    this.masterSheetId = config.google.masterSheetId;
  }

  async deleteCurrentSheet() {
    console.log('🗑️  Deleting current master sheet...');
    
    try {
      // Get current sheet info
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.masterSheetId
      });

      const currentTitle = response.data.properties.title;
      console.log(`   📄 Current sheet: ${currentTitle}`);

      // Instead of deleting the entire spreadsheet, we'll clear it and recreate
      // This preserves the sheet ID that's already in the .env file
      
      // Get Videos sheet ID
      const videosSheet = response.data.sheets.find(sheet => sheet.properties.title === 'Videos');
      
      if (videosSheet) {
        console.log('   🧹 Clearing existing Videos sheet...');
        
        // Clear all content
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: this.masterSheetId,
          range: 'Videos!A:Z'
        });

        // Clear all formatting and validation
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: this.masterSheetId,
          resource: {
            requests: [
              {
                updateCells: {
                  range: {
                    sheetId: videosSheet.properties.sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1000,
                    startColumnIndex: 0,
                    endColumnIndex: 26
                  },
                  fields: '*'
                }
              }
            ]
          }
        });

        console.log('   ✅ Current sheet cleared successfully');
      } else {
        throw new Error('Videos sheet not found in master spreadsheet');
      }

      return videosSheet.properties.sheetId;

    } catch (error) {
      console.error('❌ Failed to clear current sheet:', error.message);
      throw error;
    }
  }

  async recreateMasterSheet() {
    console.log('📊 Recreating Fixed Master Tracking Sheet...');

    try {
      // Clear current sheet first
      const sheetId = await this.deleteCurrentSheet();

      // Update sheet properties to correct column count
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.masterSheetId,
        resource: {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 16  // Fixed to 16 columns (A-P)
                  }
                },
                fields: 'gridProperties'
              }
            }
          ]
        }
      });

      console.log('   📏 Updated sheet dimensions to 16 columns (A-P)');

      // Set up headers with clear emoji prefixes
      const headers = [
        '🤖 Auto: Video ID',           // A: videoId (0)
        '🔧 Input: YouTube URL',       // B: youtubeUrl (1) 
        '🤖 Auto: Title',             // C: title (2)
        '🤖 Auto: Status',            // D: status (3)
        '🤖 Auto: Channel',           // E: channel (4)
        '🤖 Auto: Duration',          // F: duration (5)
        '🤖 Auto: View Count',        // G: viewCount (6)
        '🤖 Auto: Published Date',    // H: publishedDate (7)
        '🤖 Auto: YouTube Video ID',  // I: youtubeVideoId (8)
        '👤 Manual: Script Approved', // J: scriptApproved (9)
        '👤 Manual: Voice Generation Status', // K: voiceGenerationStatus (10)
        '👤 Manual: Video Editing Status',    // L: videoEditingStatus (11)
        '🤖 Auto: Drive Folder Link', // M: driveFolder (12)
        '🤖 Auto: Detail Workbook URL', // N: detailWorkbookUrl (13)
        '🤖 Auto: Created Time',      // O: createdTime (14)
        '🤖 Auto: Last Edited Time'  // P: lastEditedTime (15)
      ];

      // Add headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A1:P1',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers]
        }
      });

      console.log('   ✅ Headers added with emoji prefixes');

      // Format headers
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.masterSheetId,
        resource: {
          requests: [
            // Header formatting - Blue background
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 16
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 0.2,
                      green: 0.4,
                      blue: 0.8
                    },
                    textFormat: {
                      foregroundColor: {
                        red: 1,
                        green: 1,
                        blue: 1
                      },
                      fontSize: 10,
                      bold: true
                    }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            },
            // Freeze header row
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: 'gridProperties.frozenRowCount'
              }
            },
            // Auto-resize columns
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 16
                }
              }
            }
          ]
        }
      });

      console.log('   🎨 Header formatting applied');

      // Add data validation for dropdown columns
      await this.addDataValidation(sheetId);

      // Add conditional formatting
      await this.addConditionalFormatting(sheetId);

      console.log('   ✅ Fixed master sheet recreated successfully');
      
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${this.masterSheetId}`;
      console.log(`   🔗 Master Sheet URL: ${sheetUrl}`);
      
      return {
        id: this.masterSheetId,
        url: sheetUrl
      };

    } catch (error) {
      console.error('❌ Failed to recreate master sheet:', error.message);
      throw error;
    }
  }

  async addDataValidation(sheetId) {
    console.log('   📝 Adding data validation...');

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.masterSheetId,
      resource: {
        requests: [
          // Status column (D) validation
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: 3,  // Column D (status)
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
          // Script Approved column (J) validation  
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: 9,  // Column J (scriptApproved)
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
          // Voice Generation Status column (K) validation
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: 10,  // Column K (voiceGenerationStatus)
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
          // Video Editing Status column (L) validation
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: 11,  // Column L (videoEditingStatus)
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

    console.log('   ✅ Data validation rules added');
  }

  async addConditionalFormatting(sheetId) {
    console.log('   🎨 Adding conditional formatting...');

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.masterSheetId,
      resource: {
        requests: [
          // Status: Green for Completed
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 3,
                  endColumnIndex: 4
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'Completed' }]
                  },
                  format: {
                    backgroundColor: {
                      red: 0.8,
                      green: 1.0,
                      blue: 0.8
                    }
                  }
                }
              }
            }
          },
          // Status: Yellow for Processing states
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 3,
                  endColumnIndex: 4
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_CONTAINS',
                    values: [{ userEnteredValue: 'Processing' }]
                  },
                  format: {
                    backgroundColor: {
                      red: 1.0,
                      green: 1.0,
                      blue: 0.8
                    }
                  }
                }
              }
            }
          },
          // Status: Yellow for Generating Images
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 3,
                  endColumnIndex: 4
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'Generating Images' }]
                  },
                  format: {
                    backgroundColor: {
                      red: 1.0,
                      green: 1.0,
                      blue: 0.8
                    }
                  }
                }
              }
            }
          },
          // Status: Red for Error
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: 3,
                  endColumnIndex: 4
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'Error' }]
                  },
                  format: {
                    backgroundColor: {
                      red: 1.0,
                      green: 0.8,
                      blue: 0.8
                    }
                  }
                }
              }
            }
          }
        ]
      }
    });

    console.log('   ✅ Conditional formatting applied');
  }

  async validateFixedStructure() {
    console.log('🔍 Validating fixed structure...');

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.masterSheetId
      });

      const videosSheet = response.data.sheets.find(sheet => sheet.properties.title === 'Videos');
      
      if (!videosSheet) {
        throw new Error('Videos sheet not found');
      }

      const gridProps = videosSheet.properties.gridProperties;
      
      console.log(`   📏 Sheet dimensions: ${gridProps.rowCount} rows × ${gridProps.columnCount} columns`);
      console.log(`   🧊 Frozen rows: ${gridProps.frozenRowCount || 0}`);

      // Get headers to validate
      const headersResponse = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.masterSheetId,
        range: 'Videos!A1:P1'
      });

      const headers = headersResponse.data.values?.[0] || [];
      console.log(`   📋 Header count: ${headers.length}`);
      
      // Check for conflict resolution
      const hasVoiceStatus = headers.some(header => header.includes('Voice Status') && !header.includes('Generation'));
      const hasVoiceGenerationStatus = headers.some(header => header.includes('Voice Generation Status'));
      
      console.log(`   ❌ Legacy Voice Status found: ${hasVoiceStatus}`);
      console.log(`   ✅ Voice Generation Status found: ${hasVoiceGenerationStatus}`);

      if (hasVoiceStatus) {
        throw new Error('Legacy Voice Status column still exists - conflict not resolved!');
      }

      if (!hasVoiceGenerationStatus) {
        throw new Error('Voice Generation Status column missing!');
      }

      if (gridProps.columnCount !== 16) {
        throw new Error(`Expected 16 columns, but found ${gridProps.columnCount}`);
      }

      console.log('   ✅ Structure validation passed');
      console.log('   ✅ Voice status conflict resolved');
      console.log('   ✅ All required columns present');

      return true;

    } catch (error) {
      console.error('❌ Structure validation failed:', error.message);
      throw error;
    }
  }
}

// Main execution
async function main() {
  console.log('🏗️  Recreating Fixed Google Sheets Master Structure...\n');

  const creator = new FixedMasterSheetCreator();

  try {
    // Recreate the master sheet with fixes
    const masterSheet = await creator.recreateMasterSheet();
    
    // Validate the structure
    await creator.validateFixedStructure();

    console.log('\n🎉 Fixed master sheet recreated successfully!\n');
    console.log('📊 Master Tracking Sheet (Fixed):');
    console.log(`   ID: ${masterSheet.id}`);
    console.log(`   URL: ${masterSheet.url}\n`);
    
    console.log('✅ Fixes Applied:');
    console.log('1. ❌ Removed legacy Voice Status (checkbox) column');  
    console.log('2. ✅ Kept Voice Generation Status (dropdown) column');
    console.log('3. 🏷️  Added clear emoji prefixes to all headers');
    console.log('4. 📏 Fixed to 16 columns (A-P) structure');
    console.log('5. 📝 Added proper data validation for all dropdowns');
    console.log('6. 🎨 Added conditional formatting for status visualization\n');
    
    console.log('🔧 Column Structure (16 total):');
    console.log('A-I:   Basic video info (🤖 Auto-populated)');
    console.log('J-L:   Manual workflow controls (👤 Manual)'); 
    console.log('M-P:   System-generated links & timestamps (🤖 Auto)\n');

    console.log('✅ Next steps:');
    console.log('1. Test video creation to ensure no conflicts');
    console.log('2. Verify GoogleSheetsService.js works with new structure');
    console.log('3. Run integration test: node test-single-run.js health');

  } catch (error) {
    console.error('❌ Failed to recreate fixed master sheet:', error.message);
    logger.error('Fixed master sheet creation failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default FixedMasterSheetCreator;