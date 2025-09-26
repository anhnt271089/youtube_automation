#!/usr/bin/env node

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';
import {
  formatHeader,
  formatSubHeader,
  formatSuccess,
  formatError,
  formatInfo,
  formatListItem,
  EMOJIS
} from '../src/utils/consoleFormatter.js';

async function checkVideoStatus() {
  try {
    console.log(formatHeader('Video Status Check', { emoji: EMOJIS.VALIDATING }));
    
    const sheetsService = new GoogleSheetsService();
    const videoIds = ['VID-0008', 'VID-0013'];
    
    for (const videoId of videoIds) {
      const allVideos = await sheetsService.getAllVideos();
      const video = allVideos.find(v => v.videoId === videoId);
      
      if (video) {
        console.log(formatSubHeader(videoId, { emoji: EMOJIS.VIDEO }));
        console.log(formatListItem(`Title: ${video.title}`));
        console.log(formatListItem(`Status: ${video.status}`));
        console.log(formatListItem(`Script Approved: ${video.scriptApproved || 'Not Set'}`));
        console.log(formatListItem(`Voice Generation: ${video.voiceGenerationStatus || 'Not Set'}`));
        console.log(formatListItem(`Video Editing: ${video.videoEditingStatus || 'Not Set'}`));
        console.log(formatListItem(`Drive Folder: ${video.driveFolder || 'Not Set'}`));
        console.log(formatListItem(`Detail Workbook: ${video.detailWorkbookUrl || 'Not Set'}`));
      } else {
        console.log(formatError(`${videoId}: NOT FOUND`));
      }
    }
    
  } catch (error) {
    logger.error('Failed to check status:', error);
    console.error(formatError(`Failed to check status: ${error.message}`));
  }
}

checkVideoStatus();