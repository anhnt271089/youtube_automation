#!/usr/bin/env node

/**
 * Check VID-0017 Asset Download Status
 *
 * Quick script to check the current status of asset downloads for VID-0017
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const VIDEO_ID = 'VID-0017';

(async () => {
  try {
    const sheetsService = new GoogleSheetsService();

    logger.info(`\n${'='.repeat(70)}`);
    logger.info(`📊 VID-0017 Asset Download Status Check`);
    logger.info(`${'='.repeat(70)}\n`);

    // Get script breakdown
    const breakdown = await sheetsService.getScriptBreakdown(VIDEO_ID);

    if (!breakdown || breakdown.length === 0) {
      logger.error('❌ No script breakdown found');
      process.exit(1);
    }

    const withAssets = breakdown.filter(row => row.imageUrl && row.imageUrl.trim() !== '');
    const withoutAssets = breakdown.filter(row => !row.imageUrl || row.imageUrl.trim() === '');
    const completeStatus = breakdown.filter(row => row.status === 'Complete');
    const pendingStatus = breakdown.filter(row => row.status === 'Pending');
    const failedStatus = breakdown.filter(row => row.status && row.status.toLowerCase().includes('failed'));

    logger.info(`Total Rows: ${breakdown.length}`);
    logger.info(`\n📥 Image URL Status:`);
    logger.info(`   ✅ With Image URLs: ${withAssets.length}/${breakdown.length} (${Math.round(withAssets.length / breakdown.length * 100)}%)`);
    logger.info(`   ⚠️  Without Image URLs: ${withoutAssets.length}/${breakdown.length} (${Math.round(withoutAssets.length / breakdown.length * 100)}%)`);

    logger.info(`\n📋 Status Field:`);
    logger.info(`   ✅ Complete: ${completeStatus.length}`);
    logger.info(`   ⏳ Pending: ${pendingStatus.length}`);
    logger.info(`   ❌ Failed: ${failedStatus.length}`);

    // Show sample assets
    if (withAssets.length > 0) {
      logger.info(`\n🔗 Sample Asset URLs (first 5):`);
      withAssets.slice(0, 5).forEach((row, index) => {
        logger.info(`   ${index + 1}. Sentence ${row.sentenceNumber}: ${row.imageUrl.substring(0, 70)}...`);
      });
    }

    // Show missing assets
    if (withoutAssets.length > 0) {
      logger.info(`\n⚠️  Missing Assets (sentences without URLs):`);
      withoutAssets.slice(0, 10).forEach((row, index) => {
        logger.info(`   ${index + 1}. Sentence ${row.sentenceNumber}: "${row.searchPhrase || 'No search phrase'}"`);
      });
      if (withoutAssets.length > 10) {
        logger.info(`   ... and ${withoutAssets.length - 10} more`);
      }
    }

    const successRate = Math.round((withAssets.length / breakdown.length) * 100);
    logger.info(`\n✨ Overall Success Rate: ${successRate}%`);

    if (successRate >= 95) {
      logger.info(`🎉 Excellent! Asset download is nearly complete!`);
    } else if (successRate >= 75) {
      logger.info(`✅ Good progress! Most assets downloaded.`);
    } else if (successRate >= 50) {
      logger.info(`⚠️  Partial progress. Continue monitoring.`);
    } else {
      logger.info(`❌ Low completion rate. Check for errors.`);
    }

    logger.info(`\n${'='.repeat(70)}\n`);

  } catch (error) {
    logger.error('❌ Error checking status:', error);
    process.exit(1);
  }
})();