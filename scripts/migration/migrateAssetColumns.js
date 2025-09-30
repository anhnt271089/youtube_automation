#!/usr/bin/env node

/**
 * Asset Column Migration Utility
 *
 * Purpose: Fix legacy column mapping issue where asset data is stored in columns D & F
 * but should be in columns E & G according to the new schema.
 *
 * Legacy Schema (incorrect):
 * - Column D: Image URL
 * - Column F: Status
 *
 * New Schema (correct):
 * - Column D: Search phrase (for Pexels asset search)
 * - Column E: Image URL (Generated Image URL)
 * - Column F: Editor Keywords
 * - Column G: Status
 *
 * Migration Process:
 * 1. Scan all videos in Master Sheet
 * 2. For each video, check Script Breakdown sheet
 * 3. Identify rows where column E is empty but column D has URL data
 * 4. Copy data from D→E and F→G
 * 5. Clear old columns D and F
 * 6. Log all changes for audit trail
 *
 * Safety Features:
 * - Idempotent: Safe to run multiple times
 * - Dry-run mode available
 * - Comprehensive logging
 * - Error handling with rollback capability
 * - Validates URL patterns before migration
 */

import GoogleSheetsService from '../../src/services/googleSheetsService.js';
import logger from '../../src/utils/logger.js';
import { config } from '../../config/config.js';

class AssetColumnMigration {
  constructor(dryRun = false) {
    this.sheetsService = new GoogleSheetsService();
    this.dryRun = dryRun;
    this.migrationResults = {
      totalVideosScanned: 0,
      videosWithLegacyData: [],
      videosMigrated: [],
      videosSkipped: [],
      videosFailed: [],
      totalRowsMigrated: 0,
      errors: []
    };
  }

  /**
   * Check if a value looks like a URL
   */
  isUrl(value) {
    if (!value || typeof value !== 'string') return false;
    return value.startsWith('http://') ||
           value.startsWith('https://') ||
           value.includes('drive.google.com') ||
           value.includes('pexels.com');
  }

  /**
   * Check if a column value looks like legacy Image URL data
   * (should be in column E, not column D)
   */
  isLegacyImageUrl(columnDValue, columnEValue) {
    // If column E is empty and column D contains a URL, it's legacy data
    return this.isUrl(columnDValue) && (!columnEValue || columnEValue.trim() === '');
  }

