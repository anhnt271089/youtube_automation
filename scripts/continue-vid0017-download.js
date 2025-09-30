#!/usr/bin/env node

/**
 * Continue VID-0017 Asset Download
 *
 * Trigger the orchestrator to process remaining sentences for VID-0017
 */

import AssetDownloadOrchestrator from '../src/services/assetDownloadOrchestrator.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const VIDEO_ID = 'VID-0017';

(async () => {
  try {
    logger.info(`\n${'='.repeat(70)}`);
    logger.info(`🔄 Continuing Asset Download for ${VIDEO_ID}`);
    logger.info(`${'='.repeat(70)}\n`);

    const orchestrator = new AssetDownloadOrchestrator();
    const sheetsService = new GoogleSheetsService();

    // Check current status
    logger.info('📊 Checking current status...');
    const breakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);
    const withAssets = breakdown.filter(row => row.imageUrl && row.imageUrl.trim() !== '');
    const withoutAssets = breakdown.filter(row => !row.imageUrl || row.imageUrl.trim() === '');

    logger.info(`   Total: ${breakdown.length} sentences`);
    logger.info(`   Completed: ${withAssets.length}`);
    logger.info(`   Remaining: ${withoutAssets.length}\n`);

    if (withoutAssets.length === 0) {
      logger.info('✅ All assets already downloaded!');
      process.exit(0);
    }

    // Trigger orchestrator
    logger.info('🚀 Triggering asset download orchestrator...\n');

    const result = await orchestrator.handleScriptApproval(VIDEO_ID, {
      triggerReason: 'Continue incomplete download',
      timestamp: new Date()
    });

    logger.info(`\n${'='.repeat(70)}`);
    if (result.success) {
      logger.info(`✅ Asset download completed successfully!`);
      logger.info(`   Success: ${result.result.successCount}`);
      logger.info(`   Failed: ${result.result.failureCount}`);
      logger.info(`   Total: ${result.result.totalSentences}`);
    } else if (result.skipped) {
      logger.info(`⚠️  Download skipped: ${result.reason}`);
    } else {
      logger.error(`❌ Download failed: ${result.reason || result.error}`);
    }
    logger.info(`${'='.repeat(70)}\n`);

    // Check final status
    logger.info('📊 Checking final status...');
    const finalBreakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);
    const finalWithAssets = finalBreakdown.filter(row => row.imageUrl && row.imageUrl.trim() !== '');
    const finalWithoutAssets = finalBreakdown.filter(row => !row.imageUrl || row.imageUrl.trim() === '');

    logger.info(`   Total: ${finalBreakdown.length} sentences`);
    logger.info(`   Completed: ${finalWithAssets.length} (${Math.round(finalWithAssets.length / finalBreakdown.length * 100)}%)`);
    logger.info(`   Remaining: ${finalWithoutAssets.length}\n`);

    if (finalWithAssets.length === finalBreakdown.length) {
      logger.info('🎉 All assets downloaded successfully!');
    } else if (finalWithAssets.length > withAssets.length) {
      logger.info(`✅ Progress made: ${finalWithAssets.length - withAssets.length} new assets downloaded`);
    } else {
      logger.warn('⚠️  No new assets downloaded. Check for errors.');
    }

  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
})();