#!/usr/bin/env node

/**
 * Create Google Sheets Structure Script
 * 
 * This script automatically creates the master tracking sheet and template workbook
 * with proper formatting, validation, and structure.
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import logger from '../../src/utils/logger.js';

class GoogleSheetsCreator {
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
  }

  async createMasterSheet() {
    console.log('📊 Creating Master Tracking Sheet...');

    try {
      // Create the spreadsheet
      const response = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: 'YouTube Automation - Master Tracking'
          },
          sheets: [{
            properties: {
              title: 'Videos',
              gridProperties: {
                rowCount: 1000,
                columnCount: 26
              }
            }
          }]
        }
      });

      const spreadsheetId = response.data.spreadsheetId;
      const sheetId = response.data.sheets[0].properties.sheetId; // Get the actual sheet ID
      console.log(`   ✅ Master sheet created: ${response.data.properties.title}`);

      // Set up headers with simplified icon-only format (A-P = 16 columns)
      const headers = [
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

      // Add headers
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Videos!A1:P1', // Updated to P (16 columns)
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [headers]
        }
      });

      // Format headers
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
            // Header formatting
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
                      fontSize: 11,
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

      // Add data validation for Status column (D)
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
          requests: [
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

      // Add conditional formatting for Status column
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
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
            // Status: Yellow for Processing/Generating
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

      console.log(`   🔗 Master Sheet URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
      return {
        id: spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      };

    } catch (error) {
      console.error('❌ Failed to create master sheet:', error.message);
      throw error;
    }
  }

  async createTemplateWorkbook() {
    console.log('📋 Creating Template Workbook...');

    try {
      // Create the workbook with 3 sheets
      const response = await this.sheets.spreadsheets.create({
        resource: {
          properties: {
            title: 'YouTube Automation - Video Template'
          },
          sheets: [
            {
              properties: {
                title: 'Video Info',
                gridProperties: {
                  rowCount: 50,
                  columnCount: 10
                }
              }
            },
            {
              properties: {
                title: 'Script Breakdown',
                gridProperties: {
                  rowCount: 200,
                  columnCount: 10
                }
              }
            },
            {
              properties: {
                title: 'Analytics',
                gridProperties: {
                  rowCount: 50,
                  columnCount: 10
                }
              }
            }
          ]
        }
      });

      const spreadsheetId = response.data.spreadsheetId;
      const sheets = response.data.sheets;
      console.log(`   ✅ Template workbook created: ${response.data.properties.title}`);

      // Set up Video Info sheet (first sheet)
      await this.setupVideoInfoSheet(spreadsheetId, sheets[0].properties.sheetId);
      
      // Set up Script Breakdown sheet (second sheet)
      await this.setupScriptBreakdownSheet(spreadsheetId, sheets[1].properties.sheetId);
      
      // Set up Analytics sheet (third sheet)
      await this.setupAnalyticsSheet(spreadsheetId, sheets[2].properties.sheetId);

      console.log(`   🔗 Template Workbook URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
      return {
        id: spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      };

    } catch (error) {
      console.error('❌ Failed to create template workbook:', error.message);
      throw error;
    }
  }

  async setupVideoInfoSheet(spreadsheetId, sheetId) {
    // Video Info sheet data
    const videoInfoData = [
      ['Field', 'Value'],
      ['Video ID', ''],
      ['Title', ''],
      ['Status', ''],
      ['YouTube URL', ''],
      ['Channel', ''],
      ['Duration', ''],
      ['View Count', ''],
      ['Published Date', ''],
      ['YouTube Video ID', ''],
      ['Optimized Title', ''],
      ['Optimized Description', ''],
      ['Keywords', ''],
      ['Total Sentences', ''],
      ['Completed Sentences', ''],
      ['Progress %', '=IF(B14>0,B15/B14*100,0)'],
      ['Thumbnail URLs', ''],
      ['Thumbnail Prompt', ''],
      ['Script Approved', ''],
      ['Voice Status', ''],
      ['Voice Generation Status', ''],
      ['Video Editing Status', ''],
      ['Drive Folder', ''],
      ['Created Time', ''],
      ['Last Edited Time', '']
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Video Info!A1:B25',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: videoInfoData
      }
    });

    // Format Video Info sheet
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Header formatting
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 2
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.2,
                    green: 0.6,
                    blue: 0.2
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1
                    },
                    fontSize: 11,
                    bold: true
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Field names formatting
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 25,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true
                  }
                }
              },
              fields: 'userEnteredFormat.textFormat.bold'
            }
          }
        ]
      }
    });
  }

  async setupScriptBreakdownSheet(spreadsheetId, sheetId) {
    // Script Breakdown headers
    const headers = [
      'Sentence #', 'Script Text', 'Image Prompt', 'Image URL', 
      'Editor Keywords', 'Status', 'Word Count'
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Script Breakdown!A1:G1',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [headers]
      }
    });

    // Use the passed sheetId parameter

    // Format Script Breakdown sheet
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Header formatting
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.8,
                    green: 0.4,
                    blue: 0.2
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1
                    },
                    fontSize: 11,
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
          // Status column validation
          {
            setDataValidation: {
              range: {
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 200,
                startColumnIndex: 5,
                endColumnIndex: 6
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: [
                    { userEnteredValue: 'Pending' },
                    { userEnteredValue: 'Processing' },
                    { userEnteredValue: 'Image Generated' },
                    { userEnteredValue: 'Complete' }
                  ]
                },
                showCustomUi: true
              }
            }
          }
        ]
      }
    });

    // Add conditional formatting for Status
    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Complete: Green
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 200,
                  startColumnIndex: 5,
                  endColumnIndex: 6
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: 'Complete' }]
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
          // Processing: Yellow
          {
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 200,
                  startColumnIndex: 5,
                  endColumnIndex: 6
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
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
          }
        ]
      }
    });
  }

  async setupAnalyticsSheet(spreadsheetId, sheetId) {
    // Analytics data
    const analyticsData = [
      ['Analytics Dashboard'],
      [''],
      ['Progress Summary'],
      ['Total Sentences', '=\'Video Info\'!B14'],
      ['Completed Sentences', '=\'Video Info\'!B15'],
      ['Progress Percentage', '=\'Video Info\'!B16'],
      [''],
      ['Status Breakdown'],
      ['Pending', '=COUNTIF(\'Script Breakdown\'!F:F,"Pending")'],
      ['Processing', '=COUNTIF(\'Script Breakdown\'!F:F,"Processing")'],
      ['Image Generated', '=COUNTIF(\'Script Breakdown\'!F:F,"Image Generated")'],
      ['Complete', '=COUNTIF(\'Script Breakdown\'!F:F,"Complete")'],
      [''],
      ['Timestamps'],
      ['Created', '=\'Video Info\'!B24'],
      ['Last Updated', '=\'Video Info\'!B25']
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Analytics!A1:B16',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: analyticsData
      }
    });

    // Format Analytics sheet
    // Use the passed sheetId parameter

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          // Title formatting
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 2
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.6,
                    green: 0.2,
                    blue: 0.8
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1,
                      green: 1,
                      blue: 1
                    },
                    fontSize: 14,
                    bold: true
                  }
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Section headers
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 2,
                endRowIndex: 3,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                    fontSize: 12
                  }
                }
              },
              fields: 'userEnteredFormat.textFormat'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 7,
                endRowIndex: 8,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                    fontSize: 12
                  }
                }
              },
              fields: 'userEnteredFormat.textFormat'
            }
          },
          {
            repeatCell: {
              range: {
                sheetId: sheetId,
                startRowIndex: 13,
                endRowIndex: 14,
                startColumnIndex: 0,
                endColumnIndex: 1
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true,
                    fontSize: 12
                  }
                }
              },
              fields: 'userEnteredFormat.textFormat'
            }
          }
        ]
      }
    });
  }

  async updateEnvFile(masterSheetId, templateWorkbookId) {
    console.log('📝 Updating .env file with sheet IDs...');
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      const envPath = path.join(process.cwd(), '.env');
      let envContent = fs.readFileSync(envPath, 'utf8');

      // Update master sheet ID
      if (envContent.includes('GOOGLE_MASTER_SHEET_ID=')) {
        envContent = envContent.replace(
          /GOOGLE_MASTER_SHEET_ID=.*/,
          `GOOGLE_MASTER_SHEET_ID=${masterSheetId}`
        );
      } else {
        envContent += `\nGOOGLE_MASTER_SHEET_ID=${masterSheetId}`;
      }

      // Update template workbook ID
      if (envContent.includes('GOOGLE_TEMPLATE_WORKBOOK_ID=')) {
        envContent = envContent.replace(
          /GOOGLE_TEMPLATE_WORKBOOK_ID=.*/,
          `GOOGLE_TEMPLATE_WORKBOOK_ID=${templateWorkbookId}`
        );
      } else {
        envContent += `\nGOOGLE_TEMPLATE_WORKBOOK_ID=${templateWorkbookId}`;
      }

      fs.writeFileSync(envPath, envContent);
      console.log('   ✅ .env file updated with sheet IDs');
    } catch (error) {
      console.error('   ❌ Failed to update .env file:', error.message);
      console.log('   📝 Please manually add these to your .env file:');
      console.log(`   GOOGLE_MASTER_SHEET_ID=${masterSheetId}`);
      console.log(`   GOOGLE_TEMPLATE_WORKBOOK_ID=${templateWorkbookId}`);
    }
  }
}

// Main execution
async function main() {
  console.log('🏗️  Creating Google Sheets Structure...\n');

  const creator = new GoogleSheetsCreator();

  try {
    // Create master sheet
    const masterSheet = await creator.createMasterSheet();
    
    // Create template workbook
    const templateWorkbook = await creator.createTemplateWorkbook();
    
    // Update .env file
    await creator.updateEnvFile(masterSheet.id, templateWorkbook.id);

    console.log('\n🎉 Google Sheets structure created successfully!\n');
    console.log('📊 Master Tracking Sheet:');
    console.log(`   ID: ${masterSheet.id}`);
    console.log(`   URL: ${masterSheet.url}\n`);
    console.log('📋 Template Workbook:');
    console.log(`   ID: ${templateWorkbook.id}`);
    console.log(`   URL: ${templateWorkbook.url}\n`);
    
    console.log('✅ Next steps:');
    console.log('1. Review the created sheets and customize if needed');
    console.log('2. Run integration test: npm run test-google');
    console.log('3. Start using your new Google Sheets workflow!\n');

  } catch (error) {
    console.error('❌ Failed to create sheets structure:', error.message);
    logger.error('Google sheets creation failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default GoogleSheetsCreator;