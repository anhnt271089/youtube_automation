#!/usr/bin/env node

/**
 * Utility script to fix missing video titles by re-fetching from YouTube
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import YouTubeService from '../src/services/youtubeService.js';
import logger from '../src/utils/logger.js';

class TitleFixer {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.youtubeService = new YouTubeService();
  }

  async findVideosWithMissingTitles() {
    try {
      logger.info('🔍 Searching for videos with missing titles...');
      
      const allVideos = await this.sheetsService.getAllVideos();
      const videosWithMissingTitles = allVideos.filter(video => {
        const title = video.title;
        return !title || 
               title.trim() === '' || 
               title === 'YouTube Title Not Retrieved' ||
               title === 'Processing...' ||
               title === 'Unknown Title' ||
               title.includes('Title Missing');
      });
      
      logger.info(`Found ${videosWithMissingTitles.length} videos with missing titles:`);
      videosWithMissingTitles.forEach(video => {
        logger.info(`  - ${video.videoId}: "${video.title}" (URL: ${video.youtubeUrl})`);
      });
      
      return videosWithMissingTitles;
    } catch (error) {
      logger.error('Error finding videos with missing titles:', error);
      throw error;
    }
  }

  async fixMissingTitle(video) {
    try {
      logger.info(`🔧 Fixing title for ${video.videoId}...`);
      
      if (!video.youtubeUrl) {
        logger.warn(`No YouTube URL found for ${video.videoId}, cannot fix title`);
        return false;
      }
      
      // Re-fetch metadata from YouTube
      const metadata = await this.youtubeService.getVideoMetadata(video.youtubeUrl);
      
      if (metadata.title && metadata.title !== 'Unknown Title') {
        // Update the title in Google Sheets
        await this.sheetsService.updateVideoField(video.videoId, 'title', metadata.title);
        
        logger.info(`✅ Fixed title for ${video.videoId}: "${metadata.title}"`);
        return true;
      } else {
        logger.warn(`❌ Could not retrieve title for ${video.videoId} from YouTube`);
        return false;
      }
    } catch (error) {
      logger.error(`Error fixing title for ${video.videoId}:`, error);
      return false;
    }
  }

  async fixAllMissingTitles() {
    try {
      logger.info('🚀 Starting missing title fix process...');
      
      const videosWithMissingTitles = await this.findVideosWithMissingTitles();
      
      if (videosWithMissingTitles.length === 0) {
        logger.info('🎉 No videos with missing titles found!');
        return { fixed: 0, total: 0 };
      }
      
      let fixedCount = 0;
      
      for (const video of videosWithMissingTitles) {
        const wasFixed = await this.fixMissingTitle(video);
        if (wasFixed) {
          fixedCount++;
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      logger.info(`\n📊 Title fix summary:`);
      logger.info(`  - Total videos with missing titles: ${videosWithMissingTitles.length}`);
      logger.info(`  - Successfully fixed: ${fixedCount}`);
      logger.info(`  - Failed to fix: ${videosWithMissingTitles.length - fixedCount}`);
      
      return { fixed: fixedCount, total: videosWithMissingTitles.length };
      
    } catch (error) {
      logger.error('Error in title fix process:', error);
      throw error;
    }
  }
}

// Run the fix if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new TitleFixer();
  
  fixer.fixAllMissingTitles()
    .then(result => {
      if (result.fixed > 0) {
        logger.info('\n🏆 TITLE FIX PROCESS COMPLETED SUCCESSFULLY');
        logger.info(`Fixed ${result.fixed}/${result.total} videos`);
      } else {
        logger.info('\n⚠️ NO TITLES WERE FIXED');
      }
      process.exit(0);
    })
    .catch(error => {
      logger.error('Title fix process failed:', error);
      process.exit(1);
    });
}

export default TitleFixer;