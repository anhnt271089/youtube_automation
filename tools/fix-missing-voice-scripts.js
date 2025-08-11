#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VoiceScriptFixer {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.telegramService = new TelegramService();
  }

  async findAndFixMissingVoiceScripts() {
    try {
      logger.info('🔍 Scanning for videos with approved scripts but missing voice_script.txt files...');

      // Get all videos with approved scripts
      const approvedVideos = await this.sheetsService.getVideosWithApprovedScripts();
      
      if (approvedVideos.length === 0) {
        logger.info('❌ No videos with approved scripts found');
        return { processed: 0, fixed: 0, errors: 0 };
      }

      logger.info(`📋 Found ${approvedVideos.length} videos with approved scripts`);

      let processed = 0;
      let fixed = 0;
      let errors = 0;
      let skipped = 0;

      for (const video of approvedVideos) {
        const videoId = video.videoId;
        processed++;
        
        try {
          logger.info(`\n[${processed}/${approvedVideos.length}] 🎬 Processing: ${videoId}`);

          // Check if voice_script.txt already exists
          const videoRow = await this.sheetsService.findVideoRow(videoId);
          if (!videoRow || !videoRow.data[this.sheetsService.masterColumns.driveFolder]) {
            logger.warn(`⚠️ ${videoId}: No drive folder found - skipping`);
            continue;
          }

          const driveFolder = videoRow.data[this.sheetsService.masterColumns.driveFolder];
          const folderId = driveFolder.split('/folders/')[1];
          
          if (!folderId) {
            logger.warn(`⚠️ ${videoId}: Invalid drive folder URL - skipping`);
            continue;
          }

          // Check if voice_script.txt exists
          const existingFiles = await this.sheetsService.drive.files.list({
            q: `name='voice_script.txt' and parents in '${folderId}' and trashed=false`,
            fields: 'files(id, name, webViewLink)'
          });

          if (existingFiles.data.files.length > 0) {
            logger.info(`✅ ${videoId}: voice_script.txt already exists - skipping`);
            skipped++;
            continue;
          }

          // Missing voice script - create it
          logger.info(`🚨 ${videoId}: Missing voice_script.txt - creating now...`);
          
          const voiceScriptResult = await this.sheetsService.createAndUploadVoiceScript(videoId, false);
          
          if (voiceScriptResult && !voiceScriptResult.skipped) {
            fixed++;
            logger.info(`🎉 ${videoId}: SUCCESS! Voice script created: ${voiceScriptResult.fileName}`);
            
            // Send success notification for each fixed video
            await this.telegramService.sendMessage(
              `✅ <b>Voice Script FIXED</b>\n\n` +
              `🎬 ${videoId} - ${video.title || 'Unknown Title'}\n` +
              `📄 File: ${voiceScriptResult.fileName}\n` +
              `🔗 <a href="${voiceScriptResult.viewLink}">View File</a>\n\n` +
              `🛠 Fixed by automation tool`
            );
            
          } else {
            errors++;
            logger.error(`❌ ${videoId}: Failed to create voice script`);
          }

        } catch (videoError) {
          errors++;
          logger.error(`💥 ${videoId}: Error during processing:`, videoError.message);
        }

        // Brief delay between videos to avoid rate limits
        if (processed < approvedVideos.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const summary = { processed, fixed, errors, skipped };
      
      logger.info(`\n📊 SUMMARY:`);
      logger.info(`  Processed: ${processed} videos`);
      logger.info(`  Fixed: ${fixed} voice scripts`);
      logger.info(`  Skipped: ${skipped} (already exist)`);
      logger.info(`  Errors: ${errors}`);

      // Send summary notification
      await this.telegramService.sendMessage(
        `📊 <b>Voice Script Fix Summary</b>\n\n` +
        `🎬 Processed: ${processed} videos\n` +
        `✅ Fixed: ${fixed} voice scripts\n` +
        `⏩ Skipped: ${skipped} (already exist)\n` +
        `❌ Errors: ${errors}\n\n` +
        `${fixed > 0 ? '🎉 Missing voice scripts have been created!' : '✨ All voice scripts are up to date!'}`
      );

      return summary;

    } catch (error) {
      logger.error('💥 Voice script fix process failed:', error);
      
      await this.telegramService.sendMessage(
        `❌ <b>Voice Script Fix FAILED</b>\n\n` +
        `🔧 Error: ${error.message}\n\n` +
        `🛠 Check logs for details`
      );
      
      throw error;
    }
  }
}

async function main() {
  const fixer = new VoiceScriptFixer();
  
  try {
    const result = await fixer.findAndFixMissingVoiceScripts();
    
    if (result.fixed > 0) {
      logger.info(`🎉 Successfully fixed ${result.fixed} missing voice script files!`);
    } else {
      logger.info(`✨ All voice script files are up to date!`);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('🚨 Fix process failed:', error);
    process.exit(1);
  }
}

main();