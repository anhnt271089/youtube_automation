#!/usr/bin/env node

/**
 * Test Script: Duplicate Content Fix Validation
 * 
 * This script tests the fix for duplicate content in Video Info sheets during regeneration.
 * It simulates the regeneration workflow and validates that content is properly replaced
 * instead of duplicated.
 * 
 * Test Workflow:
 * 1. Find a video with existing Video Info content
 * 2. Simulate content regeneration by calling updateSheetsWithNewScript
 * 3. Verify that the Video Info sheet contains only new content (no duplication)
 * 4. Validate that all expected sections are present and properly structured
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import StatusMonitorService from '../src/services/statusMonitorService.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DuplicateContentFixTester {
  constructor() {
    this.statusMonitorService = new StatusMonitorService();
    this.googleSheetsService = new GoogleSheetsService();
  }

  /**
   * Main test execution
   */
  async runTest() {
    try {
      console.log('\n🧪 DUPLICATE CONTENT FIX VALIDATION TEST');
      console.log('==========================================');
      
      // Step 1: Find a test video
      const testVideoId = await this.findTestVideo();
      if (!testVideoId) {
        console.log('❌ No suitable test video found');
        return false;
      }
      
      console.log(`\n📋 Testing with video: ${testVideoId}`);
      
      // Step 2: Get current Video Info content for baseline
      const beforeContent = await this.getVideoInfoContent(testVideoId);
      console.log(`📊 BEFORE: Video Info sheet has ${beforeContent.length} rows`);
      
      // Step 3: Create mock enhanced content for regeneration test
      const mockEnhancedContent = this.createMockEnhancedContent();
      
      // Step 4: Test the fixed updateSheetsWithNewScript method
      console.log('\n🔄 Testing regeneration workflow...');
      await this.statusMonitorService.updateSheetsWithNewScript(testVideoId, mockEnhancedContent);
      
      // Step 5: Get updated Video Info content
      const afterContent = await this.getVideoInfoContent(testVideoId);
      console.log(`📊 AFTER: Video Info sheet has ${afterContent.length} rows`);
      
      // Step 6: Validate the results
      const validationResult = await this.validateResults(beforeContent, afterContent, mockEnhancedContent);
      
      if (validationResult.success) {
        console.log('\n✅ DUPLICATE CONTENT FIX VALIDATION PASSED');
        console.log('==========================================');
        console.log('✓ Content properly replaced (no duplication)');
        console.log('✓ All required sections present');
        console.log('✓ Regenerated content markers found');
        console.log('✓ Complete structure maintained');
        return true;
      } else {
        console.log('\n❌ DUPLICATE CONTENT FIX VALIDATION FAILED');
        console.log('==========================================');
        validationResult.errors.forEach(error => console.log(`❌ ${error}`));
        return false;
      }
      
    } catch (error) {
      console.error('\n💥 Test execution failed:', error);
      return false;
    }
  }

  /**
   * Find a suitable test video with existing Video Info content
   */
  async findTestVideo() {
    try {
      const allVideos = await this.googleSheetsService.getAllVideosStatus();
      
      // Find a video with a detail workbook
      for (const video of allVideos) {
        if (video.detailWorkbookUrl && video.videoId) {
          console.log(`🎯 Found test candidate: ${video.videoId} - ${video.title}`);
          
          // Check if it has Video Info content
          const content = await this.getVideoInfoContent(video.videoId);
          if (content && content.length > 5) {
            return video.videoId;
          }
        }
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to find test video:', error);
      return null;
    }
  }

  /**
   * Get current Video Info sheet content
   */
  async getVideoInfoContent(videoId) {
    try {
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      if (!videoRow || !videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl]) {
        throw new Error(`Detail workbook not found for ${videoId}`);
      }
      
      const workbookUrl = videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
      
      const response = await this.googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.videoInfo}!A1:B500`
      });
      
      return response.data.values || [];
    } catch (error) {
      logger.error(`Failed to get Video Info content for ${videoId}:`, error);
      return [];
    }
  }

  /**
   * Create mock enhanced content for testing
   */
  createMockEnhancedContent() {
    return {
      attractiveScript: 'TEST REGENERATED SCRIPT: This is a completely new script generated for testing the duplicate content fix. It should replace all previous content without creating duplicates.',
      scriptSentences: [
        'TEST: First sentence of the regenerated script.',
        'TEST: Second sentence with different content.',
        'TEST: Third sentence to verify proper replacement.',
        'TEST: Final sentence of the test regeneration.'
      ],
      keywords: {
        primaryKeywords: ['test', 'regeneration', 'fix'],
        longTailKeywords: ['duplicate content fix test', 'video info regeneration test'],
        youtubeSearchKeywords: ['testing', 'validation', 'workflow']
      },
      optimizedTitles: {
        recommended: 'TEST: Regenerated Title for Validation',
        options: [
          'TEST: First Title Option After Regeneration',
          'TEST: Second Title Option For Validation',
          'TEST: Third Title Option Post-Fix'
        ]
      }
    };
  }

  /**
   * Validate the results of the regeneration test
   */
  async validateResults(beforeContent, afterContent, mockEnhancedContent) {
    const errors = [];
    
    try {
      // Check 1: Content should be different (not duplicated)
      const beforeText = JSON.stringify(beforeContent);
      const afterText = JSON.stringify(afterContent);
      
      if (beforeText === afterText) {
        errors.push('Content appears to be identical - regeneration may not have worked');
      }
      
      // Check 2: Look for regeneration markers
      const hasRegenerationMarkers = afterContent.some(row => 
        row.some(cell => cell && cell.includes('✨ NEWLY REGENERATED'))
      );
      
      if (!hasRegenerationMarkers) {
        errors.push('Regeneration markers not found in updated content');
      }
      
      // Check 3: Look for test content
      const hasTestContent = afterContent.some(row =>
        row.some(cell => cell && cell.includes('TEST REGENERATED SCRIPT'))
      );
      
      if (!hasTestContent) {
        errors.push('Test regenerated script content not found');
      }
      
      // Check 4: Look for duplicate content patterns
      const contentRows = afterContent.filter(row => row.length > 0);
      const duplicateRows = this.findDuplicateRows(contentRows);
      
      if (duplicateRows.length > 0) {
        errors.push(`Found ${duplicateRows.length} duplicate rows - content duplication detected`);
      }
      
      // Check 5: Verify required sections are present
      const requiredSections = [
        'Video Title',
        'AI-GENERATED SCRIPT CONTENT',
        'REGENERATION INFO',
        'Attractive Script'
      ];
      
      for (const section of requiredSections) {
        const hasSection = afterContent.some(row =>
          row.some(cell => cell && cell.includes(section))
        );
        
        if (!hasSection) {
          errors.push(`Required section missing: ${section}`);
        }
      }
      
      // Check 6: Verify test sentences are present
      const testSentences = mockEnhancedContent.scriptSentences;
      for (const sentence of testSentences) {
        const hasSentence = afterContent.some(row =>
          row.some(cell => cell && cell.includes(sentence))
        );
        
        if (!hasSentence) {
          errors.push(`Test sentence not found: ${sentence.substring(0, 50)}...`);
        }
      }
      
      return {
        success: errors.length === 0,
        errors
      };
      
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { success: false, errors };
    }
  }

  /**
   * Find duplicate rows in content
   */
  findDuplicateRows(rows) {
    const seen = new Map();
    const duplicates = [];
    
    for (let i = 0; i < rows.length; i++) {
      const rowKey = JSON.stringify(rows[i]);
      if (seen.has(rowKey)) {
        duplicates.push(i);
      } else {
        seen.set(rowKey, i);
      }
    }
    
    return duplicates;
  }
}

// Run the test
async function runDuplicateContentFixTest() {
  const tester = new DuplicateContentFixTester();
  const success = await tester.runTest();
  process.exit(success ? 0 : 1);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDuplicateContentFixTest().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export default DuplicateContentFixTester;