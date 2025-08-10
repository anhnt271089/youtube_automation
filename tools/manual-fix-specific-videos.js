#!/usr/bin/env node

/**
 * Manual Fix Tool for VID-0008 and VID-0013
 * Simple approach to create workbooks directly without complex file name searches
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';

class ManualVideoFixer {
  constructor() {
    // Setup Google APIs
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
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Fix videos by manually creating workbooks and updating master sheet
   */
  async fixVideos(videoIds) {
    logger.info(`🔧 Starting manual fix for videos: ${videoIds.join(', ')}`);
    
    const results = {
      videoIds,
      fixes: [],
      summary: { successful: 0, failed: 0 }
    };

    for (const videoId of videoIds) {
      logger.info(`\n🎯 ===== FIXING ${videoId} =====`);
      
      const fix = {
        videoId,
        timestamp: new Date().toISOString(),
        actions: [],
        success: false,
        errors: []
      };

      try {
        // 1. Get current video data
        const videoDetails = await this.sheetsService.getVideoDetails(videoId);
        if (!videoDetails) {
          fix.errors.push(`Video ${videoId} not found in master sheet`);
          results.fixes.push(fix);
          continue;
        }

        logger.info(`📋 Found video: ${videoDetails.title}`);

        // 2. Update status to clear error
        logger.info(`🧹 Clearing error status...`);
        await this.sheetsService.updateVideoStatus(videoId, 'New');
        fix.actions.push({ action: 'CLEAR_ERROR_STATUS', success: true });

        // 3. Get or create folder (folders already exist from previous attempt)
        let folderId;
        if (videoDetails.driveFolder) {
          // Extract folder ID from existing URL
          const folderMatch = videoDetails.driveFolder.match(/\/folders\/([a-zA-Z0-9-_]+)/);
          if (folderMatch) {
            folderId = folderMatch[1];
            logger.info(`📁 Using existing folder: ${videoDetails.driveFolder}`);
            fix.actions.push({ action: 'USE_EXISTING_FOLDER', success: true, folderId });
          }
        }

        if (!folderId) {
          // Create simple folder name without special characters
          const simpleFolderName = `${videoId} ${videoDetails.title.replace(/[()]/g, '').trim()}`;
          
          const folderResponse = await this.drive.files.create({
            resource: {
              name: simpleFolderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [config.google.videosRootFolderId]
            }
          });

          folderId = folderResponse.data.id;
          const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
          
          // Update master sheet with folder URL
          await this.sheetsService.updateVideoField(videoId, 'driveFolder', folderUrl);
          
          logger.info(`📁 Created new folder: ${folderUrl}`);
          fix.actions.push({ action: 'CREATE_FOLDER', success: true, folderId, folderUrl });
        }

        // 4. Create detail workbook directly
        logger.info(`📊 Creating detail workbook...`);
        
        const workbookName = `${videoId} ${videoDetails.title.replace(/[()]/g, '').substring(0, 50)} - Video Detail`;
        
        const copyResponse = await this.drive.files.copy({
          fileId: config.google.templateWorkbookId,
          resource: {
            name: workbookName,
            parents: [folderId]
          }
        });

        const workbookId = copyResponse.data.id;
        const workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}`;

        // Update master sheet with workbook URL
        await this.sheetsService.updateVideoField(videoId, 'detailWorkbookUrl', workbookUrl);

        logger.info(`📊 Created workbook: ${workbookUrl}`);
        fix.actions.push({ action: 'CREATE_WORKBOOK', success: true, workbookId, workbookUrl });

        // 5. Basic population of Video Info sheet
        logger.info(`📝 Populating workbook with basic info...`);
        
        const videoInfoData = [
          ['Video Title', videoDetails.title],
          ['YouTube URL', videoDetails.youtubeUrl],
          ['YouTube Video ID', videoDetails.youtubeVideoId],
          ['Channel', videoDetails.channel],
          ['Duration', videoDetails.duration],
          ['View Count', videoDetails.viewCount],
          ['Published Date', videoDetails.publishedDate],
          ['', ''],
          ['Status', 'Workbook created - ready for script generation'],
          ['Processing Date', new Date().toISOString()],
          ['', ''],
          ['NEXT STEPS', 'Run main workflow to generate script content']
        ];

        await this.sheets.spreadsheets.values.update({
          spreadsheetId: workbookId,
          range: 'Video Info!A1:B12',
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: videoInfoData
          }
        });

        fix.actions.push({ action: 'POPULATE_BASIC_INFO', success: true });

        // 6. Update video status to indicate ready for processing
        await this.sheetsService.updateVideoStatus(videoId, 'Ready for Processing');
        fix.actions.push({ action: 'UPDATE_STATUS', success: true });

        fix.success = true;
        results.summary.successful++;
        logger.info(`✅ Successfully fixed ${videoId}`);

      } catch (error) {
        logger.error(`❌ Fix failed for ${videoId}:`, error);
        fix.errors.push(error.message);
        fix.success = false;
        results.summary.failed++;
      }

      results.fixes.push(fix);
    }

    this.generateFixSummary(results);
    return results;
  }

  /**
   * Generate fix summary
   */
  generateFixSummary(results) {
    logger.info('\n' + '='.repeat(60));
    logger.info('🔧 MANUAL FIX SUMMARY REPORT');
    logger.info('='.repeat(60));

    logger.info(`\n📊 RESULTS:`);
    logger.info(`   ✅ Successfully Fixed: ${results.summary.successful}`);
    logger.info(`   ❌ Failed: ${results.summary.failed}`);

    for (const fix of results.fixes) {
      const status = fix.success ? '✅ SUCCESS' : '❌ FAILED';
      logger.info(`\n🎯 ${fix.videoId}: ${status}`);
      
      logger.info(`   🔧 Actions: ${fix.actions.length}`);
      fix.actions.forEach(action => {
        const actionStatus = action.success ? '✅' : '❌';
        logger.info(`      ${actionStatus} ${action.action}`);
      });

      if (fix.errors.length > 0) {
        logger.info(`   ⚠️ Errors: ${fix.errors.join(', ')}`);
      }
    }

    logger.info('\n🎉 NEXT STEPS:');
    logger.info('   1. Check Google Sheets - videos should now have status "Ready for Processing"');
    logger.info('   2. Drive folders and workbooks should be created and linked');
    logger.info('   3. Run main workflow to generate script content');
    logger.info('   4. Videos can now proceed through normal workflow');

    logger.info('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  try {
    const fixer = new ManualVideoFixer();
    const videoIds = ['VID-0008', 'VID-0013'];
    
    const results = await fixer.fixVideos(videoIds);
    
    // Save results
    const fs = await import('fs').then(m => m.promises);
    const resultsFile = `manual-fix-results-${Date.now()}.json`;
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    logger.info(`📁 Fix results saved to: ${resultsFile}`);
    
  } catch (error) {
    logger.error('❌ Manual fix failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default ManualVideoFixer;