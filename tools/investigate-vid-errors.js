#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import WorkflowService from '../src/services/workflowService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VideoErrorInvestigator {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.workflowService = new WorkflowService();
  }

  async investigateVideos(videoIds) {
    logger.info('🔍 Starting investigation of video processing errors...');
    
    const results = [];
    
    for (const videoId of videoIds) {
      logger.info(`\n📹 Investigating ${videoId}...`);
      
      try {
        // 1. Get video details from Google Sheets
        const videoDetails = await this.sheetsService.getVideoDetails(videoId);
        
        // 2. Get video status from Master Sheet
        const allVideos = await this.sheetsService.getAllVideos();
        const videoStatus = allVideos.find(v => v.videoId === videoId);
        
        // 3. Check if Drive folder exists and has files
        let driveContents = null;
        if (videoDetails?.driveFolder) {
          try {
            const folderId = this.extractFolderIdFromUrl(videoDetails.driveFolder);
            if (folderId) {
              driveContents = await this.sheetsService.driveService.listFilesInFolder(folderId);
            }
          } catch (driveError) {
            logger.warn(`Failed to check Drive folder for ${videoId}:`, driveError.message);
          }
        }
        
        // 4. Check if voice script exists
        let voiceScriptExists = false;
        if (driveContents && driveContents.files) {
          voiceScriptExists = driveContents.files.some(file => file.name === 'voice_script.txt');
        }
        
        // 5. Compile investigation results
        const investigation = {
          videoId,
          videoDetails: {
            exists: !!videoDetails,
            title: videoDetails?.title || 'Not Found',
            driveFolder: videoDetails?.driveFolder || 'Not Set',
            detailWorkbookUrl: videoDetails?.detailWorkbookUrl || 'Not Set',
            youtubeUrl: videoDetails?.youtubeUrl || 'Not Set'
          },
          masterSheetStatus: {
            exists: !!videoStatus,
            status: videoStatus?.status || 'Not Found',
            scriptApproved: videoStatus?.scriptApproved || 'Not Set',
            voiceGenerationStatus: videoStatus?.voiceGenerationStatus || 'Not Set',
            videoEditingStatus: videoStatus?.videoEditingStatus || 'Not Set'
          },
          driveFolder: {
            exists: !!driveContents,
            fileCount: driveContents?.files?.length || 0,
            files: driveContents?.files?.map(f => f.name) || [],
            voiceScriptExists
          },
          issues: []
        };
        
        // 6. Identify issues
        if (!videoDetails) {
          investigation.issues.push('Video details not found in database');
        }
        
        if (!videoStatus) {
          investigation.issues.push('Video not found in Master Sheet');
        }
        
        if (videoStatus?.status === 'Error') {
          investigation.issues.push('Video marked as Error in Master Sheet');
        }
        
        if (!videoDetails?.driveFolder) {
          investigation.issues.push('Drive folder not created');
        } else if (driveContents && driveContents.files.length === 0) {
          investigation.issues.push('Drive folder exists but is empty');
        }
        
        if (!voiceScriptExists && videoStatus?.scriptApproved === 'Approved') {
          investigation.issues.push('Script approved but voice_script.txt missing');
        }
        
        if (videoStatus?.status === 'Processing' && videoStatus?.scriptApproved === 'Approved') {
          investigation.issues.push('Script approved but status still Processing');
        }
        
        results.push(investigation);
        
        // Log immediate findings
        logger.info(`📊 ${videoId} Status: ${investigation.masterSheetStatus.status}`);
        logger.info(`📝 Script Approved: ${investigation.masterSheetStatus.scriptApproved}`);
        logger.info(`📁 Drive Files: ${investigation.driveFolder.fileCount}`);
        logger.info(`📄 Voice Script: ${voiceScriptExists ? '✅ Exists' : '❌ Missing'}`);
        logger.info(`❗ Issues Found: ${investigation.issues.length}`);
        
        if (investigation.issues.length > 0) {
          investigation.issues.forEach(issue => logger.warn(`  - ${issue}`));
        }
        
      } catch (error) {
        logger.error(`❌ Failed to investigate ${videoId}:`, error);
        results.push({
          videoId,
          error: error.message,
          issues: ['Investigation failed due to error']
        });
      }
    }
    
    return results;
  }

  async fixIdentifiedIssues(videoId) {
    logger.info(`🔧 Attempting to fix issues for ${videoId}...`);
    
    try {
      // 1. Get current video info
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      const allVideos = await this.sheetsService.getAllVideos();
      const videoStatus = allVideos.find(v => v.videoId === videoId);
      
      if (!videoDetails) {
        throw new Error(`Video ${videoId} not found in database`);
      }
      
      const fixes = [];
      
      // 2. Fix Drive folder if missing
      if (!videoDetails.driveFolder) {
        logger.info(`📁 Creating Drive folder for ${videoId}...`);
        const folderResult = await this.sheetsService.createVideoFolder(videoId, videoDetails.title);
        if (folderResult.success) {
          fixes.push('Created Drive folder');
          logger.info(`✅ Drive folder created: ${folderResult.folderUrl}`);
        }
      }
      
      // 3. Create voice script if approved but missing
      if (videoStatus?.scriptApproved === 'Approved') {
        logger.info(`📄 Creating voice script for ${videoId}...`);
        try {
          const voiceScriptResult = await this.sheetsService.createAndUploadVoiceScript(videoId, false);
          if (voiceScriptResult && !voiceScriptResult.skipped) {
            fixes.push('Created voice_script.txt');
            logger.info(`✅ Voice script created: ${voiceScriptResult.fileName}`);
          } else if (voiceScriptResult && voiceScriptResult.skipped) {
            logger.info(`📄 Voice script already exists for ${videoId}`);
          }
        } catch (voiceError) {
          logger.error(`❌ Failed to create voice script for ${videoId}:`, voiceError);
          fixes.push(`Voice script creation failed: ${voiceError.message}`);
        }
      }
      
      // 4. Process approved script if status is stuck
      if (videoStatus?.scriptApproved === 'Approved' && 
          (videoStatus?.status === 'Processing' || videoStatus?.status === 'Error')) {
        logger.info(`🔄 Processing approved script for ${videoId}...`);
        try {
          const processResult = await this.workflowService.processApprovedScript(videoDetails);
          if (processResult.success) {
            fixes.push('Processed approved script');
            logger.info(`✅ Approved script processed successfully for ${videoId}`);
          }
        } catch (processError) {
          logger.error(`❌ Failed to process approved script for ${videoId}:`, processError);
          fixes.push(`Script processing failed: ${processError.message}`);
        }
      }
      
      // 5. Reset error status if other fixes succeeded
      if (videoStatus?.status === 'Error' && fixes.length > 0 && 
          !fixes.some(fix => fix.includes('failed'))) {
        logger.info(`📊 Resetting error status for ${videoId}...`);
        await this.sheetsService.updateVideoStatus(videoId, 'Processing');
        fixes.push('Reset status from Error to Processing');
      }
      
      logger.info(`🔧 Fixes applied for ${videoId}: ${fixes.length}`);
      fixes.forEach(fix => logger.info(`  ✅ ${fix}`));
      
      return {
        videoId,
        success: true,
        fixes
      };
      
    } catch (error) {
      logger.error(`❌ Failed to fix issues for ${videoId}:`, error);
      return {
        videoId,
        success: false,
        error: error.message
      };
    }
  }

  extractFolderIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  async run() {
    try {
      const videoIds = ['VID-0008', 'VID-0013'];
      
      logger.info('🔍 Phase 1: Investigating video processing errors...');
      const investigationResults = await this.investigateVideos(videoIds);
      
      logger.info('\n📊 Investigation Summary:');
      investigationResults.forEach(result => {
        logger.info(`\n${result.videoId}:`);
        logger.info(`  Issues: ${result.issues?.length || 0}`);
        if (result.issues && result.issues.length > 0) {
          result.issues.forEach(issue => logger.info(`    - ${issue}`));
        }
      });
      
      logger.info('\n🔧 Phase 2: Attempting to fix identified issues...');
      const fixResults = [];
      
      for (const videoId of videoIds) {
        const investigation = investigationResults.find(r => r.videoId === videoId);
        if (investigation && investigation.issues && investigation.issues.length > 0) {
          logger.info(`\n🔧 Fixing issues for ${videoId}...`);
          const fixResult = await this.fixIdentifiedIssues(videoId);
          fixResults.push(fixResult);
        } else {
          logger.info(`\n✅ No issues found for ${videoId}, skipping fixes`);
        }
      }
      
      logger.info('\n📋 Final Results:');
      fixResults.forEach(result => {
        logger.info(`\n${result.videoId}: ${result.success ? '✅ Fixed' : '❌ Failed'}`);
        if (result.fixes) {
          result.fixes.forEach(fix => logger.info(`  ✅ ${fix}`));
        }
        if (result.error) {
          logger.error(`  ❌ ${result.error}`);
        }
      });
      
      logger.info('\n🎬 Investigation and fix attempt completed!');
      
    } catch (error) {
      logger.error('❌ Investigation failed:', error);
      process.exit(1);
    }
  }
}

// Run the investigation
const investigator = new VideoErrorInvestigator();
investigator.run().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});