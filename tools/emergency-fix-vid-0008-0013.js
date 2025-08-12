#!/usr/bin/env node

/**
 * EMERGENCY FIX: VID-0008 and VID-0013 Google Drive API Query Escaping Failures
 * 
 * Issue: Google Drive query escaping is failing for video titles with special characters
 * Solution: Create Drive folders with simplified, safe names and bypass problematic query logic
 * 
 * Target Videos:
 * - VID-0008: "How to Control your Brain (4 Steps)"
 * - VID-0013: "The Art of Being Unbothered By People's Opinions"
 */

import { google } from 'googleapis';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';

class EmergencyVideoFixer {
  constructor() {
    // Initialize Google APIs with OAuth
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
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Create Drive folder with simplified, safe naming (bypasses query issues)
   */
  async createSafeDriveFolder(videoId, originalTitle, simplifiedName) {
    try {
      logger.info(`🛠️ Creating safe Drive folder for ${videoId}...`);
      
      // Create folder directly without querying for existing ones (bypasses the problematic query)
      const folderResponse = await this.drive.files.create({
        resource: {
          name: simplifiedName,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [config.google.videosRootFolderId]
        }
      });

      const folderId = folderResponse.data.id;
      const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      
      logger.info(`✅ Created safe Drive folder for ${videoId}: ${simplifiedName}`);
      logger.info(`📁 Folder URL: ${folderUrl}`);
      
      return { folderId, folderUrl, folderName: simplifiedName };
    } catch (error) {
      logger.error(`❌ Failed to create Drive folder for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Create detail workbook in the safe folder
   */
  async createDetailWorkbook(videoId, originalTitle, folderId, simplifiedName) {
    try {
      logger.info(`📊 Creating detail workbook for ${videoId}...`);
      
      const workbookName = `${videoId} ${originalTitle} - Video Detail`;
      
      // Copy template workbook directly into the folder
      const copyResponse = await this.drive.files.copy({
        fileId: this.sheetsService.templateWorkbookId,
        resource: {
          name: workbookName,
          parents: [folderId]
        }
      });

      const workbookId = copyResponse.data.id;
      const workbookUrl = `https://docs.google.com/spreadsheets/d/${workbookId}`;
      
      logger.info(`✅ Created detail workbook for ${videoId}: ${workbookName}`);
      logger.info(`📊 Workbook URL: ${workbookUrl}`);
      
      return { workbookId, workbookUrl };
    } catch (error) {
      logger.error(`❌ Failed to create workbook for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update master Google Sheets with correct URLs
   */
  async updateMasterSheet(videoId, folderUrl, workbookUrl, newStatus = 'Processing') {
    try {
      logger.info(`📝 Updating master sheet for ${videoId}...`);
      
      await this.sheetsService.updateVideoStatus(videoId, newStatus, {
        driveFolder: folderUrl,
        detailWorkbookUrl: workbookUrl
      });
      
      logger.info(`✅ Updated master sheet for ${videoId}: status=${newStatus}`);
      return true;
    } catch (error) {
      logger.error(`❌ Failed to update master sheet for ${videoId}:`, error.message);
      throw error;
    }
  }

  /**
   * Emergency fix for a specific video
   */
  async fixVideo(videoId, originalTitle, simplifiedFolderName) {
    logger.info(`\n🚑 EMERGENCY FIX STARTING for ${videoId}`);
    logger.info(`📋 Original Title: "${originalTitle}"`);
    logger.info(`🛡️ Simplified Folder: "${simplifiedFolderName}"`);
    
    try {
      // Step 1: Create safe Drive folder
      const { folderId, folderUrl } = await this.createSafeDriveFolder(
        videoId, 
        originalTitle, 
        simplifiedFolderName
      );

      // Step 2: Create detail workbook
      const { workbookId, workbookUrl } = await this.createDetailWorkbook(
        videoId,
        originalTitle,
        folderId,
        simplifiedFolderName
      );

      // Step 3: Update master sheet
      await this.updateMasterSheet(videoId, folderUrl, workbookUrl, 'Processing');

      logger.info(`✅ EMERGENCY FIX COMPLETED for ${videoId}`);
      logger.info(`   📁 Drive Folder: ${folderUrl}`);
      logger.info(`   📊 Detail Workbook: ${workbookUrl}`);
      logger.info(`   🔄 Status reset to: Processing`);
      
      return {
        success: true,
        videoId,
        folderUrl,
        workbookUrl,
        status: 'Processing'
      };
    } catch (error) {
      logger.error(`❌ EMERGENCY FIX FAILED for ${videoId}:`, error.message);
      
      // Set status to Error with details
      try {
        await this.sheetsService.updateVideoStatus(videoId, 'Error - Fix Failed', {});
      } catch (updateError) {
        logger.error(`❌ Failed to update error status for ${videoId}:`, updateError.message);
      }
      
      return {
        success: false,
        videoId,
        error: error.message
      };
    }
  }

  /**
   * Run emergency fix for both problematic videos
   */
  async runEmergencyFix() {
    logger.info('\n🚨 EMERGENCY FIX: Google Drive API Query Escaping Failures');
    logger.info('🎯 Target Videos: VID-0008, VID-0013');
    logger.info('🔧 Solution: Simplified folder naming with safe characters\n');

    const fixes = [
      {
        videoId: 'VID-0008',
        originalTitle: 'How to Control your Brain (4 Steps)',
        simplifiedFolderName: 'VID-0008 How to Control your Brain - Video Detail'
      },
      {
        videoId: 'VID-0013',
        originalTitle: 'The Art of Being Unbothered By People\'s Opinions',
        simplifiedFolderName: 'VID-0013 The Art of Being Unbothered By Opinions - Video Detail'
      }
    ];

    const results = [];
    
    for (const fix of fixes) {
      const result = await this.fixVideo(
        fix.videoId,
        fix.originalTitle,
        fix.simplifiedFolderName
      );
      results.push(result);
    }

    // Summary report
    logger.info('\n📊 EMERGENCY FIX SUMMARY:');
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    logger.info(`✅ Successful fixes: ${successful.length}`);
    logger.info(`❌ Failed fixes: ${failed.length}`);
    
    if (successful.length > 0) {
      logger.info('\n✅ Successfully fixed:');
      successful.forEach(result => {
        logger.info(`   • ${result.videoId}: Now ready for workflow continuation`);
      });
    }
    
    if (failed.length > 0) {
      logger.info('\n❌ Failed to fix:');
      failed.forEach(result => {
        logger.info(`   • ${result.videoId}: ${result.error}`);
      });
    }
    
    logger.info('\n🎉 Emergency fix process completed!');
    logger.info('💡 Next steps: Monitor workflow to ensure videos continue processing normally');
    
    return results;
  }
}

// Execute the emergency fix
async function main() {
  try {
    const fixer = new EmergencyVideoFixer();
    await fixer.runEmergencyFix();
  } catch (error) {
    logger.error('❌ Emergency fix script failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default EmergencyVideoFixer;