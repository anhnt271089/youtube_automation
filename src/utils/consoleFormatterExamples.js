/**
 * Console Formatter Usage Examples
 * 
 * This file demonstrates how to use the console formatter utility
 * across different scenarios in the YouTube automation project.
 * 
 * To run examples: node src/utils/consoleFormatterExamples.js
 */

import {
    formatHeader,
    formatSubHeader,
    formatStep,
    formatSuccess,
    formatError,
    formatWarning,
    formatInfo,
    formatDebug,
    formatSeparator,
    formatProgress,
    formatProcess,
    formatListItem,
    formatCompletion,
    formatWorkflowStage,
    formatTiming,
    formatTable,
    formatSummary,
    formatForLogger,
    EMOJIS,
    COLORS
} from './consoleFormatter.js';

/**
 * Example 1: Basic message formatting
 */
function exampleBasicFormatting() {
    console.log(formatHeader('YouTube Automation System Started'));
    console.log(formatSeparator());
    
    console.log(formatSubHeader('Initializing Services'));
    console.log(formatInfo('Loading configuration...'));
    console.log(formatSuccess('Google Sheets service connected'));
    console.log(formatWarning('Rate limit approaching for Leonardo AI'));
    console.log(formatError('Failed to connect to Telegram service'));
    console.log(formatDebug('Cache size: 1.2MB, Memory usage: 45%'));
    
    console.log(formatSeparator(30, '-'));
}

/**
 * Example 2: Workflow stage formatting
 */
function exampleWorkflowStages() {
    console.log(formatWorkflowStage('Video Processing'));
    
    console.log(formatStep(1, 'Extract video metadata from YouTube URL'));
    console.log(formatStep(2, 'Generate optimized script content'));
    console.log(formatStep(3, 'Create thumbnail concepts'));
    console.log(formatStep(4, 'Upload assets to Google Drive'));
    
    console.log(formatCompletion('Video processing workflow completed successfully!'));
}

/**
 * Example 3: Progress indicators
 */
function exampleProgressIndicators() {
    console.log(formatHeader('Content Generation Progress'));
    
    // Simulate progress updates
    for (let i = 0; i <= 5; i++) {
        console.log(formatProgress(i, 5, 'Generating thumbnails', {
            showBar: true,
            showPercentage: true
        }));
    }
    
    console.log(formatTiming(2340)); // 2.34 seconds
    console.log(formatTiming(65000)); // 1.08 minutes
}

/**
 * Example 4: Service-specific formatting
 */
function exampleServiceFormatting() {
    console.log(formatWorkflowStage('Service Status Check'));
    
    console.log(formatProcess('Google Sheets API', 'Connected', { 
        emoji: EMOJIS.GOOGLE 
    }));
    console.log(formatProcess('Telegram Bot', 'Sending notification', { 
        emoji: EMOJIS.TELEGRAM 
    }));
    console.log(formatProcess('Leonardo AI', 'Generating images', { 
        emoji: EMOJIS.LEONARDO 
    }));
    console.log(formatProcess('Claude API', 'Processing script', { 
        emoji: EMOJIS.CLAUDE 
    }));
}

/**
 * Example 5: List formatting
 */
function exampleListFormatting() {
    console.log(formatSubHeader('Generated Content Summary'));
    
    console.log(formatListItem('Script: 150 words, optimized for 60-second video'));
    console.log(formatListItem('Thumbnails: 3 concepts generated'));
    console.log(formatListItem('Title: "How to Master YouTube in 2024"'));
    console.log(formatListItem('Description: SEO-optimized, 200 characters'));
    console.log(formatListItem('Upload status: Ready for approval'));
}

/**
 * Example 6: Table formatting
 */
function exampleTableFormatting() {
    console.log(formatHeader('Video Status Report'));
    
    const videoData = [
        { id: 'VID-0001', status: 'Completed', duration: '1:30', views: '10.2K' },
        { id: 'VID-0002', status: 'Processing', duration: '0:45', views: '0' },
        { id: 'VID-0003', status: 'Approved', duration: '2:15', views: '8.7K' },
        { id: 'VID-0004', status: 'Failed', duration: '1:00', views: '0' }
    ];
    
    console.log(formatTable(videoData, {
        headers: true,
        color: COLORS.INFO
    }));
}