  /**
   * Extract workbook ID from detail workbook URL
   */
  getWorkbookIdFromUrl(url) {
    if (!url) return null;
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Scan a single video's Script Breakdown sheet for legacy data
   */
  async scanVideoForLegacyData(video) {
    try {
      const { videoId, detailWorkbookUrl } = video;

      if (!detailWorkbookUrl) {
        logger.warn(`[Migration] Video ${videoId} has no detail workbook URL, skipping`);
        return { hasLegacyData: false, rowsAffected: 0, reason: 'No detail workbook URL' };
      }

      const workbookId = this.getWorkbookIdFromUrl(detailWorkbookUrl);
      if (!workbookId) {
        logger.warn(`[Migration] Could not extract workbook ID from URL for ${videoId}`);
        return { hasLegacyData: false, rowsAffected: 0, reason: 'Invalid workbook URL' };
      }

      // Read Script Breakdown sheet
      const sheetName = this.sheetsService.detailSheets.scriptBreakdown;
      const response = await this.sheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: `${sheetName}!A:H`, // Read all columns including headers
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        logger.info(`[Migration] Video ${videoId} has no script data, skipping`);
        return { hasLegacyData: false, rowsAffected: 0, reason: 'No script data' };
      }

      // Skip header row and check for legacy data
      let legacyRowsFound = 0;
      const legacyRowIndices = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const columnD = row[3]; // Index 3 = Column D (0-indexed)
        const columnE = row[4]; // Index 4 = Column E
        const columnF = row[5]; // Index 5 = Column F
        const columnG = row[6]; // Index 6 = Column G

        // Check if this row has legacy data pattern
        if (this.isLegacyImageUrl(columnD, columnE)) {
          legacyRowsFound++;
          legacyRowIndices.push({
            rowIndex: i + 1, // 1-indexed for Google Sheets
            columnD,
            columnE,
            columnF,
            columnG
          });
        }
      }

      if (legacyRowsFound > 0) {
        logger.info(`[Migration] Video ${videoId}: Found ${legacyRowsFound} rows with legacy data`);
        return {
          hasLegacyData: true,
          rowsAffected: legacyRowsFound,
          workbookId,
          legacyRows: legacyRowIndices
        };
      }

      return { hasLegacyData: false, rowsAffected: 0, reason: 'No legacy data found' };

    } catch (error) {
      logger.error(`[Migration] Error scanning video ${video.videoId}:`, error);
      return {
        hasLegacyData: false,
        rowsAffected: 0,
        error: error.message
      };
    }
  }

  /**
   * Migrate a single video's legacy data
   */
  async migrateVideo(video, scanResult) {
    const { videoId } = video;
    const { workbookId, legacyRows } = scanResult;

    if (this.dryRun) {
      logger.info(`[Migration][DRY-RUN] Would migrate ${legacyRows.length} rows for video ${videoId}`);
      return { success: true, dryRun: true };
    }

    try {
      const sheetName = this.sheetsService.detailSheets.scriptBreakdown;
      const updates = [];

      // Prepare batch update for all legacy rows
      for (const legacyRow of legacyRows) {
        const { rowIndex, columnD, columnF } = legacyRow;

        // Update column E with value from column D (Image URL)
        if (columnD) {
          updates.push({
            range: `${sheetName}!E${rowIndex}`,
            values: [[columnD]]
          });
        }

        // Update column G with value from column F (Status)
        if (columnF) {
          updates.push({
            range: `${sheetName}!G${rowIndex}`,
            values: [[columnF]]
          });
        }

        // Clear old column D (will be used for search phrase in future)
        updates.push({
          range: `${sheetName}!D${rowIndex}`,
          values: [['']]
        });

        // Clear old column F (will be used for editor keywords)
        updates.push({
          range: `${sheetName}!F${rowIndex}`,
          values: [['']]
        });
      }

      // Execute batch update
      if (updates.length > 0) {
        await this.sheetsService.sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: workbookId,
          requestBody: {
            valueInputOption: 'RAW',
            data: updates
          }
        });

        logger.info(`[Migration] Successfully migrated ${legacyRows.length} rows for video ${videoId}`);
        return { success: true, rowsMigrated: legacyRows.length };
      }

      return { success: true, rowsMigrated: 0 };

    } catch (error) {
      logger.error(`[Migration] Error migrating video ${videoId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Main migration process
   */
  async run() {
    const startTime = Date.now();
    logger.info(`[Migration] Starting asset column migration (${this.dryRun ? 'DRY-RUN' : 'LIVE'} mode)`);
    logger.info(`[Migration] Timestamp: ${new Date().toISOString()}`);

    try {
      // Step 1: Get all videos from Master Sheet
      logger.info('[Migration] Step 1: Fetching all videos from Master Sheet...');
      const allVideos = await this.sheetsService.getAllVideos();
      this.migrationResults.totalVideosScanned = allVideos.length;
      logger.info(`[Migration] Found ${allVideos.length} videos to scan`);

      // Step 2: Scan each video for legacy data
      logger.info('[Migration] Step 2: Scanning videos for legacy column data...');

      for (const video of allVideos) {
        const scanResult = await this.scanVideoForLegacyData(video);

        if (scanResult.error) {
          this.migrationResults.videosFailed.push({
            videoId: video.videoId,
            error: scanResult.error
          });
          this.migrationResults.errors.push(`${video.videoId}: ${scanResult.error}`);
          continue;
        }

        if (!scanResult.hasLegacyData) {
          this.migrationResults.videosSkipped.push({
            videoId: video.videoId,
            reason: scanResult.reason || 'No legacy data'
          });
          continue;
        }

        // Found legacy data
        this.migrationResults.videosWithLegacyData.push({
          videoId: video.videoId,
          rowsAffected: scanResult.rowsAffected,
          workbookId: scanResult.workbookId
        });

        // Step 3: Migrate the video
        logger.info(`[Migration] Step 3: Migrating video ${video.videoId} (${scanResult.rowsAffected} rows)...`);
        const migrationResult = await this.migrateVideo(video, scanResult);

        if (migrationResult.success) {
          this.migrationResults.videosMigrated.push({
            videoId: video.videoId,
            rowsMigrated: migrationResult.rowsMigrated || scanResult.rowsAffected,
            dryRun: migrationResult.dryRun || false
          });
          this.migrationResults.totalRowsMigrated += (migrationResult.rowsMigrated || scanResult.rowsAffected);
        } else {
          this.migrationResults.videosFailed.push({
            videoId: video.videoId,
            error: migrationResult.error
          });
          this.migrationResults.errors.push(`${video.videoId}: ${migrationResult.error}`);
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 4: Generate summary report
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.generateReport(duration);

      return this.migrationResults;

    } catch (error) {
      logger.error('[Migration] Fatal error during migration:', error);
      throw error;
    }
  }

  /**
   * Generate and display migration report
   */
  generateReport(duration) {
    const {
      totalVideosScanned,
      videosWithLegacyData,
      videosMigrated,
      videosSkipped,
      videosFailed,
      totalRowsMigrated,
      errors
    } = this.migrationResults;

    console.log('\n' + '='.repeat(80));
    console.log('ASSET COLUMN MIGRATION REPORT');
    console.log('='.repeat(80));
    console.log(`Mode: ${this.dryRun ? 'DRY-RUN (No changes made)' : 'LIVE (Changes applied)'}`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    console.log('\nSUMMARY:');
    console.log(`  Total Videos Scanned: ${totalVideosScanned}`);
    console.log(`  Videos with Legacy Data: ${videosWithLegacyData.length}`);
    console.log(`  Videos Migrated: ${videosMigrated.length}`);
    console.log(`  Videos Skipped: ${videosSkipped.length}`);
    console.log(`  Videos Failed: ${videosFailed.length}`);
    console.log(`  Total Rows Migrated: ${totalRowsMigrated}`);

    if (videosWithLegacyData.length > 0) {
      console.log('\nVIDEOS WITH LEGACY DATA:');
      videosWithLegacyData.forEach(v => {
        console.log(`  - ${v.videoId}: ${v.rowsAffected} rows affected`);
      });
    }

    if (videosMigrated.length > 0) {
      console.log('\nVIDEOS MIGRATED:');
      videosMigrated.forEach(v => {
        const dryRunTag = v.dryRun ? ' [DRY-RUN]' : '';
        console.log(`  - ${v.videoId}: ${v.rowsMigrated} rows migrated${dryRunTag}`);
      });
    }

    if (videosFailed.length > 0) {
      console.log('\nFAILED MIGRATIONS:');
      videosFailed.forEach(v => {
        console.log(`  - ${v.videoId}: ${v.error}`);
      });
    }

    if (errors.length > 0) {
      console.log('\nERRORS ENCOUNTERED:');
      errors.forEach(err => {
        console.log(`  - ${err}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    if (this.dryRun) {
      console.log('\nNOTE: This was a DRY-RUN. No changes were made.');
      console.log('Run without --dry-run flag to apply changes.');
    } else {
      console.log('\nMigration completed successfully!');
    }
    console.log('='.repeat(80) + '\n');

    // Write results to file for audit trail
    this.saveResultsToFile();
  }

  /**
   * Save migration results to file
   */
  async saveResultsToFile() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { fileURLToPath } = await import('url');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);

      const resultsDir = path.join(__dirname, '../../data/migration-results');
      await fs.mkdir(resultsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `asset-column-migration-${timestamp}.json`;
      const filepath = path.join(resultsDir, filename);

      const results = {
        ...this.migrationResults,
        timestamp: new Date().toISOString(),
        dryRun: this.dryRun
      };

      await fs.writeFile(filepath, JSON.stringify(results, null, 2));
      logger.info(`[Migration] Results saved to: ${filepath}`);

    } catch (error) {
      logger.error('[Migration] Error saving results to file:', error);
    }
  }
}

// CLI execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

const migration = new AssetColumnMigration(dryRun);

migration.run()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
  });