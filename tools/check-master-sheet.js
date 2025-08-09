import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

async function checkMasterSheetData() {
  try {
    console.log('🔍 Checking master sheet metadata population...');
    
    const sheetsService = new GoogleSheetsService();
    
    // Get all videos from master sheet
    const videos = await sheetsService.getAllVideos();
    console.log(`Found ${videos.length} videos in master sheet\n`);
    
    for (const video of videos) {
      console.log(`📄 ${video.videoId}:`);
      console.log(`  Title: "${video.title || 'EMPTY'}"`);
      console.log(`  YouTube URL: "${video.youtubeUrl || 'EMPTY'}"`);
      console.log(`  Channel: "${video.channel || 'EMPTY'}"`);
      console.log(`  Duration: "${video.duration || 'EMPTY'}"`);
      console.log(`  YouTube Video ID: "${video.youtubeVideoId || 'EMPTY'}"`);
      console.log(`  Status: "${video.status || 'EMPTY'}"`);
      
      // Count empty fields
      const emptyFields = [];
      if (!video.title || video.title.trim() === '') emptyFields.push('title');
      if (!video.youtubeUrl || video.youtubeUrl.trim() === '') emptyFields.push('youtubeUrl');
      if (!video.channel || video.channel.trim() === '') emptyFields.push('channel');
      if (!video.duration || video.duration.trim() === '') emptyFields.push('duration');
      if (!video.youtubeVideoId || video.youtubeVideoId.trim() === '') emptyFields.push('youtubeVideoId');
      
      if (emptyFields.length > 0) {
        console.log(`  ❌ Empty fields: ${emptyFields.join(', ')}`);
      } else {
        console.log(`  ✅ All metadata populated`);
      }
      console.log('');
    }
    
  } catch (error) {
    logger.error('Failed to check master sheet:', error);
  }
}

checkMasterSheetData();