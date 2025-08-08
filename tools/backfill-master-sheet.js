#!/usr/bin/env node

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import MetadataService from '../src/services/metadataService.js';
import logger from '../src/utils/logger.js';

/**
 * Backfill master sheet with reliable metadata from immutable storage
 */
class MasterSheetBackfill {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.metadataService = new MetadataService();
  }

  async backfillAllVideos() {
    try {
      logger.info('🔄 Starting master sheet backfill with reliable metadata...');
      
      // Get all video IDs that have metadata files
      const videoIds = await this.metadataService.getAllVideoIds();
      logger.info(`Found ${videoIds.length} videos with reliable metadata`);

      let updated = 0;
      let errors = 0;

      for (const videoId of videoIds) {
        try {
          logger.info(`Processing ${videoId}...`);
          
          // Get reliable metadata
          const metadata = await this.metadataService.getReliableVideoMetadata(videoId);
          
          if (!metadata) {
            logger.warn(`No reliable metadata found for ${videoId}`);
            errors++;
            continue;
          }

          // Update master sheet with reliable data
          await this.updateMasterSheetRow(videoId, metadata);
          
          logger.info(`✅ Updated ${videoId}: "${metadata.title}"`);
          updated++;

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          logger.error(`Failed to update ${videoId}:`, error);
          errors++;
        }
      }

      logger.info(`\n📊 Backfill Results:`);
      logger.info(`  ✅ Updated: ${updated} videos`);
      logger.info(`  ❌ Errors: ${errors} videos`);
      logger.info(`  📋 Total: ${videoIds.length} videos`);

      return { updated, errors, total: videoIds.length };

    } catch (error) {
      logger.error('Backfill failed:', error);
      throw error;
    }
  }

  async updateMasterSheetRow(videoId, metadata) {
    try {
      // Find the video row
      const videoRow = await this.sheetsService.findVideoRow(videoId);
      if (!videoRow) {
        throw new Error(`Video row not found for ${videoId}`);
      }

      const rowIndex = videoRow.rowIndex;

      // Prepare the data to update
      const updates = [
        {
          range: `Videos!D${rowIndex}`, // Title column
          values: [[metadata.title || 'Title Unavailable']]
        },
        {
          range: `Videos!E${rowIndex}`, // Channel column
          values: [[metadata.channelTitle || 'Unknown Channel']]
        },
        {
          range: `Videos!F${rowIndex}`, // Duration column
          values: [[metadata.duration || 'Unknown']]
        },
        {
          range: `Videos!I${rowIndex}`, // YouTube Video ID column
          values: [[metadata.videoId || 'Unknown']]
        }
      ];

      // Batch update for efficiency
      const batchUpdateRequest = {
        spreadsheetId: this.sheetsService.masterSheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      };

      await this.sheetsService.sheets.spreadsheets.values.batchUpdate(batchUpdateRequest);

      logger.info(`Updated master sheet row ${rowIndex} for ${videoId}`);

    } catch (error) {
      logger.error(`Failed to update master sheet row for ${videoId}:`, error);
      throw error;
    }
  }

  async verifyBackfill() {
    try {
      logger.info('🔍 Verifying backfill results...');
      
      const videos = await this.sheetsService.getAllVideos();
      
      let populated = 0;
      let stillEmpty = 0;

      for (const video of videos) {
        const emptyFields = [];
        if (!video.title || video.title === 'Unknown Title') emptyFields.push('title');
        if (!video.channel) emptyFields.push('channel');
        if (!video.duration) emptyFields.push('duration');
        if (!video.youtubeVideoId) emptyFields.push('youtubeVideoId');

        if (emptyFields.length === 0) {
          populated++;
          logger.info(`✅ ${video.videoId}: All fields populated`);
        } else {
          stillEmpty++;
          logger.warn(`❌ ${video.videoId}: Missing ${emptyFields.join(', ')}`);
        }
      }

      logger.info(`\n📊 Verification Results:`);
      logger.info(`  ✅ Fully populated: ${populated} videos`);
      logger.info(`  ❌ Still missing data: ${stillEmpty} videos`);

      return { populated, stillEmpty, total: videos.length };

    } catch (error) {
      logger.error('Verification failed:', error);
      throw error;
    }
  }
}

// CLI execution
async function main() {
  const backfill = new MasterSheetBackfill();
  
  try {
    // Run backfill
    await backfill.backfillAllVideos();
    
    // Verify results
    await backfill.verifyBackfill();
    
    logger.info('🎉 Master sheet backfill complete!');
    
  } catch (error) {
    logger.error('Backfill process failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default MasterSheetBackfill;