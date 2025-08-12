#!/usr/bin/env node

/**
 * DIAGNOSTIC TOOL: Check Cache Status for VID-0008
 * 
 * This tool examines the actual cache content to understand what the status 
 * monitoring system is seeing for VID-0008 and why it may not be detecting changes.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import StatusCacheService from '../src/services/statusCacheService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CacheStatusChecker {
  constructor() {
    this.cacheService = new StatusCacheService();
    this.sheetsService = new GoogleSheetsService();
    this.monitorService = new StatusMonitorService();
  }

  async checkCacheStatus() {
    console.log('\n🔍 CACHE STATUS ANALYSIS FOR VID-0008');
    console.log('=' .repeat(50));

    // 1. Check cache file existence and stats
    console.log('\n📊 Step 1: Cache file analysis...');
    const cacheStats = this.cacheService.getCacheStats();
    console.log('Cache file exists:', cacheStats.exists);
    console.log('Cache file path:', this.cacheService.cacheFile);
    console.log('Video count in cache:', cacheStats.videoCount);
    console.log('Last cache update:', cacheStats.lastUpdate);
    console.log('File size:', cacheStats.fileSize, 'bytes');

    // 2. Get cached videos data
    console.log('\n📋 Step 2: Cached videos data...');
    const cachedVideos = this.cacheService.getCachedVideos();
    console.log('Total cached videos:', cachedVideos.length);

    // Find VID-0008 in cache
    const cachedVid0008 = cachedVideos.find(v => v.videoId === 'VID-0008');
    if (cachedVid0008) {
      console.log('\n✅ VID-0008 found in cache:');
      console.log('  Video ID:', cachedVid0008.videoId);
      console.log('  Title:', cachedVid0008.title);
      console.log('  Status:', cachedVid0008.status);
      console.log('  Script Approved (cached):', cachedVid0008.scriptApproved);
      console.log('  Voice Generation Status:', cachedVid0008.voiceGenerationStatus);
      console.log('  Video Editing Status:', cachedVid0008.videoEditingStatus);
      console.log('  Last Edited Time:', cachedVid0008.lastEditedTime);
    } else {
      console.log('\n❌ VID-0008 NOT found in cache');
      console.log('   Available video IDs in cache:', cachedVideos.map(v => v.videoId).slice(0, 10).join(', '));
    }

    // 3. Get current live data from Google Sheets
    console.log('\n🔄 Step 3: Current live data from Google Sheets...');
    const currentVideos = await this.sheetsService.getAllVideosStatus();
    const currentVid0008 = currentVideos.find(v => v.videoId === 'VID-0008');
    
    if (currentVid0008) {
      console.log('\n✅ VID-0008 found in current Google Sheets data:');
      console.log('  Video ID:', currentVid0008.videoId);
      console.log('  Title:', currentVid0008.title);
      console.log('  Status:', currentVid0008.status);
      console.log('  Script Approved (current):', currentVid0008.scriptApproved);
      console.log('  Voice Generation Status:', currentVid0008.voiceGenerationStatus);
      console.log('  Video Editing Status:', currentVid0008.videoEditingStatus);
      console.log('  Last Edited Time:', currentVid0008.lastEditedTime);
    }

    // 4. Compare cached vs current for change detection
    console.log('\n🔍 Step 4: Change detection analysis...');
    if (cachedVid0008 && currentVid0008) {
      console.log('\n📊 FIELD COMPARISON:');
      console.log(`  Script Approved: "${cachedVid0008.scriptApproved}" → "${currentVid0008.scriptApproved}"`);
      console.log(`  Status: "${cachedVid0008.status}" → "${currentVid0008.status}"`);
      console.log(`  Voice Generation: "${cachedVid0008.voiceGenerationStatus}" → "${currentVid0008.voiceGenerationStatus}"`);
      console.log(`  Video Editing: "${cachedVid0008.videoEditingStatus}" → "${currentVid0008.videoEditingStatus}"`);
      console.log(`  Last Edited Time: "${cachedVid0008.lastEditedTime}" → "${currentVid0008.lastEditedTime}"`);

      // Test actual change detection
      const changes = this.monitorService.detectPriorityStatusChanges([currentVid0008], [cachedVid0008]);
      console.log(`\n🚨 CHANGE DETECTION RESULTS: ${changes.length} changes`);
      
      if (changes.length > 0) {
        changes.forEach((change, index) => {
          console.log(`\n  Change ${index + 1} for ${change.videoId}:`);
          Object.entries(change.changes).forEach(([field, changeInfo]) => {
            console.log(`    ${field}: "${changeInfo.old}" → "${changeInfo.new}"`);
          });
          console.log(`    Priority: ${change.priorityLevel}`);
          console.log(`    Actions: ${change.workflowAction.join(', ')}`);
        });
      } else {
        console.log('  No changes would be detected by the monitoring system');
      }

      // Analysis
      console.log('\n📋 ISSUE ANALYSIS:');
      if (cachedVid0008.scriptApproved !== currentVid0008.scriptApproved) {
        console.log(`  ✅ Script Approved field HAS CHANGED: "${cachedVid0008.scriptApproved}" → "${currentVid0008.scriptApproved}"`);
        if (changes.length === 0) {
          console.log('  ❌ CRITICAL ISSUE: Change exists but monitoring system not detecting it');
          console.log('  📋 Possible causes:');
          console.log('    - Cached data is not being loaded correctly');
          console.log('    - Change detection logic has a bug');
          console.log('    - Field comparison is failing');
        }
      } else {
        console.log(`  ❓ Script Approved field has NOT changed: both show "${currentVid0008.scriptApproved}"`);
        console.log('  📋 Possible reasons:');
        console.log('    - Cache is up-to-date (user may have already changed field back)');
        console.log('    - Change was detected and cache was updated already');
        console.log('    - User is referring to a different field or video');
      }
    } else {
      console.log('  ❌ Cannot compare - missing data in either cache or current sheets');
    }

    // 5. Test manual change detection
    console.log('\n🧪 Step 5: Manual change detection test...');
    if (currentVid0008) {
      // Create a mock "old" version for testing
      const mockOldVersion = {
        ...currentVid0008,
        scriptApproved: 'Pending' // Simulate it was previously 'Pending'
      };

      const testChanges = this.monitorService.detectPriorityStatusChanges([currentVid0008], [mockOldVersion]);
      console.log(`\n🧪 TEST RESULTS: ${testChanges.length} changes detected in manual test`);
      
      if (testChanges.length > 0) {
        console.log('  ✅ Change detection logic is working correctly');
        testChanges.forEach(change => {
          Object.entries(change.changes).forEach(([field, changeInfo]) => {
            console.log(`    ${field}: "${changeInfo.old}" → "${changeInfo.new}"`);
          });
        });
      } else {
        console.log('  ❌ Change detection logic may have issues');
      }
    }

    console.log('\n📊 SUMMARY & RECOMMENDATIONS');
    console.log('=' .repeat(40));
    
    if (cachedVid0008 && currentVid0008) {
      if (cachedVid0008.scriptApproved === currentVid0008.scriptApproved) {
        console.log('✅ CACHE IS UP-TO-DATE: Script Approved field matches between cache and current data');
        console.log('   Recommendation: Status change may have already been detected and processed');
        console.log('   Action: Check if the user changed the field back, or if this was already handled');
      } else {
        console.log('❌ CACHE IS OUTDATED: Script Approved field differs between cache and current data');
        console.log('   Recommendation: Force refresh cache to trigger change detection');
        console.log('   Action: Run status monitoring to update cache and detect changes');
      }
    } else {
      console.log('⚠️ DATA MISSING: Cannot complete full analysis');
      console.log('   Recommendation: Check if cache initialization and Google Sheets access are working');
    }

    // 6. Show cache refresh recommendation
    console.log('\n💡 NEXT STEPS:');
    console.log('1. If cache is outdated, run: npm run monitor-status');
    console.log('2. If cache is current, verify user is looking at correct field/video');
    console.log('3. If monitoring still fails, check logs for API errors');
  }
}

// Run the cache status check
const checker = new CacheStatusChecker();
checker.checkCacheStatus()
  .then(() => {
    console.log('\n✅ Cache status analysis completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Cache status analysis failed:', error);
    process.exit(1);
  });