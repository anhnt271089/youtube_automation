#!/usr/bin/env node

/**
 * Metadata Recovery Tool
 * 
 * This tool helps recover from metadata corruption and validates integrity
 * between immutable files and Google Sheets data.
 * 
 * Usage:
 *   node tools/metadata-recovery.js --validate-all
 *   node tools/metadata-recovery.js --video-id=VID-0001 --auto-fix
 *   node tools/metadata-recovery.js --report
 *   node tools/metadata-recovery.js --migrate-existing
 */

import { program } from 'commander';
import MetadataService from '../src/services/metadataService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import YouTubeService from '../src/services/youtubeService.js';
import MetadataValidator from '../src/utils/metadataValidator.js';
import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';

class MetadataRecoveryTool {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.youtubeService = new YouTubeService();
    this.metadataService = new MetadataService(this.sheetsService, this.youtubeService);
    this.telegramService = new TelegramService();
  }

  async validateAll() {
    try {
      logger.info('🔍 Starting comprehensive metadata validation...');
      
      const allVideoIds = await this.metadataService.getAllVideoIds();
      logger.info(`Found ${allVideoIds.length} videos with metadata files`);

      const results = {
        total: allVideoIds.length,
        valid: 0,
        corrupted: 0,
        sheetDiscrepancies: 0,
        errors: []
      };

      for (const videoId of allVideoIds) {
        try {
          // Validate file integrity
          const fileMetadata = await this.metadataService.loadFromFile(videoId);
          const isFileValid = this.metadataService.validateIntegrity(fileMetadata);
          
          if (!isFileValid) {
            results.corrupted++;
            results.errors.push({ videoId, type: 'file_corruption', message: 'File integrity validation failed' });
            continue;
          }

          // Validate against sheet data
          const sheetIntegrity = await this.metadataService.validateSheetIntegrity(videoId);
          
          if (!sheetIntegrity.isValid) {
            results.sheetDiscrepancies++;
            results.errors.push({ 
              videoId, 
              type: 'sheet_discrepancy', 
              message: `Sheet data mismatch: ${sheetIntegrity.discrepancies.length} fields`,
              discrepancies: sheetIntegrity.discrepancies
            });
          }

          results.valid++;
          
        } catch (error) {
          results.errors.push({ videoId, type: 'validation_error', message: error.message });
        }
      }

      // Generate report
      logger.info('\n📊 Validation Results:');
      logger.info(`  Total videos: ${results.total}`);
      logger.info(`  Valid: ${results.valid}`);
      logger.info(`  File corrupted: ${results.corrupted}`);
      logger.info(`  Sheet discrepancies: ${results.sheetDiscrepancies}`);
      logger.info(`  Errors: ${results.errors.length}`);

      if (results.errors.length > 0) {
        logger.info('\n⚠️  Issues found:');
        results.errors.forEach(error => {
          logger.warn(`  ${error.videoId}: ${error.type} - ${error.message}`);
        });
      }

      return results;

    } catch (error) {
      logger.error('Failed to validate metadata:', error);
      throw error;
    }
  }

  async autoFixVideo(videoId) {
    try {
      logger.info(`🔧 Auto-fixing metadata for ${videoId}...`);

      // Check if file exists and is valid
      const fileMetadata = await this.metadataService.loadFromFile(videoId);
      
      if (fileMetadata && this.metadataService.validateIntegrity(fileMetadata)) {
        logger.info(`File metadata is valid for ${videoId}`);
        
        // Check sheet integrity
        const sheetIntegrity = await this.metadataService.validateSheetIntegrity(videoId);
        
        if (!sheetIntegrity.isValid) {
          logger.info(`Fixing sheet discrepancies for ${videoId}...`);
          
          // Restore correct data from file to sheet
          const original = fileMetadata.originalMetadata;
          
          for (const discrepancy of sheetIntegrity.discrepancies) {
            const field = discrepancy.field;
            const correctValue = discrepancy.original;
            
            logger.info(`Fixing ${field}: "${discrepancy.sheet}" → "${correctValue}"`);
            
            // Map field names to sheet update methods
            switch (field) {
            case 'title':
              await this.sheetsService.updateVideoField(videoId, 'title', correctValue);
              break;
            case 'youtubeUrl':
              await this.sheetsService.updateVideoField(videoId, 'youtubeUrl', correctValue);
              break;
            case 'channelTitle':
              await this.sheetsService.updateVideoField(videoId, 'channel', correctValue);
              break;
            case 'duration':
              await this.sheetsService.updateVideoField(videoId, 'duration', correctValue);
              break;
            }
          }
          
          logger.info(`✅ Fixed ${sheetIntegrity.discrepancies.length} sheet discrepancies for ${videoId}`);
        }
        
        return { success: true, action: 'fixed_sheet_discrepancies' };
      }

      // File is missing or corrupted, try to recover
      logger.info(`File metadata missing/corrupted for ${videoId}, attempting recovery...`);
      
      const sheetData = await this.sheetsService.findVideoRow(videoId);
      if (sheetData && sheetData.data && sheetData.data[this.sheetsService.masterColumns.youtubeUrl]) {
        const youtubeUrl = sheetData.data[this.sheetsService.masterColumns.youtubeUrl];
        
        logger.info(`Re-fetching metadata from YouTube: ${youtubeUrl}`);
        const freshMetadata = await this.youtubeService.getCompleteVideoData(youtubeUrl);
        
        await this.metadataService.saveOriginalMetadata(videoId, freshMetadata);
        
        logger.info(`✅ Recovered metadata for ${videoId}: ${freshMetadata.title}`);
        return { success: true, action: 'recovered_from_youtube' };
      }

      throw new Error(`Cannot recover metadata for ${videoId} - no reliable source found`);

    } catch (error) {
      logger.error(`Failed to auto-fix ${videoId}:`, error);
      return { success: false, error: error.message };
    }
  }

  async generateReport() {
    try {
      logger.info('📊 Generating metadata integrity report...');
      
      const validationResults = await this.validateAll();
      
      const report = {
        timestamp: new Date().toISOString(),
        summary: {
          totalVideos: validationResults.total,
          healthyVideos: validationResults.valid,
          corruptedFiles: validationResults.corrupted,
          sheetDiscrepancies: validationResults.sheetDiscrepancies,
          overallHealth: ((validationResults.valid / validationResults.total) * 100).toFixed(1) + '%'
        },
        issues: validationResults.errors,
        recommendations: []
      };

      // Generate recommendations
      if (validationResults.corrupted > 0) {
        report.recommendations.push(`Run auto-fix for ${validationResults.corrupted} corrupted files`);
      }
      if (validationResults.sheetDiscrepancies > 0) {
        report.recommendations.push(`Fix ${validationResults.sheetDiscrepancies} sheet discrepancies`);
      }
      if (validationResults.errors.length === 0) {
        report.recommendations.push('All metadata is healthy! No action needed.');
      }

      // Save report
      const fs = await import('fs');
      const reportPath = `data/metadata/integrity_report_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      
      logger.info(`Report saved to: ${reportPath}`);
      logger.info('\n📋 Summary:');
      logger.info(`  Overall Health: ${report.summary.overallHealth}`);
      logger.info(`  Issues: ${report.issues.length}`);
      logger.info(`  Recommendations: ${report.recommendations.length}`);

      return report;

    } catch (error) {
      logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  async migrateExistingVideos() {
    try {
      logger.info('🚚 Migrating existing videos to immutable metadata storage...');
      
      const allVideos = await this.sheetsService.getAllVideos();
      logger.info(`Found ${allVideos.length} videos in Google Sheets`);

      let migrated = 0;
      let errors = 0;

      for (const video of allVideos) {
        try {
          // Check if metadata file already exists
          const existing = await this.metadataService.loadFromFile(video.videoId);
          if (existing) {
            logger.info(`Metadata already exists for ${video.videoId}, skipping`);
            continue;
          }

          // Re-fetch from YouTube and save
          if (video.youtubeUrl) {
            logger.info(`Migrating ${video.videoId}: ${video.title}...`);
            const youtubeMetadata = await this.youtubeService.getCompleteVideoData(video.youtubeUrl);
            await this.metadataService.saveOriginalMetadata(video.videoId, youtubeMetadata);
            migrated++;
          } else {
            logger.warn(`No YouTube URL for ${video.videoId}, cannot migrate`);
            errors++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          logger.error(`Failed to migrate ${video.videoId}:`, error);
          errors++;
        }
      }

      logger.info(`\n✅ Migration complete:`);
      logger.info(`  Migrated: ${migrated} videos`);
      logger.info(`  Errors: ${errors} videos`);
      logger.info(`  Total processed: ${allVideos.length} videos`);

      return { migrated, errors, total: allVideos.length };

    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }
}

// CLI Setup
program
  .name('metadata-recovery')
  .description('Metadata integrity validation and recovery tool')
  .version('1.0.0');

program
  .command('validate-all')
  .description('Validate integrity of all metadata files')
  .action(async () => {
    const tool = new MetadataRecoveryTool();
    await tool.validateAll();
  });

program
  .command('auto-fix')
  .description('Auto-fix metadata issues for a specific video')
  .option('--video-id <videoId>', 'Video ID to fix (e.g., VID-0001)')
  .action(async (options) => {
    if (!options.videoId) {
      logger.error('Please provide --video-id parameter');
      process.exit(1);
    }
    
    const tool = new MetadataRecoveryTool();
    await tool.autoFixVideo(options.videoId);
  });

program
  .command('report')
  .description('Generate comprehensive integrity report')
  .action(async () => {
    const tool = new MetadataRecoveryTool();
    await tool.generateReport();
  });

program
  .command('migrate')
  .description('Migrate existing videos to immutable metadata storage')
  .action(async () => {
    const tool = new MetadataRecoveryTool();
    await tool.migrateExistingVideos();
  });

program
  .command('health-check')
  .description('Test metadata service functionality')
  .action(async () => {
    const tool = new MetadataRecoveryTool();
    const health = await tool.metadataService.healthCheck();
    logger.info('Health check result:', health);
  });

// Run CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export default MetadataRecoveryTool;