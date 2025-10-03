#!/usr/bin/env node
/**
 * Verification Script for Asset Download Fixes
 *
 * Tests:
 * 1. Detail folders are created ONLY in Videos Details folder (not root)
 * 2. Status updates to "Completed" after successful asset downloads
 *
 * Usage: node scripts/verify-asset-fixes.js [videoId]
 */

import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import { google } from 'googleapis';

class AssetFixVerifier {
  constructor() {
    this.sheetsService = new GoogleSheetsService();

    // Initialize Drive API for folder verification
    const auth = new google.auth.OAuth2({
      clientId: config.google.clientId,
      clientSecret: config.google.clientSecret,
      redirectUri: config.google.redirectUri
    });

    auth.setCredentials({
      access_token: config.google.accessToken,
      refresh_token: config.google.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  /**
   * Test 1: Verify Detail Folder Location
   * Checks if detail folders are created in correct parent (not root)
   */
  async testDetailFolderLocation(videoId) {
    console.log('\n📁 TEST 1: Detail Folder Location Verification');
    console.log('='.repeat(60));

    try {
      // Get video details
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        console.log(`❌ Video ${videoId} not found`);
        return { passed: false, error: 'Video not found' };
      }

      console.log(`\n📋 Video: ${videoDetails.title}`);
      console.log(`🔗 Drive Folder URL: ${videoDetails.driveFolder}`);

      if (!videoDetails.driveFolder) {
        console.log('⚠️ No Drive folder created yet');
        return { passed: false, error: 'No Drive folder' };
      }

      // Extract folder ID from URL
      const folderId = videoDetails.driveFolder.split('/folders/')[1];

      // Get folder metadata including parent
      const folderMeta = await this.drive.files.get({
        fileId: folderId,
        fields: 'id, name, parents, webViewLink'
      });

      const folderParent = folderMeta.data.parents?.[0];
      const expectedParent = config.google.videosRootFolderId;

      console.log(`\n📂 Folder Details:`);
      console.log(`  • Folder ID: ${folderId}`);
      console.log(`  • Folder Name: ${folderMeta.data.name}`);
      console.log(`  • Parent Folder ID: ${folderParent}`);
      console.log(`  • Expected Parent: ${expectedParent}`);

      // Check if folder is in correct location
      if (folderParent === expectedParent) {
        console.log(`\n✅ PASS: Detail folder is in correct location (Videos Details folder)`);
        return {
          passed: true,
          folderId,
          folderParent,
          location: 'Correct (Videos Details folder)'
        };
      } else if (!folderParent) {
        console.log(`\n❌ FAIL: Detail folder is in ROOT (no parent specified)`);
        return {
          passed: false,
          folderId,
          folderParent: 'root',
          location: 'Root (INCORRECT)',
          error: 'Folder created in root instead of Videos Details folder'
        };
      } else {
        console.log(`\n❌ FAIL: Detail folder is in WRONG parent folder`);
        return {
          passed: false,
          folderId,
          folderParent,
          location: 'Wrong parent folder',
          error: `Unexpected parent folder: ${folderParent}`
        };
      }

    } catch (error) {
      console.log(`\n❌ ERROR: ${error.message}`);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Test 2: Verify Status Update Logic
   * Checks if status is correctly updated after asset downloads
   */
  async testStatusUpdate(videoId) {
    console.log('\n📊 TEST 2: Status Update Verification');
    console.log('='.repeat(60));

    try {
      // Get video details
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      if (!videoDetails) {
        console.log(`❌ Video ${videoId} not found`);
        return { passed: false, error: 'Video not found' };
      }

      console.log(`\n📋 Video: ${videoDetails.title}`);
      console.log(`📈 Current Status: ${videoDetails.status}`);
      console.log(`✅ Script Approved: ${videoDetails.scriptApproved}`);

      // Check script breakdown for asset download status
      const scriptBreakdown = await this.sheetsService.getScriptBreakdown(videoId);
      if (!scriptBreakdown || scriptBreakdown.length === 0) {
        console.log('⚠️ No script breakdown found');
        return { passed: false, error: 'No script breakdown' };
      }

      // Count assets
      const totalSentences = scriptBreakdown.length;
      const withAssets = scriptBreakdown.filter(s => s.imageUrl && s.imageUrl.trim() !== '').length;
      const withoutAssets = totalSentences - withAssets;

      console.log(`\n📦 Asset Download Status:`);
      console.log(`  • Total Sentences: ${totalSentences}`);
      console.log(`  • With Assets: ${withAssets}`);
      console.log(`  • Without Assets: ${withoutAssets}`);
      console.log(`  • Coverage: ${Math.round((withAssets / totalSentences) * 100)}%`);

      // Determine expected status
      let expectedStatus;
      if (videoDetails.scriptApproved !== 'Approved') {
        expectedStatus = 'Pending Script Approval';
      } else if (withAssets === 0) {
        expectedStatus = 'Downloading Assets (or not started)';
      } else if (withAssets > 0) {
        expectedStatus = 'Completed';
      }

      console.log(`\n🎯 Expected Status: ${expectedStatus}`);
      console.log(`📊 Actual Status: ${videoDetails.status}`);

      // Verify status
      if (withAssets > 0 && videoDetails.status === 'Completed') {
        console.log(`\n✅ PASS: Status correctly set to "Completed" after asset downloads`);
        return {
          passed: true,
          status: videoDetails.status,
          assetsDownloaded: withAssets,
          totalSentences
        };
      } else if (withAssets > 0 && videoDetails.status !== 'Completed') {
        console.log(`\n❌ FAIL: Status should be "Completed" but is "${videoDetails.status}"`);
        return {
          passed: false,
          status: videoDetails.status,
          expectedStatus: 'Completed',
          assetsDownloaded: withAssets,
          error: `Status not updated to Completed despite ${withAssets} assets downloaded`
        };
      } else if (withAssets === 0 && videoDetails.status === 'Completed') {
        console.log(`\n⚠️ WARNING: Status is "Completed" but no assets downloaded`);
        return {
          passed: false,
          status: videoDetails.status,
          assetsDownloaded: 0,
          error: 'Status is Completed but no assets found'
        };
      } else {
        console.log(`\n✅ Status is appropriate for current asset download state`);
        return {
          passed: true,
          status: videoDetails.status,
          assetsDownloaded: withAssets,
          note: 'No assets downloaded yet, status is appropriate'
        };
      }

    } catch (error) {
      console.log(`\n❌ ERROR: ${error.message}`);
      return { passed: false, error: error.message };
    }
  }

  /**
   * Run all verification tests
   */
  async runAllTests(videoId) {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ASSET DOWNLOAD FIX VERIFICATION');
    console.log('='.repeat(60));
    console.log(`\n📹 Testing Video ID: ${videoId}`);
    console.log(`🕐 Started: ${new Date().toLocaleString()}`);

    const results = {
      videoId,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Folder Location
    results.tests.folderLocation = await this.testDetailFolderLocation(videoId);

    // Test 2: Status Update
    results.tests.statusUpdate = await this.testStatusUpdate(videoId);

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📋 VERIFICATION SUMMARY');
    console.log('='.repeat(60));

    const allPassed = Object.values(results.tests).every(t => t.passed);

    console.log(`\n✅ Folder Location Test: ${results.tests.folderLocation.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`✅ Status Update Test: ${results.tests.statusUpdate.passed ? 'PASSED' : 'FAILED'}`);

    console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log(`\n🕐 Completed: ${new Date().toLocaleString()}`);
    console.log('='.repeat(60));

    return results;
  }
}

// Main execution
async function main() {
  const videoId = process.argv[2];

  if (!videoId) {
    console.log('Usage: node scripts/verify-asset-fixes.js [videoId]');
    console.log('\nExample: node scripts/verify-asset-fixes.js VID-0001');
    process.exit(1);
  }

  const verifier = new AssetFixVerifier();
  const results = await verifier.runAllTests(videoId);

  // Exit with appropriate code
  const allPassed = Object.values(results.tests).every(t => t.passed);
  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  logger.error('Verification error:', error);
  process.exit(1);
});
