#!/usr/bin/env node

/**
 * Diagnostic Tool for Specific Video Issues
 * Investigation of VID-0008 and VID-0013 issues
 */

import GoogleSheetsService from '../src/services/googleSheetsService.js';
import GoogleDriveService from '../src/services/googleDriveService.js';
import logger from '../src/utils/logger.js';
import { google } from 'googleapis';
import { config } from '../config/config.js';

class VideosDiagnostic {
  constructor() {
    this.sheetsService = new GoogleSheetsService();
    this.driveService = new GoogleDriveService();
    
    // Setup Google Drive API for direct access
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
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  /**
   * Comprehensive diagnostic for specific videos
   */
  async diagnoseVideos(videoIds) {
    logger.info(`🔍 Starting diagnostic for videos: ${videoIds.join(', ')}`);
    
    const diagnostics = [];
    
    for (const videoId of videoIds) {
      logger.info(`\n📊 ===== DIAGNOSTIC: ${videoId} =====`);
      
      const diagnostic = {
        videoId,
        timestamp: new Date().toISOString(),
        masterSheetData: null,
        detailWorkbook: null,
        driveFolder: null,
        scriptBreakdown: null,
        issues: [],
        recommendations: []
      };

      try {
        // 1. Check master sheet data
        logger.info(`🔎 Checking master sheet data for ${videoId}...`);
        diagnostic.masterSheetData = await this.checkMasterSheetData(videoId);
        
        if (!diagnostic.masterSheetData.found) {
          diagnostic.issues.push({
            severity: 'CRITICAL',
            category: 'DATA_INTEGRITY',
            issue: 'Video not found in master sheet',
            details: `Video ID ${videoId} does not exist in the master Google Sheet`
          });
          
          diagnostic.recommendations.push({
            priority: 'HIGH',
            action: 'Verify video ID is correct or check if video was accidentally deleted'
          });
          
          diagnostics.push(diagnostic);
          continue;
        }

        // 2. Check Drive folder structure
        logger.info(`📁 Checking Drive folder for ${videoId}...`);
        diagnostic.driveFolder = await this.checkDriveFolder(videoId, diagnostic.masterSheetData);

        // 3. Check detail workbook
        logger.info(`📋 Checking detail workbook for ${videoId}...`);
        diagnostic.detailWorkbook = await this.checkDetailWorkbook(videoId, diagnostic.masterSheetData);

        // 4. Check script breakdown
        logger.info(`📝 Checking script breakdown for ${videoId}...`);
        diagnostic.scriptBreakdown = await this.checkScriptBreakdown(videoId, diagnostic.detailWorkbook);

        // 5. Analyze workflow status consistency
        logger.info(`⚙️ Analyzing workflow status for ${videoId}...`);
        await this.analyzeWorkflowStatus(diagnostic);

        // 6. Check for data corruption or missing fields
        logger.info(`🔧 Checking data integrity for ${videoId}...`);
        await this.checkDataIntegrity(diagnostic);

        // 7. Generate recommendations
        await this.generateRecommendations(diagnostic);

      } catch (error) {
        logger.error(`❌ Error during diagnostic for ${videoId}:`, error);
        diagnostic.issues.push({
          severity: 'CRITICAL',
          category: 'SYSTEM_ERROR',
          issue: 'Diagnostic process failed',
          details: error.message,
          stack: error.stack
        });
      }

      diagnostics.push(diagnostic);
    }

    // Generate summary report
    this.generateSummaryReport(diagnostics);
    
    return diagnostics;
  }

  /**
   * Check master sheet data for video
   */
  async checkMasterSheetData(videoId) {
    try {
      const videoDetails = await this.sheetsService.getVideoDetails(videoId);
      
      if (!videoDetails) {
        return {
          found: false,
          data: null,
          issues: ['Video not found in master sheet']
        };
      }

      const issues = [];
      
      // Check for missing or problematic data
      if (!videoDetails.title || videoDetails.title.includes('YouTube API Error')) {
        issues.push('Title is missing or contains error message');
      }
      
      if (!videoDetails.youtubeUrl) {
        issues.push('YouTube URL is missing');
      }
      
      if (!videoDetails.detailWorkbookUrl) {
        issues.push('Detail workbook URL is missing');
      }
      
      if (!videoDetails.driveFolder) {
        issues.push('Drive folder URL is missing');
      }
      
      if (!videoDetails.youtubeVideoId) {
        issues.push('YouTube Video ID is missing');
      }

      return {
        found: true,
        data: videoDetails,
        issues
      };

    } catch (error) {
      return {
        found: false,
        data: null,
        issues: [`Error accessing master sheet: ${error.message}`]
      };
    }
  }

  /**
   * Check Drive folder structure and contents
   */
  async checkDriveFolder(videoId, masterData) {
    const result = {
      exists: false,
      accessible: false,
      folderUrl: null,
      folderId: null,
      contents: [],
      issues: []
    };

    try {
      if (!masterData.data?.driveFolder) {
        result.issues.push('No Drive folder URL in master sheet');
        return result;
      }

      result.folderUrl = masterData.data.driveFolder;
      
      // Extract folder ID from URL
      const folderIdMatch = result.folderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
      if (!folderIdMatch) {
        result.issues.push('Invalid Drive folder URL format');
        return result;
      }

      result.folderId = folderIdMatch[1];

      // Check if folder exists and is accessible
      try {
        const folderResponse = await this.drive.files.get({
          fileId: result.folderId,
          fields: 'id, name, mimeType, trashed, parents'
        });

        if (folderResponse.data.trashed) {
          result.issues.push('Drive folder is in trash');
          return result;
        }

        result.exists = true;
        result.accessible = true;

        // List folder contents
        const contentsResponse = await this.drive.files.list({
          q: `parents in '${result.folderId}' and trashed=false`,
          fields: 'files(id, name, mimeType, size, createdTime, modifiedTime)'
        });

        result.contents = contentsResponse.data.files || [];

        // Check for expected files
        const expectedFiles = ['voice_script.txt'];
        const foundFiles = result.contents.map(f => f.name);
        
        for (const expectedFile of expectedFiles) {
          if (!foundFiles.includes(expectedFile)) {
            result.issues.push(`Missing expected file: ${expectedFile}`);
          }
        }

      } catch (driveError) {
        result.issues.push(`Cannot access Drive folder: ${driveError.message}`);
      }

    } catch (error) {
      result.issues.push(`Drive folder check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check detail workbook accessibility and structure
   */
  async checkDetailWorkbook(videoId, masterData) {
    const result = {
      exists: false,
      accessible: false,
      workbookUrl: null,
      workbookId: null,
      sheets: [],
      videoInfoContent: null,
      issues: []
    };

    try {
      if (!masterData.data?.detailWorkbookUrl) {
        result.issues.push('No detail workbook URL in master sheet');
        return result;
      }

      result.workbookUrl = masterData.data.detailWorkbookUrl;
      
      // Extract workbook ID from URL
      const workbookIdMatch = result.workbookUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!workbookIdMatch) {
        result.issues.push('Invalid detail workbook URL format');
        return result;
      }

      result.workbookId = workbookIdMatch[1];

      // Check if workbook exists and is accessible
      try {
        const workbookResponse = await this.sheets.spreadsheets.get({
          spreadsheetId: result.workbookId
        });

        result.exists = true;
        result.accessible = true;
        result.sheets = workbookResponse.data.sheets?.map(s => s.properties.title) || [];

        // Check for expected sheets
        const expectedSheets = ['Video Info', 'Script Breakdown', 'Analytics'];
        for (const expectedSheet of expectedSheets) {
          if (!result.sheets.includes(expectedSheet)) {
            result.issues.push(`Missing expected sheet: ${expectedSheet}`);
          }
        }

        // Get Video Info content
        if (result.sheets.includes('Video Info')) {
          const videoInfoResponse = await this.sheets.spreadsheets.values.get({
            spreadsheetId: result.workbookId,
            range: 'Video Info!A1:B50'
          });
          result.videoInfoContent = videoInfoResponse.data.values || [];
        }

      } catch (sheetsError) {
        result.issues.push(`Cannot access detail workbook: ${sheetsError.message}`);
      }

    } catch (error) {
      result.issues.push(`Detail workbook check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Check script breakdown sheet content and structure
   */
  async checkScriptBreakdown(videoId, detailWorkbook) {
    const result = {
      exists: false,
      sentenceCount: 0,
      completedCount: 0,
      sentences: [],
      issues: []
    };

    try {
      if (!detailWorkbook.accessible || !detailWorkbook.workbookId) {
        result.issues.push('Detail workbook not accessible for script breakdown check');
        return result;
      }

      if (!detailWorkbook.sheets.includes('Script Breakdown')) {
        result.issues.push('Script Breakdown sheet does not exist');
        return result;
      }

      // Get script breakdown content
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: detailWorkbook.workbookId,
        range: 'Script Breakdown!A2:G100' // Skip header row
      });

      const rows = response.data.values || [];
      result.exists = true;
      result.sentenceCount = rows.length;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sentence = {
          number: row[0] || (i + 1),
          text: row[1] || '',
          imagePrompt: row[2] || '',
          imageUrl: row[3] || '',
          keywords: row[4] || '',
          status: row[5] || 'Pending',
          wordCount: row[6] || ''
        };

        result.sentences.push(sentence);

        if (sentence.status === 'Complete') {
          result.completedCount++;
        }

        // Check for issues
        if (!sentence.text.trim()) {
          result.issues.push(`Sentence ${sentence.number}: Missing script text`);
        }
        
        if (!sentence.imagePrompt.trim()) {
          result.issues.push(`Sentence ${sentence.number}: Missing image prompt`);
        }
      }

      if (result.sentenceCount === 0) {
        result.issues.push('Script breakdown is empty - no sentences found');
      }

    } catch (error) {
      result.issues.push(`Script breakdown check failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Analyze workflow status consistency
   */
  async analyzeWorkflowStatus(diagnostic) {
    const data = diagnostic.masterSheetData.data;
    if (!data) return;

    // Check status consistency
    const status = data.status;
    const scriptApproved = data.scriptApproved;
    const voiceGenStatus = data.voiceGenerationStatus;
    const videoEditStatus = data.videoEditingStatus;

    // Analyze status flow logic
    if (status === 'New' && scriptApproved === 'Approved') {
      diagnostic.issues.push({
        severity: 'MEDIUM',
        category: 'WORKFLOW_INCONSISTENCY',
        issue: 'Status mismatch: New video with approved script',
        details: 'Video status is "New" but script is already approved'
      });
    }

    if (scriptApproved === 'Pending' && voiceGenStatus && voiceGenStatus !== 'Not Ready') {
      diagnostic.issues.push({
        severity: 'HIGH',
        category: 'WORKFLOW_INCONSISTENCY',
        issue: 'Voice generation started before script approval',
        details: `Script: ${scriptApproved}, Voice Status: ${voiceGenStatus}`
      });
    }

    if (status === 'Ready for Voice Generation' && scriptApproved !== 'Approved') {
      diagnostic.issues.push({
        severity: 'HIGH',
        category: 'WORKFLOW_INCONSISTENCY',
        issue: 'Ready for voice generation without approved script',
        details: `Status: ${status}, Script Approved: ${scriptApproved}`
      });
    }

    // Check for stalled workflows
    if (status === 'Scripts Generated' && scriptApproved === 'Pending') {
      // This is normal - waiting for manual approval
    } else if (status === 'Scripts Generated' && scriptApproved === 'Approved') {
      diagnostic.issues.push({
        severity: 'MEDIUM',
        category: 'WORKFLOW_STALL',
        issue: 'Script approved but status not updated',
        details: 'Script is approved but video status is still "Scripts Generated"'
      });
    }
  }

  /**
   * Check data integrity
   */
  async checkDataIntegrity(diagnostic) {
    const data = diagnostic.masterSheetData.data;
    if (!data) return;

    // Check for missing critical fields
    const criticalFields = [
      { field: 'title', name: 'Title' },
      { field: 'youtubeUrl', name: 'YouTube URL' },
      { field: 'youtubeVideoId', name: 'YouTube Video ID' }
    ];

    for (const { field, name } of criticalFields) {
      if (!data[field] || data[field].includes('Error')) {
        diagnostic.issues.push({
          severity: 'HIGH',
          category: 'DATA_INTEGRITY',
          issue: `Missing or corrupted ${name}`,
          details: `${name}: ${data[field] || 'EMPTY'}`
        });
      }
    }

    // Check URL formats
    if (data.youtubeUrl && !data.youtubeUrl.includes('youtube.com')) {
      diagnostic.issues.push({
        severity: 'MEDIUM',
        category: 'DATA_INTEGRITY',
        issue: 'Invalid YouTube URL format',
        details: data.youtubeUrl
      });
    }

    if (data.detailWorkbookUrl && !data.detailWorkbookUrl.includes('docs.google.com/spreadsheets')) {
      diagnostic.issues.push({
        severity: 'MEDIUM',
        category: 'DATA_INTEGRITY',
        issue: 'Invalid detail workbook URL format',
        details: data.detailWorkbookUrl
      });
    }

    if (data.driveFolder && !data.driveFolder.includes('drive.google.com/drive/folders')) {
      diagnostic.issues.push({
        severity: 'MEDIUM',
        category: 'DATA_INTEGRITY',
        issue: 'Invalid Drive folder URL format',
        details: data.driveFolder
      });
    }
  }

  /**
   * Generate specific recommendations based on issues found
   */
  async generateRecommendations(diagnostic) {
    const issues = diagnostic.issues;
    
    // Group issues by category for targeted recommendations
    const criticalIssues = issues.filter(i => i.severity === 'CRITICAL');
    const dataIssues = issues.filter(i => i.category === 'DATA_INTEGRITY');
    const workflowIssues = issues.filter(i => i.category === 'WORKFLOW_INCONSISTENCY' || i.category === 'WORKFLOW_STALL');

    // Critical issues first
    if (criticalIssues.length > 0) {
      diagnostic.recommendations.push({
        priority: 'CRITICAL',
        category: 'IMMEDIATE_ACTION',
        action: 'Address critical system issues before proceeding',
        details: criticalIssues.map(i => i.issue)
      });
    }

    // Data integrity recommendations
    if (dataIssues.length > 0) {
      diagnostic.recommendations.push({
        priority: 'HIGH',
        category: 'DATA_REPAIR',
        action: 'Fix data integrity issues',
        steps: [
          'Run fix-missing-titles.js if title contains errors',
          'Verify YouTube URL and Video ID are correct',
          'Check Drive folder and workbook URLs are accessible',
          'Regenerate missing URLs if necessary'
        ]
      });
    }

    // Workflow recommendations
    if (workflowIssues.length > 0) {
      diagnostic.recommendations.push({
        priority: 'MEDIUM',
        category: 'WORKFLOW_REPAIR',
        action: 'Resolve workflow inconsistencies',
        steps: [
          'Update video status to match current workflow stage',
          'Set script approval status correctly',
          'Reset voice generation status if needed',
          'Clear any stalled workflow flags'
        ]
      });
    }

    // Missing files recommendations
    if (diagnostic.driveFolder?.issues?.some(i => i.includes('Missing expected file'))) {
      diagnostic.recommendations.push({
        priority: 'MEDIUM',
        category: 'FILE_RECOVERY',
        action: 'Regenerate missing files',
        steps: [
          'Re-run script generation if voice_script.txt is missing',
          'Check if video is in approved status before generating voice files',
          'Verify Drive folder permissions and access'
        ]
      });
    }

    // Missing sheets recommendations
    if (diagnostic.detailWorkbook?.issues?.some(i => i.includes('Missing expected sheet'))) {
      diagnostic.recommendations.push({
        priority: 'HIGH',
        category: 'WORKBOOK_REPAIR',
        action: 'Recreate missing workbook sheets',
        steps: [
          'Copy template workbook structure',
          'Populate missing sheets with current data',
          'Update master sheet URLs if workbook was recreated'
        ]
      });
    }

    // Script breakdown issues
    if (diagnostic.scriptBreakdown?.issues?.length > 0) {
      diagnostic.recommendations.push({
        priority: 'MEDIUM',
        category: 'SCRIPT_REPAIR',
        action: 'Fix script breakdown issues',
        steps: [
          'Regenerate script breakdown if empty',
          'Fill in missing script text or image prompts',
          'Update sentence statuses correctly'
        ]
      });
    }
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(diagnostics) {
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 DIAGNOSTIC SUMMARY REPORT');
    logger.info('='.repeat(60));

    let totalIssues = 0;
    let criticalIssues = 0;
    let highIssues = 0;
    let mediumIssues = 0;

    for (const diagnostic of diagnostics) {
      const videoId = diagnostic.videoId;
      const issues = diagnostic.issues;
      totalIssues += issues.length;

      logger.info(`\n🎯 ${videoId}:`);
      logger.info(`   📋 Master Sheet: ${diagnostic.masterSheetData?.found ? '✅ Found' : '❌ Missing'}`);
      logger.info(`   📁 Drive Folder: ${diagnostic.driveFolder?.exists ? '✅ Exists' : '❌ Missing'}`);
      logger.info(`   📊 Detail Workbook: ${diagnostic.detailWorkbook?.accessible ? '✅ Accessible' : '❌ Issues'}`);
      logger.info(`   📝 Script Breakdown: ${diagnostic.scriptBreakdown?.exists ? `✅ ${diagnostic.scriptBreakdown.sentenceCount} sentences` : '❌ Missing'}`);
      logger.info(`   ⚠️ Issues Found: ${issues.length}`);

      // Count severity levels
      issues.forEach(issue => {
        if (issue.severity === 'CRITICAL') criticalIssues++;
        else if (issue.severity === 'HIGH') highIssues++;
        else if (issue.severity === 'MEDIUM') mediumIssues++;
      });

      // Show top 3 issues for this video
      if (issues.length > 0) {
        logger.info(`   🔍 Top Issues:`);
        issues.slice(0, 3).forEach(issue => {
          logger.info(`      • [${issue.severity}] ${issue.issue}`);
        });
      }
    }

    logger.info('\n📈 OVERALL STATISTICS:');
    logger.info(`   🎯 Videos Analyzed: ${diagnostics.length}`);
    logger.info(`   ⚠️ Total Issues: ${totalIssues}`);
    logger.info(`   🚨 Critical: ${criticalIssues}`);
    logger.info(`   ⚡ High Priority: ${highIssues}`);
    logger.info(`   📋 Medium Priority: ${mediumIssues}`);

    // Common patterns
    logger.info('\n🔍 COMMON PATTERNS:');
    const allIssues = diagnostics.flatMap(d => d.issues);
    const issueTypes = {};
    
    allIssues.forEach(issue => {
      const key = `${issue.category}: ${issue.issue}`;
      issueTypes[key] = (issueTypes[key] || 0) + 1;
    });

    Object.entries(issueTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([issue, count]) => {
        logger.info(`   • ${issue} (${count} occurrences)`);
      });

    logger.info('\n' + '='.repeat(60));
  }
}

// Main execution
async function main() {
  try {
    const diagnostic = new VideosDiagnostic();
    const videoIds = ['VID-0008', 'VID-0013'];
    
    logger.info('🚀 Starting comprehensive video diagnostic...');
    const results = await diagnostic.diagnoseVideos(videoIds);
    
    logger.info('\n✅ Diagnostic completed successfully');
    logger.info('📄 Detailed diagnostic data available in results object');
    
    // Write detailed results to file for further analysis
    const fs = await import('fs').then(m => m.promises);
    const resultsFile = `diagnostic-results-${Date.now()}.json`;
    await fs.writeFile(resultsFile, JSON.stringify(results, null, 2));
    logger.info(`📁 Detailed results saved to: ${resultsFile}`);
    
  } catch (error) {
    logger.error('❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default VideosDiagnostic;