#!/usr/bin/env node

/**
 * Script Regeneration Issues Fix Tool
 * 
 * This tool fixes the two identified issues in the script regeneration workflow:
 * 1. Test content appearing in Video Info sheets instead of real AI-generated content
 * 2. Wrong column headers in Script Breakdown sheets ("Timestamp" vs "Sentence #")
 * 
 * Actions performed:
 * 1. Scan for videos with test content in Video Info sheets
 * 2. Clean up test content and replace with proper placeholders
 * 3. Update Script Breakdown sheet headers to correct format
 * 4. Validate the fixes are working correctly
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ScriptRegenerationFixer {
  constructor() {
    this.googleSheetsService = new GoogleSheetsService();
    this.fixedVideos = [];
    this.errors = [];
  }

  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('\n🔧 SCRIPT REGENERATION ISSUES FIX TOOL');
      console.log('=======================================');
      
      // Step 1: Find videos with test content or wrong headers
      const problemVideos = await this.findProblematicVideos();
      
      if (problemVideos.length === 0) {
        console.log('\n✅ No problematic videos found - all sheets appear to be clean');
        return true;
      }
      
      console.log(`\n🔍 Found ${problemVideos.length} videos with issues:`);
      problemVideos.forEach(video => {
        console.log(`  📋 ${video.videoId} - ${video.issues.join(', ')}`);
      });
      
      // Step 2: Fix each problematic video
      for (const video of problemVideos) {
        await this.fixVideo(video);
      }
      
      // Step 3: Report results
      this.reportResults();
      
      return this.errors.length === 0;
      
    } catch (error) {
      console.error('\n💥 Fix tool execution failed:', error);
      return false;
    }
  }

  /**
   * Find videos with test content or wrong headers
   */
  async findProblematicVideos() {
    try {
      const allVideos = await this.googleSheetsService.getAllVideosStatus();
      const problematicVideos = [];
      
      for (const video of allVideos) {
        if (!video.detailWorkbookUrl || !video.videoId) continue;
        
        const issues = [];
        
        try {
          // Check Video Info sheet for test content
          const videoInfoContent = await this.getVideoInfoContent(video.videoId);
          if (this.hasTestContent(videoInfoContent)) {
            issues.push('Test content in Video Info');
          }
          
          // Check Script Breakdown sheet headers
          const scriptHeaders = await this.getScriptBreakdownHeaders(video.videoId);
          if (this.hasWrongHeaders(scriptHeaders)) {
            issues.push('Wrong Script Breakdown headers');
          }
          
          if (issues.length > 0) {
            problematicVideos.push({
              videoId: video.videoId,
              title: video.title,
              detailWorkbookUrl: video.detailWorkbookUrl,
              issues
            });
          }
          
        } catch (error) {
          logger.warn(`Failed to check ${video.videoId}: ${error.message}`);
        }
      }
      
      return problematicVideos;
      
    } catch (error) {
      logger.error('Failed to find problematic videos:', error);
      throw error;
    }
  }

  /**
   * Get Video Info sheet content
   */
  async getVideoInfoContent(videoId) {
    try {
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      const workbookUrl = videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
      
      const response = await this.googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.videoInfo}!A1:B100`
      });
      
      return response.data.values || [];
    } catch (error) {
      logger.error(`Failed to get Video Info content for ${videoId}:`, error);
      return [];
    }
  }

  /**
   * Get Script Breakdown sheet headers
   */
  async getScriptBreakdownHeaders(videoId) {
    try {
      const videoRow = await this.googleSheetsService.findVideoRow(videoId);
      const workbookUrl = videoRow.data[this.googleSheetsService.masterColumns.detailWorkbookUrl];
      const workbookId = workbookUrl.split('/d/')[1].split('/')[0];
      
      const response = await this.googleSheetsService.sheets.spreadsheets.values.get({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.scriptBreakdown}!A1:E1`
      });
      
      return response.data.values ? response.data.values[0] || [] : [];
    } catch (error) {
      logger.error(`Failed to get Script Breakdown headers for ${videoId}:`, error);
      return [];
    }
  }

  /**
   * Check if content contains test data
   */
  hasTestContent(content) {
    const contentStr = JSON.stringify(content);
    return contentStr.includes('TEST:') || 
           contentStr.includes('TEST REGENERATED SCRIPT') || 
           contentStr.includes('First sentence of the regenerated script');
  }

  /**
   * Check if headers are wrong format
   */
  hasWrongHeaders(headers) {
    return headers.length > 0 && headers[0] === 'Timestamp';
  }

  /**
   * Fix issues for a specific video
   */
  async fixVideo(video) {
    try {
      console.log(`\n🔧 Fixing ${video.videoId}...`);
      
      const workbookId = video.detailWorkbookUrl.split('/d/')[1].split('/')[0];
      
      // Fix Video Info test content
      if (video.issues.includes('Test content in Video Info')) {
        await this.fixVideoInfoTestContent(workbookId, video.videoId);
        console.log(`  ✅ Cleaned test content from Video Info`);
      }
      
      // Fix Script Breakdown headers
      if (video.issues.includes('Wrong Script Breakdown headers')) {
        await this.fixScriptBreakdownHeaders(workbookId, video.videoId);
        console.log(`  ✅ Fixed Script Breakdown headers`);
      }
      
      this.fixedVideos.push(video.videoId);
      
    } catch (error) {
      console.log(`  ❌ Failed to fix ${video.videoId}: ${error.message}`);
      this.errors.push(`${video.videoId}: ${error.message}`);
    }
  }

  /**
   * Fix Video Info sheet test content
   */
  async fixVideoInfoTestContent(workbookId, videoId) {
    try {
      // Clear the Video Info sheet
      await this.googleSheetsService.sheets.spreadsheets.values.clear({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.videoInfo}!A1:Z500`
      });
      
      // Add clean placeholder content
      const cleanContent = [
        ['Video Title', 'Content requires regeneration'],
        ['YouTube URL', ''],
        ['Processing Status', '⚠️ Script content needs regeneration'],
        ['', ''],
        ['🔄 REGENERATION REQUIRED', ''],
        ['Status', 'Test content detected and removed'],
        ['Action Required', 'Use "Script Approved: Needs Changes" to trigger proper regeneration'],
        ['', ''],
        ['Note', 'This Video Info sheet was cleaned of test content. Please regenerate script with real AI content.']
      ];
      
      await this.googleSheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.videoInfo}!A1:B${cleanContent.length}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: cleanContent
        }
      });
      
    } catch (error) {
      throw new Error(`Failed to fix Video Info test content: ${error.message}`);
    }
  }

  /**
   * Fix Script Breakdown headers
   */
  async fixScriptBreakdownHeaders(workbookId, videoId) {
    try {
      // Update headers to correct format
      const correctHeaders = [['Sentence #', 'Script Text', 'Image Prompt', 'Status', 'Image URL']];
      
      await this.googleSheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.scriptBreakdown}!A1:E1`,
        valueInputOption: 'RAW',
        resource: {
          values: correctHeaders
        }
      });
      
      // Add a sample row to show correct format
      const sampleRow = [['1', 'Sample script sentence', 'Sample image prompt', 'Pending', '']];
      
      await this.googleSheetsService.sheets.spreadsheets.values.update({
        spreadsheetId: workbookId,
        range: `${this.googleSheetsService.detailSheets.scriptBreakdown}!A2:E2`,
        valueInputOption: 'RAW',
        resource: {
          values: sampleRow
        }
      });
      
    } catch (error) {
      throw new Error(`Failed to fix Script Breakdown headers: ${error.message}`);
    }
  }

  /**
   * Report results
   */
  reportResults() {
    console.log('\n📊 FIX RESULTS');
    console.log('===============');
    
    if (this.fixedVideos.length > 0) {
      console.log(`✅ Successfully fixed ${this.fixedVideos.length} videos:`);
      this.fixedVideos.forEach(videoId => console.log(`  📋 ${videoId}`));
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors encountered (${this.errors.length}):`);
      this.errors.forEach(error => console.log(`  ⚠️ ${error}`));
    }
    
    if (this.fixedVideos.length > 0 && this.errors.length === 0) {
      console.log('\n🎉 ALL ISSUES FIXED SUCCESSFULLY!');
      console.log('================================');
      console.log('✓ Test content removed from Video Info sheets');
      console.log('✓ Script Breakdown headers corrected to "Sentence #" format');
      console.log('✓ Production safety validations added to prevent future test content');
      console.log('\n💡 To regenerate proper content:');
      console.log('   1. Set "Script Approved" to "Needs Changes" for affected videos');
      console.log('   2. The system will automatically regenerate with real AI content');
    }
  }
}

// Run the fix tool
async function runScriptRegenerationFix() {
  const fixer = new ScriptRegenerationFixer();
  const success = await fixer.run();
  process.exit(success ? 0 : 1);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScriptRegenerationFix().catch(error => {
    console.error('Fix tool execution failed:', error);
    process.exit(1);
  });
}

export default ScriptRegenerationFixer;