#!/usr/bin/env node

/**
 * Comprehensive Status Check - Master Sheet & Queue Analysis
 * Provides detailed summary of current video data and queue status
 */

import { config, validateConfig } from '../config/config.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';
import logger from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

// Validate configuration
try {
  validateConfig();
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

// Initialize service
const sheetsService = new GoogleSheetsService();

/**
 * Main function to check comprehensive status
 */
async function comprehensiveStatusCheck() {
  try {
    console.log('🔍 COMPREHENSIVE STATUS CHECK');
    console.log('============================\n');
    
    // Get all videos from Master Sheet
    const allVideos = await sheetsService.getAllVideos();
    
    if (!allVideos || allVideos.length === 0) {
      console.log('📋 MASTER SHEET STATUS: EMPTY');
      console.log('No videos found in the Master Sheet.');
      return;
    }
    
    // Analyze video data
    const statusSummary = {};
    const scriptApprovalSummary = {};
    const voiceStatusSummary = {};
    const editingStatusSummary = {};
    
    let videosWithWorkbooks = 0;
    let videosWithDriveFolders = 0;
    let videosWithErrors = 0;
    
    allVideos.forEach(video => {
      // Count by main status
      const status = video.status || 'Unknown';
      statusSummary[status] = (statusSummary[status] || 0) + 1;
      
      // Count by script approval
      const scriptApproved = video.scriptApproved || 'Pending';
      scriptApprovalSummary[scriptApproved] = (scriptApprovalSummary[scriptApproved] || 0) + 1;
      
      // Count by voice generation status
      const voiceStatus = video.voiceGenerationStatus || 'Not Started';
      voiceStatusSummary[voiceStatus] = (voiceStatusSummary[voiceStatus] || 0) + 1;
      
      // Count by video editing status
      const editingStatus = video.videoEditingStatus || 'Not Started';
      editingStatusSummary[editingStatus] = (editingStatusSummary[editingStatus] || 0) + 1;
      
      // Count assets
      if (video.detailWorkbookUrl) videosWithWorkbooks++;
      if (video.driveFolder) videosWithDriveFolders++;
      if (status === 'Error') videosWithErrors++;
    });
    
    // Display comprehensive summary
    console.log('📊 MASTER SHEET OVERVIEW');
    console.log('========================');
    console.log(`📹 Total Videos: ${allVideos.length}`);
    console.log(`📁 Videos with Drive Folders: ${videosWithDriveFolders}/${allVideos.length} (${((videosWithDriveFolders/allVideos.length)*100).toFixed(1)}%)`);
    console.log(`📋 Videos with Detail Workbooks: ${videosWithWorkbooks}/${allVideos.length} (${((videosWithWorkbooks/allVideos.length)*100).toFixed(1)}%)`);
    console.log(`❌ Videos with Errors: ${videosWithErrors}/${allVideos.length} (${((videosWithErrors/allVideos.length)*100).toFixed(1)}%)`);
    
    console.log('\n🎯 STATUS BREAKDOWN');
    console.log('------------------');
    Object.entries(statusSummary).forEach(([status, count]) => {
      const percentage = ((count / allVideos.length) * 100).toFixed(1);
      const emoji = status === 'Completed' ? '✅' : status === 'Error' ? '❌' : status === 'Approved' ? '🟢' : '⏳';
      console.log(`${emoji} ${status}: ${count} (${percentage}%)`);
    });
    
    console.log('\n✅ SCRIPT APPROVAL STATUS');
    console.log('-------------------------');
    Object.entries(scriptApprovalSummary).forEach(([approval, count]) => {
      const percentage = ((count / allVideos.length) * 100).toFixed(1);
      const emoji = approval === 'Approved' ? '✅' : approval === 'Needs Changes' ? '🔄' : '⏳';
      console.log(`${emoji} ${approval}: ${count} (${percentage}%)`);
    });
    
    console.log('\n🎤 VOICE GENERATION STATUS');
    console.log('--------------------------');
    Object.entries(voiceStatusSummary).forEach(([status, count]) => {
      const percentage = ((count / allVideos.length) * 100).toFixed(1);
      const emoji = status === 'Completed' ? '✅' : status === 'In Progress' ? '🔄' : '⏳';
      console.log(`${emoji} ${status}: ${count} (${percentage}%)`);
    });
    
    console.log('\n✂️ VIDEO EDITING STATUS');
    console.log('-----------------------');
    Object.entries(editingStatusSummary).forEach(([status, count]) => {
      const percentage = ((count / allVideos.length) * 100).toFixed(1);
      const emoji = status === 'Completed' ? '✅' : status === 'In Progress' ? '🔄' : '⏳';
      console.log(`${emoji} ${status}: ${count} (${percentage}%)`);
    });
    
    // Show recent videos (last 10)
    console.log('\n📅 RECENT VIDEOS (Last 10)');
    console.log('==========================');
    const recentVideos = allVideos
      .sort((a, b) => new Date(b.createdTime || 0) - new Date(a.createdTime || 0))
      .slice(0, 10);
    
    recentVideos.forEach(video => {
      const createdDate = video.createdTime ? new Date(video.createdTime).toLocaleDateString() : 'Unknown';
      const title = video.title || 'Unknown Title';
      const truncatedTitle = title.length > 45 ? title.substring(0, 42) + '...' : title;
      const statusEmoji = video.status === 'Completed' ? '✅' : video.status === 'Error' ? '❌' : '⏳';
      console.log(`${statusEmoji} ${video.videoId}: ${truncatedTitle} (${createdDate})`);
    });
    
    // Check queue directory if it exists
    console.log('\n📦 QUEUE ANALYSIS');
    console.log('=================');
    const queueDir = path.join(process.cwd(), 'queue');
    if (fs.existsSync(queueDir)) {
      const pendingFile = path.join(queueDir, 'pending-generations.json');
      const completedFile = path.join(queueDir, 'completed-generations.json');
      
      let pendingCount = 0;
      let completedCount = 0;
      
      if (fs.existsSync(pendingFile)) {
        try {
          const pendingData = JSON.parse(fs.readFileSync(pendingFile, 'utf-8'));
          pendingCount = Array.isArray(pendingData) ? pendingData.length : 0;
        } catch (error) {
          console.log('⚠️ Error reading pending queue file');
        }
      }
      
      if (fs.existsSync(completedFile)) {
        try {
          const completedData = JSON.parse(fs.readFileSync(completedFile, 'utf-8'));
          completedCount = Array.isArray(completedData) ? completedData.length : 0;
        } catch (error) {
          console.log('⚠️ Error reading completed queue file');
        }
      }
      
      console.log(`⏳ Pending Generations: ${pendingCount}`);
      console.log(`✅ Completed Generations: ${completedCount}`);
      console.log(`📈 Total Queue Activity: ${pendingCount + completedCount}`);
      
      if (pendingCount === 0 && completedCount > 0) {
        console.log('🎉 Queue is clear - all generations completed!');
      } else if (pendingCount > 0) {
        console.log(`⚡ ${pendingCount} items waiting for processing`);
      }
    } else {
      console.log('📦 Queue directory not found');
    }
    
    // Videos ready for next stage
    console.log('\n🚀 ACTIONABLE ITEMS');
    console.log('===================');
    
    const pendingApproval = allVideos.filter(v => 
      v.status === 'Content Ready' && v.scriptApproved === 'Pending'
    );
    
    const needsChanges = allVideos.filter(v => 
      v.scriptApproved === 'Needs Changes'
    );
    
    const readyForVoice = allVideos.filter(v => 
      v.scriptApproved === 'Approved' && 
      v.status === 'Approved' && 
      (!v.voiceGenerationStatus || v.voiceGenerationStatus === 'Not Started')
    );
    
    const readyForEditing = allVideos.filter(v => 
      v.voiceGenerationStatus === 'Completed' && 
      (!v.videoEditingStatus || v.videoEditingStatus === 'Not Started')
    );
    
    const errorVideos = allVideos.filter(v => v.status === 'Error');
    
    if (pendingApproval.length > 0) {
      console.log(`📝 Scripts Pending Approval: ${pendingApproval.length}`);
      pendingApproval.slice(0, 3).forEach(v => {
        const title = v.title || 'Unknown Title';
        const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
        console.log(`  • ${v.videoId}: ${truncatedTitle}`);
      });
      if (pendingApproval.length > 3) {
        console.log(`  ... and ${pendingApproval.length - 3} more`);
      }
    }
    
    if (needsChanges.length > 0) {
      console.log(`🔄 Scripts Needing Changes: ${needsChanges.length}`);
      needsChanges.slice(0, 3).forEach(v => {
        const title = v.title || 'Unknown Title';
        const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
        console.log(`  • ${v.videoId}: ${truncatedTitle}`);
      });
      if (needsChanges.length > 3) {
        console.log(`  ... and ${needsChanges.length - 3} more`);
      }
    }
    
    if (readyForVoice.length > 0) {
      console.log(`🎤 Ready for Voice Generation: ${readyForVoice.length}`);
      readyForVoice.slice(0, 3).forEach(v => {
        const title = v.title || 'Unknown Title';
        const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
        console.log(`  • ${v.videoId}: ${truncatedTitle}`);
      });
      if (readyForVoice.length > 3) {
        console.log(`  ... and ${readyForVoice.length - 3} more`);
      }
    }
    
    if (readyForEditing.length > 0) {
      console.log(`✂️ Ready for Video Editing: ${readyForEditing.length}`);
      readyForEditing.slice(0, 3).forEach(v => {
        const title = v.title || 'Unknown Title';
        const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
        console.log(`  • ${v.videoId}: ${truncatedTitle}`);
      });
      if (readyForEditing.length > 3) {
        console.log(`  ... and ${readyForEditing.length - 3} more`);
      }
    }
    
    if (errorVideos.length > 0) {
      console.log(`❌ Videos with Errors: ${errorVideos.length}`);
      errorVideos.slice(0, 3).forEach(v => {
        const title = v.title || 'Unknown Title';
        const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
        console.log(`  • ${v.videoId}: ${truncatedTitle}`);
      });
      if (errorVideos.length > 3) {
        console.log(`  ... and ${errorVideos.length - 3} more`);
      }
    }
    
    // Final summary
    const totalActionable = pendingApproval.length + needsChanges.length + readyForVoice.length + readyForEditing.length + errorVideos.length;
    
    console.log('\n📈 SUMMARY');
    console.log('==========');
    if (totalActionable === 0) {
      console.log('🎉 All videos are in completed state - no immediate action required!');
    } else {
      console.log(`⚡ ${totalActionable} videos require attention`);
      console.log('💡 Focus on script approvals and error resolution first');
    }
    
    console.log('\n✅ Comprehensive status check completed!');
    
  } catch (error) {
    logger.error('❌ Failed to perform comprehensive status check:', error);
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

// Run the comprehensive check
comprehensiveStatusCheck();