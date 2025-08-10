#!/usr/bin/env node

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

async function checkVideoStatus() {
  try {
    const sheetsService = new GoogleSheetsService();
    
    const videoIds = ['VID-0008', 'VID-0013'];
    
    for (const videoId of videoIds) {
      const allVideos = await sheetsService.getAllVideos();
      const video = allVideos.find(v => v.videoId === videoId);
      
      if (video) {
        logger.info(`\n${videoId}:`);
        logger.info(`  Title: ${video.title}`);
        logger.info(`  Status: ${video.status}`);
        logger.info(`  Script Approved: ${video.scriptApproved || 'Not Set'}`);
        logger.info(`  Voice Generation: ${video.voiceGenerationStatus || 'Not Set'}`);
        logger.info(`  Video Editing: ${video.videoEditingStatus || 'Not Set'}`);
        logger.info(`  Drive Folder: ${video.driveFolder || 'Not Set'}`);
        logger.info(`  Detail Workbook: ${video.detailWorkbookUrl || 'Not Set'}`);
      } else {
        logger.info(`\n${videoId}: NOT FOUND`);
      }
    }
    
  } catch (error) {
    logger.error('Failed to check status:', error);
  }
}

checkVideoStatus();