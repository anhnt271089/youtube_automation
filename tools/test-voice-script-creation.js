#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import WorkflowService from '../src/services/workflowService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VoiceScriptTester {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.workflowService = new WorkflowService();
    this.telegramService = new TelegramService();
  }

  async testVoiceScriptCreation() {
    try {
      logger.info('🧪 Starting voice script creation test...');

      // Step 1: Get videos with approved scripts but missing voice_script.txt
      const approvedVideos = await this.sheetsService.getVideosWithApprovedScripts();
      
      if (approvedVideos.length === 0) {
        logger.info('❌ No videos with approved scripts found for testing');
        return;
      }

      logger.info(`📋 Found ${approvedVideos.length} videos with approved scripts`);

      for (const video of approvedVideos.slice(0, 1)) { // Test just first video
        const videoId = video.videoId;
        logger.info(`\n🎯 Testing voice script creation for: ${videoId}`);

        // Step 2: Check if detail workbook exists
        const videoRow = await this.sheetsService.findVideoRow(videoId);
        if (!videoRow || !videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]) {
          logger.error(`❌ ${videoId}: No detail workbook found - skipping`);
          continue;
        }

        const workbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
        logger.info(`📊 ${videoId}: Detail workbook exists: ${workbookUrl}`);

        // Step 3: Check if Script Breakdown has data
        try {
          const scriptSentences = await this.sheetsService.extractCleanVoiceScript(videoId);
          if (scriptSentences && scriptSentences.length > 0) {
            logger.info(`✅ ${videoId}: Found ${scriptSentences.length} script sentences in breakdown`);
            
            // Step 4: Check if voice script file already exists
            const driveFolder = videoRow.data[this.sheetsService.masterColumns.driveFolder];
            if (driveFolder) {
              const folderId = driveFolder.split('/folders/')[1];
              
              if (folderId) {
                const existingFiles = await this.sheetsService.drive.files.list({
                  q: `name='voice_script.txt' and parents in '${folderId}' and trashed=false`,
                  fields: 'files(id, name, webViewLink)'
                });

                if (existingFiles.data.files.length > 0) {
                  logger.info(`📄 ${videoId}: voice_script.txt already exists - ${existingFiles.data.files[0].webViewLink}`);
                } else {
                  logger.info(`🆕 ${videoId}: No voice_script.txt found - will create it`);
                  
                  // Step 5: Create the voice script file
                  const voiceScriptResult = await this.sheetsService.createAndUploadVoiceScript(videoId, false);
                  
                  if (voiceScriptResult && !voiceScriptResult.skipped) {
                    logger.info(`🎉 ${videoId}: SUCCESS! Voice script created: ${voiceScriptResult.viewLink}`);
                    
                    // Send success notification
                    await this.telegramService.sendMessage(
                      `✅ <b>Voice Script Test SUCCESS</b>\n\n` +
                      `🎬 ${videoId} - ${video.title}\n` +
                      `📄 File: ${voiceScriptResult.fileName}\n` +
                      `🔗 <a href="${voiceScriptResult.viewLink}">View File</a>\n\n` +
                      `📊 Sentences: ${scriptSentences.length}\n` +
                      `🧪 Created by test tool`
                    );
                    
                  } else {
                    logger.error(`❌ ${videoId}: Failed to create voice script - result was null or skipped`);
                  }
                }
              } else {
                logger.error(`❌ ${videoId}: Invalid drive folder URL: ${driveFolder}`);
              }
            } else {
              logger.error(`❌ ${videoId}: No drive folder found in video data`);
            }
          } else {
            logger.error(`❌ ${videoId}: No script sentences found in breakdown`);
          }
        } catch (extractError) {
          logger.error(`❌ ${videoId}: Error extracting script sentences:`, extractError.message);
        }

        logger.info(`\n${'='.repeat(60)}`);
      }

      logger.info('\n🏁 Voice script creation test completed');

    } catch (error) {
      logger.error('💥 Voice script test failed:', error);
      
      await this.telegramService.sendMessage(
        `❌ <b>Voice Script Test FAILED</b>\n\n` +
        `🔧 Error: ${error.message}\n\n` +
        `🛠 Check logs for details`
      );
    }
  }

  async diagnoseVideoIssues(videoId) {
    try {
      logger.info(`\n🔍 Diagnosing voice script issues for ${videoId}:`);

      // 1. Check video exists in master sheet
      const videoRow = await this.sheetsService.findVideoRow(videoId);
      if (!videoRow) {
        logger.error(`❌ Video ${videoId} not found in master sheet`);
        return;
      }
      logger.info(`✅ Video found in master sheet`);

      // 2. Check Script Approved status
      const scriptApproved = videoRow.data[this.sheetsService.masterColumns.scriptApproved];
      logger.info(`📋 Script Approved: ${scriptApproved || 'Not set'}`);

      // 3. Check detail workbook exists
      const detailWorkbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
      if (!detailWorkbookUrl) {
        logger.error(`❌ No detail workbook URL found`);
        return;
      }
      logger.info(`✅ Detail workbook exists: ${detailWorkbookUrl}`);

      // 4. Check drive folder exists
      const driveFolder = videoRow.data[this.sheetsService.masterColumns.driveFolder];
      if (!driveFolder) {
        logger.error(`❌ No Google Drive folder found`);
        return;
      }
      logger.info(`✅ Drive folder exists: ${driveFolder}`);

      // 5. Check Script Breakdown sheet has data
      try {
        const workbookId = detailWorkbookUrl.split('/d/')[1].split('/')[0];
        const response = await this.sheetsService.sheets.spreadsheets.values.get({
          spreadsheetId: workbookId,
          range: `${this.sheetsService.detailSheets.scriptBreakdown}!B:B`
        });

        const scriptTextValues = response.data.values || [];
        const scriptSentences = scriptTextValues.slice(1)
          .filter(row => row[0] && row[0].trim())
          .map(row => row[0].trim());

        if (scriptSentences.length > 0) {
          logger.info(`✅ Script Breakdown has ${scriptSentences.length} sentences`);
          
          // Sample first few sentences
          const sampleSentences = scriptSentences.slice(0, 3);
          logger.info(`📝 Sample sentences:`);
          sampleSentences.forEach((sentence, index) => {
            logger.info(`  ${index + 1}: ${sentence.substring(0, 100)}${sentence.length > 100 ? '...' : ''}`);
          });

        } else {
          logger.error(`❌ Script Breakdown sheet is empty or has no content in column B`);
          return;
        }
      } catch (sheetError) {
        logger.error(`❌ Error reading Script Breakdown sheet:`, sheetError.message);
        return;
      }

      // 6. Check if voice_script.txt already exists
      const folderId = driveFolder.split('/folders/')[1];
      if (folderId) {
        const existingFiles = await this.sheetsService.drive.files.list({
          q: `name='voice_script.txt' and parents in '${folderId}' and trashed=false`,
          fields: 'files(id, name, webViewLink, createdTime)'
        });

        if (existingFiles.data.files.length > 0) {
          const file = existingFiles.data.files[0];
          logger.info(`📄 voice_script.txt exists: ${file.webViewLink} (created: ${file.createdTime})`);
        } else {
          logger.info(`🆕 voice_script.txt does NOT exist - this is the issue!`);
        }
      }

      logger.info(`\n💡 Diagnosis complete for ${videoId}`);

    } catch (error) {
      logger.error(`💥 Diagnosis failed for ${videoId}:`, error.message);
    }
  }
}

async function main() {
  const tester = new VoiceScriptTester();
  
  // Check if a specific video ID was provided
  const videoId = process.argv[2];
  
  if (videoId) {
    logger.info(`🎯 Running diagnosis for specific video: ${videoId}`);
    await tester.diagnoseVideoIssues(videoId);
    
    // Also try to create the voice script
    try {
      logger.info(`\n🚀 Attempting to create voice script for ${videoId}...`);
      const result = await tester.sheetsService.createAndUploadVoiceScript(videoId, false);
      
      if (result && !result.skipped) {
        logger.info(`🎉 SUCCESS: Voice script created for ${videoId}`);
        logger.info(`🔗 View: ${result.viewLink}`);
      } else if (result && result.skipped) {
        logger.info(`ℹ️ Voice script already existed for ${videoId}`);
      } else {
        logger.error(`❌ Failed to create voice script for ${videoId}`);
      }
    } catch (creationError) {
      logger.error(`💥 Voice script creation failed for ${videoId}:`, creationError.message);
    }
  } else {
    logger.info(`🧪 Running general voice script creation test`);
    await tester.testVoiceScriptCreation();
  }
}

main().catch(error => {
  logger.error('🚨 Test script failed:', error);
  process.exit(1);
});