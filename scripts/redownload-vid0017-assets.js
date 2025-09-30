#!/usr/bin/env node

/**
 * Re-download All Assets for VID-0017
 *
 * This script clears existing asset data and triggers a complete re-download
 * of all assets for VID-0017 using the asset download orchestrator.
 *
 * Steps:
 * 1. Read current VID-0017 Script Breakdown data
 * 2. Clear all Image URLs (column E) and reset Status (column G) to "Pending"
 * 3. Trigger the asset download orchestrator for VID-0017
 * 4. Monitor the download process
 * 5. Verify all assets downloaded successfully
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import AssetDownloadOrchestrator from '../src/services/assetDownloadOrchestrator.js';
import logger from '../src/utils/logger.js';
import { config } from '../config/config.js';

const VIDEO_ID = 'VID-0017';

class VID0017AssetRedownloader {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.orchestrator = new AssetDownloadOrchestrator();
    this.results = {
      totalRows: 0,
      clearedRows: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      errors: []
    };
  }

  /**
   * Main execution flow
   */
  async execute() {
    try {
      logger.info(`\n${'='.repeat(70)}`);
      logger.info(`🚀 Starting Asset Re-download for ${VIDEO_ID}`);
      logger.info(`${'='.repeat(70)}\n`);

      // Step 1: Verify video exists and get details
      logger.info(`📋 Step 1: Verifying ${VIDEO_ID} details...`);
      const videoDetails = await this.verifyVideoExists();
      logger.info(`✅ Video found: "${videoDetails.title}"`);
      logger.info(`   Script Approved: ${videoDetails.scriptApproved}`);
      logger.info(`   Drive Folder: ${videoDetails.driveFolder}`);

      // Step 2: Get current script breakdown
      logger.info(`\n📊 Step 2: Reading current Script Breakdown...`);
      const scriptBreakdown = await this.getScriptBreakdown();
      logger.info(`✅ Found ${scriptBreakdown.length} rows in Script Breakdown`);
      this.results.totalRows = scriptBreakdown.length;

      // Step 3: Display current status
      await this.displayCurrentStatus(scriptBreakdown);

      // Step 4: Clear all asset data
      logger.info(`\n🧹 Step 3: Clearing existing asset data...`);
      await this.clearAssetData(scriptBreakdown.length);
      logger.info(`✅ Cleared all Image URLs and reset Status to "Pending"`);

      // Step 5: Trigger asset download
      logger.info(`\n⬇️  Step 4: Triggering asset download orchestrator...`);
      const downloadResult = await this.triggerAssetDownload();

      if (downloadResult.success) {
        logger.info(`✅ Asset download completed successfully!`);
        this.results.successfulDownloads = downloadResult.result.successCount;
        this.results.failedDownloads = downloadResult.result.failureCount;
      } else {
        logger.error(`❌ Asset download failed: ${downloadResult.reason || downloadResult.error}`);
        this.results.errors.push(downloadResult.reason || downloadResult.error);
      }

      // Step 6: Verify results
      logger.info(`\n🔍 Step 5: Verifying download results...`);
      await this.verifyResults();

      // Step 7: Display summary
      this.displaySummary();

    } catch (error) {
      logger.error(`\n❌ Fatal error during re-download process:`, error);
      this.results.errors.push(error.message);
      this.displaySummary();
      process.exit(1);
    }
  }

  /**
   * Verify video exists and return details
   */
  async verifyVideoExists() {
    const videoDetails = await this.sheetsService.getVideoDetails(VIDEO_ID);

    if (!videoDetails) {
      throw new Error(`Video ${VIDEO_ID} not found in master sheet`);
    }

    if (!videoDetails.detailWorkbookUrl) {
      throw new Error(`No detail workbook found for ${VIDEO_ID}`);
    }

    if (!videoDetails.driveFolder) {
      throw new Error(`No Drive folder configured for ${VIDEO_ID}`);
    }

    return videoDetails;
  }

  /**
   * Get current script breakdown
   */
  async getScriptBreakdown() {
    const breakdown = await this.sheetsService.getScriptBreakdown(VIDEO_ID);

    if (!breakdown || breakdown.length === 0) {
      throw new Error(`No script breakdown found for ${VIDEO_ID}`);
    }

    return breakdown;
  }

  /**
   * Display current status of assets
   */
  async displayCurrentStatus(scriptBreakdown) {
    const withAssets = scriptBreakdown.filter(row => row.imageUrl && row.imageUrl.trim() !== '');
    const withoutAssets = scriptBreakdown.filter(row => !row.imageUrl || row.imageUrl.trim() === '');
    const completeStatus = scriptBreakdown.filter(row => row.status === 'Complete');
    const pendingStatus = scriptBreakdown.filter(row => row.status === 'Pending');

    logger.info(`\n📊 Current Asset Status:`);
    logger.info(`   Total Rows: ${scriptBreakdown.length}`);
    logger.info(`   With Image URLs: ${withAssets.length} (${Math.round(withAssets.length / scriptBreakdown.length * 100)}%)`);
    logger.info(`   Without Image URLs: ${withoutAssets.length} (${Math.round(withoutAssets.length / scriptBreakdown.length * 100)}%)`);
    logger.info(`   Status "Complete": ${completeStatus.length}`);
    logger.info(`   Status "Pending": ${pendingStatus.length}`);
  }

  /**
   * Clear all asset data (Image URLs and Status)
   */
  async clearAssetData(totalRows) {
    const videoRow = await this.sheetsService.findVideoRow(VIDEO_ID);
    if (!videoRow || !videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl]) {
      throw new Error(`Detail workbook not found for ${VIDEO_ID}`);
    }

    const workbookUrl = videoRow.data[this.sheetsService.masterColumns.detailWorkbookUrl];
    const workbookId = workbookUrl.split('/d/')[1].split('/')[0];

    // Prepare batch update to clear Image URLs (column E) and Status (column G)
    const updates = [];

    // Clear Image URLs (column E)
    const imageUrlClearData = [];
    for (let i = 0; i < totalRows; i++) {
      imageUrlClearData.push(['']); // Empty string
    }
    updates.push({
      range: `Script Breakdown!E2:E${totalRows + 1}`, // E2 to E[totalRows+1] (accounting for header)
      values: imageUrlClearData
    });

    // Reset Status (column G) to "Pending"
    const statusResetData = [];
    for (let i = 0; i < totalRows; i++) {
      statusResetData.push(['Pending']);
    }
    updates.push({
      range: `Script Breakdown!G2:G${totalRows + 1}`, // G2 to G[totalRows+1] (accounting for header)
      values: statusResetData
    });

    // Execute batch update
    await this.sheetsService.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: workbookId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data: updates
      }
    });

    this.results.clearedRows = totalRows;
    logger.info(`   Cleared ${totalRows} rows of asset data`);
  }

  /**
   * Trigger asset download via orchestrator
   */
  async triggerAssetDownload() {
    logger.info(`   Initiating asset download orchestrator...`);

    const result = await this.orchestrator.handleScriptApproval(VIDEO_ID, {
      triggerReason: 'Manual re-download via script',
      timestamp: new Date(),
      forceReprocess: true
    });

    return result;
  }

  /**
   * Verify download results
   */
  async verifyResults() {
    // Wait a moment for sheets to update
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get updated script breakdown
    const updatedBreakdown = await this.getScriptBreakdown();

    const withAssets = updatedBreakdown.filter(row => row.imageUrl && row.imageUrl.trim() !== '');
    const completeStatus = updatedBreakdown.filter(row => row.status === 'Complete');

    logger.info(`\n📈 Final Results:`);
    logger.info(`   Total Rows: ${updatedBreakdown.length}`);
    logger.info(`   With Image URLs: ${withAssets.length}/${updatedBreakdown.length}`);
    logger.info(`   Status "Complete": ${completeStatus.length}/${updatedBreakdown.length}`);

    // Test a few random Drive URLs
    if (withAssets.length > 0) {
      logger.info(`\n🔗 Sample Drive URLs (testing accessibility):`);
      const sampleSize = Math.min(3, withAssets.length);
      for (let i = 0; i < sampleSize; i++) {
        const randomIndex = Math.floor(Math.random() * withAssets.length);
        const sample = withAssets[randomIndex];
        logger.info(`   Row ${sample.sentenceNumber}: ${sample.imageUrl.substring(0, 60)}...`);
      }
    }
  }

  /**
   * Display final summary
   */
  displaySummary() {
    logger.info(`\n${'='.repeat(70)}`);
    logger.info(`📊 ASSET RE-DOWNLOAD SUMMARY FOR ${VIDEO_ID}`);
    logger.info(`${'='.repeat(70)}\n`);

    logger.info(`Total Rows Processed: ${this.results.totalRows}`);
    logger.info(`Rows Cleared: ${this.results.clearedRows}`);
    logger.info(`Successful Downloads: ${this.results.successfulDownloads}`);
    logger.info(`Failed Downloads: ${this.results.failedDownloads}`);

    if (this.results.errors.length > 0) {
      logger.info(`\n❌ Errors Encountered (${this.results.errors.length}):`);
      this.results.errors.forEach((error, index) => {
        logger.info(`   ${index + 1}. ${error}`);
      });
    }

    const successRate = this.results.totalRows > 0
      ? Math.round((this.results.successfulDownloads / this.results.totalRows) * 100)
      : 0;

    logger.info(`\n✨ Success Rate: ${successRate}%`);

    if (successRate >= 95) {
      logger.info(`\n🎉 Excellent! Asset re-download completed successfully!`);
    } else if (successRate >= 75) {
      logger.info(`\n✅ Good! Most assets downloaded successfully.`);
    } else if (successRate >= 50) {
      logger.info(`\n⚠️  Warning: Partial success. Some assets may need manual attention.`);
    } else {
      logger.info(`\n❌ Poor results. Please investigate failures and retry.`);
    }

    logger.info(`\n${'='.repeat(70)}\n`);
  }
}

// Execute the script
(async () => {
  const redownloader = new VID0017AssetRedownloader();
  await redownloader.execute();
})();