/**
 * Example 7: Summary box formatting
 */
function exampleSummaryFormatting() {
    const summaryContent = [
        'Total videos processed: 15',
        'Successful generations: 12',
        'Failed generations: 3',
        'Average processing time: 2.5 minutes',
        'Storage used: 450MB',
        'API calls remaining: 847'
    ];
    
    console.log(formatSummary('Daily Processing Summary', summaryContent, {
        emoji: EMOJIS.COMPLETED,
        color: COLORS.SUCCESS
    }));
}

/**
 * Example 8: Error handling with formatting
 */
function exampleErrorHandling() {
    console.log(formatWorkflowStage('Error Recovery'));
    
    try {
        // Simulate an error
        throw new Error('Network timeout while uploading to Google Drive');
    } catch (error) {
        console.log(formatError(`Operation failed: ${error.message}`));
        console.log(formatInfo('Attempting automatic retry...', { indent: 1 }));
        console.log(formatSuccess('Retry successful - file uploaded', { indent: 1 }));
    }
}

/**
 * Example 9: Logger integration
 */
function exampleLoggerIntegration() {
    console.log(formatHeader('Logger Integration Examples'));
    
    // These would typically be used with winston logger
    const logEntries = [
        formatForLogger('info', 'Workflow started for VID-0015'),
        formatForLogger('warn', 'Rate limit reached for Leonardo AI'),
        formatForLogger('error', 'Failed to update Google Sheets'),
        formatForLogger('debug', 'Cache hit ratio: 85%')
    ];
    
    logEntries.forEach(entry => {
        console.log(`[${entry.level.toUpperCase()}] ${entry.message}`);
    });
}

/**
 * Example 10: Complete workflow simulation
 */
function exampleCompleteWorkflow() {
    console.log(formatHeader('Complete Workflow Simulation'));
    
    // Stage 1: Initialization
    console.log(formatWorkflowStage('Initialization'));
    console.log(formatStep(1, 'Loading environment configuration'));
    console.log(formatSuccess('Configuration loaded successfully'));
    console.log(formatStep(2, 'Connecting to services'));
    console.log(formatSuccess('All services connected'));
    
    // Stage 2: Processing
    console.log(formatWorkflowStage('Content Generation'));
    console.log(formatProcess('YouTube Metadata', 'Extracting video information'));
    console.log(formatProcess('AI Script Generation', 'Creating optimized content'));
    console.log(formatProcess('Thumbnail Creation', 'Generating visual concepts'));
    
    // Progress simulation
    console.log(formatProgress(3, 5, 'Overall progress'));
    
    // Stage 3: Completion
    console.log(formatWorkflowStage('Finalization'));
    console.log(formatSuccess('Content generated successfully'));
    console.log(formatInfo('Uploading to Google Drive...'));
    console.log(formatSuccess('Files uploaded and shared'));
    console.log(formatInfo('Updating master spreadsheet...'));
    console.log(formatSuccess('Spreadsheet updated'));
    
    console.log(formatTiming(4567)); // Total time
    console.log(formatCompletion('Workflow completed successfully!'));
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(formatHeader('Console Formatter Examples', { 
        color: COLORS.PRIMARY,
        emoji: EMOJIS.START 
    }));
    console.log(formatSeparator(60));
    
    exampleBasicFormatting();
    console.log('\n');
    
    exampleWorkflowStages();
    console.log('\n');
    
    exampleProgressIndicators();
    console.log('\n');
    
    exampleServiceFormatting();
    console.log('\n');
    
    exampleListFormatting();
    console.log('\n');
    
    exampleTableFormatting();
    console.log('\n');
    
    exampleSummaryFormatting();
    console.log('\n');
    
    exampleErrorHandling();
    console.log('\n');
    
    exampleLoggerIntegration();
    console.log('\n');
    
    exampleCompleteWorkflow();
    
    console.log(formatSeparator(60));
    console.log(formatCompletion('All examples completed!'));
}

export {
    exampleBasicFormatting,
    exampleWorkflowStages,
    exampleProgressIndicators,
    exampleServiceFormatting,
    exampleListFormatting,
    exampleTableFormatting,
    exampleSummaryFormatting,
    exampleErrorHandling,
    exampleLoggerIntegration,
    exampleCompleteWorkflow
};