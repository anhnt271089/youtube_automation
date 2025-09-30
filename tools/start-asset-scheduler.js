#!/usr/bin/env node

/**
 * Asset Download Scheduler Management Tool
 *
 * This tool provides comprehensive management capabilities for the AssetDownloadScheduler:
 * - Start/stop the cron-based scheduler
 * - Manual execution triggers
 * - Status monitoring and reporting
 * - Health checks and diagnostics
 * - Performance statistics
 *
 * Usage Examples:
 * node tools/start-asset-scheduler.js start           # Start scheduler
 * node tools/start-asset-scheduler.js stop            # Stop scheduler
 * node tools/start-asset-scheduler.js status          # Check status
 * node tools/start-asset-scheduler.js trigger         # Manual trigger
 * node tools/start-asset-scheduler.js health          # Health check
 * node tools/start-asset-scheduler.js stats           # Show statistics
 * node tools/start-asset-scheduler.js monitor         # Live monitoring
 */

import { Command } from 'commander';
import { config, validateConfig } from '../config/config.js';
import logger from '../src/utils/logger.js';
import AssetDownloadScheduler from '../src/services/assetDownloadScheduler.js';
import GoogleSheetsService from '../src/services/googleSheetsService.js';

// Global scheduler instance
let scheduler = null;
let isMonitoring = false;

const program = new Command();

program
  .name('start-asset-scheduler')
  .description('Asset Download Scheduler management tool')
  .version('1.0.0');

/**
 * Start the asset download scheduler
 */
program
  .command('start')
  .description('Start the asset download scheduler')
  .option('-c, --cron <pattern>', 'Override cron pattern', config.assetDownloadScheduler?.cronPattern)
  .option('-d, --daemon', 'Run in daemon mode (keep process running)', false)
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (options) => {
    try {
      console.log('🤖 Starting Asset Download Scheduler...\n');

      // Validate configuration
      console.log('📋 Validating configuration...');
      validateConfig();
      console.log('✅ Configuration valid\n');

      // Initialize scheduler
      scheduler = new AssetDownloadScheduler();

      // Override cron pattern if provided
      if (options.cron) {
        scheduler.cronPattern = options.cron;
        console.log(`🕒 Using custom cron pattern: ${options.cron}`);
      }

      // Set up event listeners for monitoring
      setupSchedulerEventListeners(scheduler, options.verbose);

      // Start the scheduler
      const started = scheduler.start();

      if (started) {
        console.log('✅ Asset Download Scheduler started successfully!');
        console.log(`📅 Next execution: ${scheduler.statisticsData.nextRunTime}`);
        console.log(`🔄 Pattern: ${scheduler.cronPattern}`);
        console.log(`🔧 Max concurrent processing: ${scheduler.maxConcurrentProcessing}\n`);

        if (options.daemon) {
          console.log('🔄 Running in daemon mode. Press Ctrl+C to stop.\n');

          // Keep process alive and show periodic status
          setInterval(() => {
            const status = scheduler.getStatus();
            console.log(`[${new Date().toISOString()}] Scheduler Status: ${status.health.status} | Runs: ${status.statistics.totalRuns} | Currently Processing: ${status.processing.processingCount}`);
          }, 60000); // Show status every minute

          // Graceful shutdown handling
          process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down gracefully...');
            const stopped = scheduler.stop();
            if (stopped) {
              console.log('✅ Scheduler stopped successfully');
            }
            process.exit(0);
          });

        } else {
          console.log('ℹ️  Scheduler started in background. Use "status" command to monitor.');
        }
      } else {
        console.error('❌ Failed to start Asset Download Scheduler');
        process.exit(1);
      }

    } catch (error) {
      console.error('💥 Error starting scheduler:', error.message);
      logger.error('Error starting scheduler:', error);
      process.exit(1);
    }
  });

/**
 * Stop the asset download scheduler
 */
program
  .command('stop')
  .description('Stop the asset download scheduler')
  .action(async () => {
    try {
      console.log('🛑 Stopping Asset Download Scheduler...\n');

      if (!scheduler) {
        scheduler = new AssetDownloadScheduler();
      }

      const stopped = scheduler.stop();

      if (stopped) {
        console.log('✅ Asset Download Scheduler stopped successfully');

        // Show final statistics
        const status = scheduler.getStatus();
        console.log('\n📊 Final Statistics:');
        console.log(`   Total Runs: ${status.statistics.totalRuns}`);
        console.log(`   Successful Processing: ${status.statistics.successfulProcessing}`);
        console.log(`   Failed Processing: ${status.statistics.failedProcessing}`);
        console.log(`   Videos Skipped: ${status.statistics.videosSkipped}`);
      } else {
        console.log('⚠️  Scheduler was not running or failed to stop');
      }

    } catch (error) {
      console.error('💥 Error stopping scheduler:', error.message);
      logger.error('Error stopping scheduler:', error);
      process.exit(1);
    }
  });

/**
 * Show scheduler status
 */
program
  .command('status')
  .description('Show detailed scheduler status and statistics')
  .option('-j, --json', 'Output in JSON format', false)
  .action(async (options) => {
    try {
      if (!scheduler) {
        scheduler = new AssetDownloadScheduler();
      }

      const status = scheduler.getStatus();

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
        return;
      }

      console.log('📊 Asset Download Scheduler Status\n');

      // Scheduler Status
      console.log('🤖 Scheduler Information:');
      console.log(`   Status: ${status.scheduler.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
      console.log(`   Enabled: ${status.scheduler.enabled ? '✅ Yes' : '❌ No'}`);
      console.log(`   Cron Pattern: ${status.scheduler.cronPattern}`);
      console.log(`   Next Run: ${status.scheduler.nextRunTime || 'Not scheduled'}`);
      console.log(`   Last Run: ${status.scheduler.lastRunTime || 'Never'}\n`);

      // Processing Status
      console.log('⚙️  Processing Information:');
      console.log(`   Currently Processing: ${status.processing.processingCount} videos`);
      if (status.processing.currentlyProcessing.length > 0) {
        console.log(`   Processing: ${status.processing.currentlyProcessing.join(', ')}`);
      }
      console.log(`   Max Concurrent: ${status.processing.maxConcurrentProcessing}\n`);

      // Statistics
      console.log('📈 Statistics:');
      console.log(`   Total Runs: ${status.statistics.totalRuns}`);
      console.log(`   Successful Processing: ${status.statistics.successfulProcessing}`);
      console.log(`   Failed Processing: ${status.statistics.failedProcessing}`);
      console.log(`   Videos Skipped: ${status.statistics.videosSkipped}\n`);

      // Health Status
      console.log('🏥 Health Status:');
      console.log(`   Status: ${getHealthStatusIcon(status.health.status)} ${status.health.status}`);
      console.log(`   Last Health Check: ${status.health.lastHealthCheck || 'Never'}`);
      console.log(`   Error Count: ${status.health.errorCount}`);
      console.log(`   Consecutive Errors: ${status.health.consecutiveErrors}\n`);

      // Configuration
      console.log('⚙️  Configuration:');
      console.log(`   Cron Pattern: ${status.configuration.cronPattern}`);
      console.log(`   Max Concurrent: ${status.configuration.maxConcurrentProcessing}`);
      console.log(`   Cooldown Period: ${status.configuration.cooldownPeriodMinutes} minutes`);
      console.log(`   Retry Logic: ${status.configuration.enableRetryLogic ? '✅ Enabled' : '❌ Disabled'}`);

    } catch (error) {
      console.error('💥 Error getting status:', error.message);
      logger.error('Error getting status:', error);
      process.exit(1);
    }
  });

/**
 * Manually trigger scheduler execution
 */
program
  .command('trigger')
  .description('Manually trigger scheduler execution')
  .option('-r, --reason <reason>', 'Reason for manual trigger', 'Manual trigger via CLI')
  .action(async (options) => {
    try {
      console.log('🔥 Manually triggering Asset Download Scheduler...\n');

      if (!scheduler) {
        scheduler = new AssetDownloadScheduler();
      }

      // Set up event listeners for this execution
      setupSchedulerEventListeners(scheduler, true);

      const result = await scheduler.triggerManualExecution(options.reason);

      if (result.success) {
        console.log('✅ Manual execution completed successfully');
      } else {
        console.error('❌ Manual execution failed:', result.error || result.reason);
      }

    } catch (error) {
      console.error('💥 Error triggering manual execution:', error.message);
      logger.error('Error triggering manual execution:', error);
      process.exit(1);
    }
  });

/**
 * Perform health check
 */
program
  .command('health')
  .description('Perform comprehensive health check')
  .option('-v, --verbose', 'Show detailed health information', false)
  .action(async (options) => {
    try {
      console.log('🏥 Performing Health Check...\n');

      if (!scheduler) {
        scheduler = new AssetDownloadScheduler();
      }

      const healthResult = await scheduler.performHealthCheck();

      console.log('📊 Health Check Results:');
      console.log(`   Overall Status: ${getHealthStatusIcon(healthResult.status)} ${healthResult.status}`);
      console.log(`   Scheduler Running: ${healthResult.scheduler ? '✅ Yes' : '❌ No'}`);
      console.log(`   Last Health Check: ${healthResult.lastHealthCheck}\n`);

      if (healthResult.services) {
        console.log('🔧 Service Status:');
        for (const [serviceName, serviceHealth] of Object.entries(healthResult.services)) {
          console.log(`   ${serviceName}: ${getHealthStatusIcon(serviceHealth.status)} ${serviceHealth.status}`);
          if (options.verbose && serviceHealth.error) {
            console.log(`     Error: ${serviceHealth.error}`);
          }
        }
        console.log();
      }

      if (healthResult.error) {
        console.log(`❌ Health Check Error: ${healthResult.error}\n`);
      }

      // Additional system information
      if (options.verbose) {
        console.log('💾 System Information:');
        console.log(`   Node.js Version: ${process.version}`);
        console.log(`   Platform: ${process.platform}`);
        console.log(`   Memory Usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
        console.log(`   Uptime: ${Math.round(process.uptime())}s\n`);
      }

    } catch (error) {
      console.error('💥 Error performing health check:', error.message);
      logger.error('Error performing health check:', error);
      process.exit(1);
    }
  });

/**
 * Show comprehensive statistics
 */
program
  .command('stats')
  .description('Show comprehensive asset download statistics')
  .option('-d, --detailed', 'Show detailed statistics', false)
  .action(async (options) => {
    try {
      console.log('📈 Asset Download Statistics\n');

      // Initialize services
      const sheetsService = new GoogleSheetsService();

      console.log('📊 Getting comprehensive statistics...');

      // Get summary statistics
      const summaryStats = await sheetsService.getAssetDownloadSummaryStats();

      console.log('\n🎯 Overview:');
      console.log(`   Total Videos: ${summaryStats.total}`);
      console.log(`   Scripts Approved: ${summaryStats.scriptApproved}`);
      console.log(`   Assets Processed: ${summaryStats.assetsProcessed}`);
      console.log(`   Needing Assets: ${summaryStats.needingAssets}`);
      console.log(`   Processing Errors: ${summaryStats.processingErrors}`);
      console.log(`   Last Updated: ${summaryStats.lastUpdated.toLocaleString()}\n`);

      // Processing efficiency metrics
      if (summaryStats.scriptApproved > 0) {
        const processingRate = Math.round((summaryStats.assetsProcessed / summaryStats.scriptApproved) * 100);
        console.log('📊 Processing Metrics:');
        console.log(`   Processing Completion Rate: ${processingRate}%`);
        console.log(`   Pending Processing: ${summaryStats.needingAssets} videos`);

        if (summaryStats.processingErrors > 0) {
          const errorRate = Math.round((summaryStats.processingErrors / summaryStats.scriptApproved) * 100);
          console.log(`   Error Rate: ${errorRate}%`);
        }
        console.log();
      }

      // Scheduler-specific statistics
      if (!scheduler) {
        scheduler = new AssetDownloadScheduler();
      }

      const schedulerStatus = scheduler.getStatus();

      console.log('🤖 Scheduler Statistics:');
      console.log(`   Total Scheduler Runs: ${schedulerStatus.statistics.totalRuns}`);
      console.log(`   Successful Operations: ${schedulerStatus.statistics.successfulProcessing}`);
      console.log(`   Failed Operations: ${schedulerStatus.statistics.failedProcessing}`);
      console.log(`   Videos Skipped: ${schedulerStatus.statistics.videosSkipped}`);

      if (schedulerStatus.statistics.totalRuns > 0) {
        const successRate = Math.round((schedulerStatus.statistics.successfulProcessing / schedulerStatus.statistics.totalRuns) * 100);
        console.log(`   Success Rate: ${successRate}%`);
      }

      console.log();

      // Detailed breakdown if requested
      if (options.detailed) {
        console.log('🔍 Getting detailed video analysis...');

        const videosNeedingAssets = await sheetsService.getVideosNeedingAssetDownload();

        if (videosNeedingAssets.length > 0) {
          console.log('\n📝 Videos Needing Asset Processing:');

          for (const video of videosNeedingAssets.slice(0, 10)) { // Show first 10
            const assetStatus = await sheetsService.checkVideoAssetProcessingStatus(video.videoId);

            console.log(`   ${video.videoId}: ${video.title.substring(0, 50)}...`);
            console.log(`     Status: ${assetStatus.reason}`);
            console.log(`     Assets: ${assetStatus.processedEntries}/${assetStatus.totalEntries} (${assetStatus.processedPercentage}%)`);
          }

          if (videosNeedingAssets.length > 10) {
            console.log(`   ... and ${videosNeedingAssets.length - 10} more videos`);
          }
          console.log();
        }
      }

    } catch (error) {
      console.error('💥 Error getting statistics:', error.message);
      logger.error('Error getting statistics:', error);
      process.exit(1);
    }
  });

/**
 * Live monitoring mode
 */
program
  .command('monitor')
  .description('Start live monitoring of scheduler activity')
  .option('-i, --interval <seconds>', 'Monitoring interval in seconds', '30')
  .action(async (options) => {
    try {
      console.log('🔍 Starting Asset Download Scheduler Monitoring\n');

      if (!scheduler) {
        scheduler = new AssetDownloadScheduler();
      }

      const interval = parseInt(options.interval) * 1000;
      isMonitoring = true;

      // Set up detailed event listeners
      setupSchedulerEventListeners(scheduler, true);

      console.log(`📊 Monitoring every ${options.interval} seconds. Press Ctrl+C to stop.\n`);

      // Initial status display
      await displayMonitoringStatus(scheduler);

      // Set up periodic monitoring
      const monitoringInterval = setInterval(async () => {
        if (!isMonitoring) {
          clearInterval(monitoringInterval);
          return;
        }

        console.log(`\n[${new Date().toISOString()}] Status Update:`);
        await displayMonitoringStatus(scheduler);
      }, interval);

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n🛑 Stopping monitoring...');
        isMonitoring = false;
        clearInterval(monitoringInterval);
        process.exit(0);
      });

    } catch (error) {
      console.error('💥 Error starting monitoring:', error.message);
      logger.error('Error starting monitoring:', error);
      process.exit(1);
    }
  });

/**
 * Set up event listeners for scheduler monitoring
 */
function setupSchedulerEventListeners(scheduler, verbose = false) {
  scheduler.on('schedulerStarted', (data) => {
    console.log(`✅ Scheduler started - Next run: ${data.nextRunTime}`);
  });

  scheduler.on('schedulerStopped', (data) => {
    console.log(`🛑 Scheduler stopped - Total runs: ${data.totalRuns}`);
  });

  scheduler.on('executionStarted', (data) => {
    if (verbose) {
      console.log(`🔍 Execution started [${data.executionId}]`);
    }
  });

  scheduler.on('executionCompleted', (data) => {
    console.log(`✅ Execution completed [${data.executionId}] - Duration: ${data.duration}ms, Videos: ${data.videosProcessed}, Result: ${data.result}`);
  });

  scheduler.on('executionError', (data) => {
    console.error(`❌ Execution error [${data.executionId}] - ${data.error} (Consecutive errors: ${data.consecutiveErrors})`);
  });

  scheduler.on('videoProcessed', (data) => {
    if (verbose) {
      console.log(`📹 Video processed: ${data.videoId} - ${data.title}`);
    }
  });

  scheduler.on('videoProcessingFailed', (data) => {
    console.warn(`⚠️  Video processing failed: ${data.videoId} - ${data.error}`);
  });

  scheduler.on('videoProcessingError', (data) => {
    console.error(`💥 Video processing error: ${data.videoId} - ${data.error}`);
  });
}

/**
 * Display current monitoring status
 */
async function displayMonitoringStatus(scheduler) {
  const status = scheduler.getStatus();

  console.log(`   Status: ${getHealthStatusIcon(status.health.status)} ${status.scheduler.isRunning ? 'Running' : 'Stopped'}`);
  console.log(`   Runs: ${status.statistics.totalRuns} | Success: ${status.statistics.successfulProcessing} | Failed: ${status.statistics.failedProcessing}`);
  console.log(`   Processing: ${status.processing.processingCount}/${status.processing.maxConcurrentProcessing}`);

  if (status.scheduler.nextRunTime) {
    const nextRun = new Date(status.scheduler.nextRunTime);
    const timeToNext = nextRun - new Date();
    const minutesToNext = Math.ceil(timeToNext / 60000);
    console.log(`   Next run: ${nextRun.toLocaleTimeString()} (in ${minutesToNext} minutes)`);
  }

  if (status.processing.currentlyProcessing.length > 0) {
    console.log(`   Currently processing: ${status.processing.currentlyProcessing.join(', ')}`);
  }
}

/**
 * Get health status icon
 */
function getHealthStatusIcon(status) {
  switch (status) {
    case 'healthy':
    case 'running':
      return '🟢';
    case 'unhealthy':
    case 'error':
      return '🔴';
    case 'stopped':
    case 'idle':
      return '🟡';
    case 'disabled_error':
      return '🟠';
    default:
      return '⚪';
  }
}

/**
 * Main CLI execution
 */
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error('💥 CLI Error:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  logger.error('Unhandled promise rejection:', reason);

  // Try to gracefully stop scheduler before exiting
  if (scheduler && scheduler.isRunning) {
    console.log('Attempting graceful shutdown of scheduler...');
    scheduler.stop();
  }

  // Give some time for cleanup before exit
  setTimeout(() => {
    process.exit(1);
  }, 3000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  logger.error('Uncaught exception:', error);

  // Try to gracefully stop scheduler before exiting
  if (scheduler && scheduler.isRunning) {
    console.log('Attempting graceful shutdown of scheduler...');
    scheduler.stop();
  }

  // Give some time for cleanup before exit
  setTimeout(() => {
    process.exit(1);
  }, 3000);
});

// Execute main function
main();