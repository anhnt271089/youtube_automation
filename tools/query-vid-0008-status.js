#!/usr/bin/env node

/**
 * DIAGNOSTIC TOOL: Query VID-0008 Status Analysis
 * 
 * This tool directly queries Google Sheets to analyze the current status
 * of VID-0008 and identify any discrepancies between actual data and 
 * status monitoring system detection.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VID0008StatusAnalyzer {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Get raw row data for VID-0008
   */
  async getRawVideoData(videoId) {
    try {
      const videoRow = await this.sheetsService.findVideoRow(videoId);
      if (!videoRow) {
        return null;
      }
      
      return {
        rowIndex: videoRow.rowIndex,
        data: videoRow.data,
        totalColumns: videoRow.data.length
      };
    } catch (error) {
      logger.error(`Failed to get raw data for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Get detailed video information using service method
   */
  async getDetailedVideoInfo(videoId) {
    try {
      return await this.sheetsService.getVideoDetails(videoId);
    } catch (error) {
      logger.error(`Failed to get detailed info for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Get specific field values by column mapping
   */
  getMappedFieldValues(rawData) {
    if (!rawData || !rawData.data) return {};

    const columns = this.sheetsService.masterColumns;
    const mappedValues = {};

    Object.entries(columns).forEach(([fieldName, columnIndex]) => {
      mappedValues[fieldName] = rawData.data[columnIndex] || '';
    });

    return mappedValues;
  }

  /**
   * Simulate status monitoring detection logic
   */
  async simulateStatusMonitoring(videoId) {
    try {
      // Get all videos status like the monitoring system does
      const allVideosStatus = await this.sheetsService.getAllVideosStatus();
      
      // Find our specific video
      const videoStatus = allVideosStatus.find(v => v.videoId === videoId);
      
      return videoStatus || null;
    } catch (error) {
      logger.error(`Failed to simulate status monitoring for ${videoId}:`, error);
      return null;
    }
  }

  /**
   * Analyze change detection logic
   */
  detectPotentialChanges(currentVideo, simulatedCache = null) {
    if (!currentVideo) return [];

    // Create a mock "cached" version for testing
    const mockCachedVideo = simulatedCache || {
      ...currentVideo,
      scriptApproved: 'Pending' // Simulate it was previously 'Pending'
    };

    const changes = this.sheetsService.detectStatusChanges([currentVideo], [mockCachedVideo]);
    return changes;
  }

  /**
   * Main analysis function
   */
  async analyzeVID0008Status() {
    const videoId = 'VID-0008';
    
    console.log('\n🔍 ANALYZING VID-0008 STATUS');
    console.log('=' .repeat(50));
    
    // Step 1: Get raw data
    console.log('\n📊 Step 1: Getting raw Google Sheets data...');
    const rawData = await this.getRawVideoData(videoId);
    
    if (!rawData) {
      console.log('❌ VID-0008 not found in Google Sheets');
      return;
    }
    
    console.log(`✅ Found VID-0008 at row ${rawData.rowIndex} with ${rawData.totalColumns} columns`);
    console.log('Raw data array:', rawData.data.slice(0, 20)); // Show first 20 columns
    
    // Step 2: Get mapped field values
    console.log('\n📝 Step 2: Mapping field values...');
    const mappedValues = this.getMappedFieldValues(rawData);
    
    console.log('\n🎯 KEY WORKFLOW FIELDS:');
    console.log(`  Video ID: "${mappedValues.videoId}"`);
    console.log(`  Title: "${mappedValues.title}"`);
    console.log(`  Status: "${mappedValues.status}"`);
    console.log(`  Script Approved: "${mappedValues.scriptApproved}"`);
    console.log(`  Voice Generation Status: "${mappedValues.voiceGenerationStatus}"`);
    console.log(`  Video Editing Status: "${mappedValues.videoEditingStatus}"`);
    console.log(`  Last Edited Time: "${mappedValues.lastEditedTime}"`);
    
    // Step 3: Get detailed info via service method
    console.log('\n🔍 Step 3: Getting detailed info via service method...');
    const detailedInfo = await this.getDetailedVideoInfo(videoId);
    
    if (detailedInfo) {
      console.log('\n📋 SERVICE METHOD RESULTS:');
      console.log(`  Script Approved (service): "${detailedInfo.scriptApproved}"`);
      console.log(`  Status (service): "${detailedInfo.status}"`);
      console.log(`  Voice Generation Status (service): "${detailedInfo.voiceGenerationStatus}"`);
      console.log(`  Video Editing Status (service): "${detailedInfo.videoEditingStatus}"`);
    }
    
    // Step 4: Simulate status monitoring
    console.log('\n🤖 Step 4: Simulating status monitoring system...');
    const monitoredStatus = await this.simulateStatusMonitoring(videoId);
    
    if (monitoredStatus) {
      console.log('\n📡 STATUS MONITORING RESULTS:');
      console.log(`  Script Approved (monitoring): "${monitoredStatus.scriptApproved}"`);
      console.log(`  Status (monitoring): "${monitoredStatus.status}"`);
      console.log(`  Voice Generation Status (monitoring): "${monitoredStatus.voiceGenerationStatus}"`);
      console.log(`  Video Editing Status (monitoring): "${monitoredStatus.videoEditingStatus}"`);
      console.log(`  Last Edited Time (monitoring): "${monitoredStatus.lastEditedTime}"`);
    }
    
    // Step 5: Test change detection
    console.log('\n🔄 Step 5: Testing change detection logic...');
    const detectedChanges = this.detectPotentialChanges(monitoredStatus);
    
    console.log(`\n🚨 CHANGE DETECTION RESULTS: ${detectedChanges.length} changes detected`);
    if (detectedChanges.length > 0) {
      detectedChanges.forEach((change, index) => {
        console.log(`\n  Change ${index + 1}:`);
        console.log(`    Video ID: ${change.videoId}`);
        console.log(`    Title: ${change.title}`);
        Object.entries(change.changes).forEach(([field, changeInfo]) => {
          console.log(`    ${field}: "${changeInfo.old}" → "${changeInfo.new}"`);
        });
      });
    } else {
      console.log('  No changes would be detected by monitoring system');
    }
    
    // Step 6: Analysis and recommendations
    console.log('\n📊 ANALYSIS SUMMARY');
    console.log('=' .repeat(30));
    
    const scriptApprovedValue = mappedValues.scriptApproved;
    console.log(`\n🎯 Script Approved Field Analysis:`);
    console.log(`  Current value: "${scriptApprovedValue}"`);
    console.log(`  Is "Needs Changes": ${scriptApprovedValue === 'Needs Changes'}`);
    console.log(`  Is empty/blank: ${!scriptApprovedValue || scriptApprovedValue.trim() === ''}`);
    console.log(`  Column index: ${this.sheetsService.masterColumns.scriptApproved} (J column)`);
    
    if (scriptApprovedValue === 'Needs Changes') {
      console.log('\n✅ CONFIRMATION: Script Approved field is correctly set to "Needs Changes"');
      console.log('   Status monitoring should detect this as requiring action');
      
      if (detectedChanges.length === 0) {
        console.log('\n❌ ISSUE IDENTIFIED: Change detection is not working');
        console.log('   Possible causes:');
        console.log('   - Monitoring system cache may be incorrect');
        console.log('   - Change detection logic may have bugs');
        console.log('   - Automated transition filter may be blocking detection');
      }
    } else {
      console.log(`\n❌ MISMATCH: User reported "Needs Changes" but field shows "${scriptApprovedValue}"`);
      console.log('   Possible causes:');
      console.log('   - User may be looking at wrong video');
      console.log('   - Field may have been updated after user reported');
      console.log('   - User may be referring to a different field');
    }
    
    // Step 7: Column-by-column analysis for debugging
    console.log('\n📋 COLUMN-BY-COLUMN ANALYSIS');
    console.log('=' .repeat(35));
    Object.entries(this.sheetsService.masterColumns).forEach(([fieldName, index]) => {
      const value = rawData.data[index] || '';
      console.log(`${fieldName.padEnd(20)} (${String.fromCharCode(65 + index)}${index.toString().padStart(2)}): "${value}"`);
    });
    
    console.log('\n🔍 Analysis Complete');
  }
}

// Run the analysis
const analyzer = new VID0008StatusAnalyzer();
analyzer.analyzeVID0008Status()
  .then(() => {
    console.log('\n✅ Analysis completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });