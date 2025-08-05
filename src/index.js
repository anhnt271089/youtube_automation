import cron from 'node-cron';
import { config, validateConfig } from '../config/config.js';
import WorkflowService from './services/workflowService.js';
import logger from './utils/logger.js';
import fs from 'fs';

class YouTubeAutomation {
  constructor() {
    this.workflowService = new WorkflowService();
    this.jobs = new Map();
    this.isRunning = false;
  }

  async initialize() {
    try {
      logger.info('Initializing YouTube Automation System...');
      
      // Validate configuration
      validateConfig();
      logger.info('Configuration validated successfully');

      // Create necessary directories
      this.createDirectories();

      // Initialize services
      await this.setupCronJobs();
      
      // Perform initial health check
      const healthCheck = await this.workflowService.processHealthCheck();
      
      if (!healthCheck.healthy) {
        logger.warn('Some services failed health check:', healthCheck.checks);
      } else {
        logger.info('All services healthy');
      }

      this.isRunning = true;
      logger.info('YouTube Automation System initialized successfully');
      
      return true;
    } catch (error) {
      logger.error('Failed to initialize system:', error);
      throw error;
    }
  }

  createDirectories() {
    const directories = ['./logs', './temp', './output'];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
      }
    });
  }

  async setupCronJobs() {
    try {
      // Process new videos every 10 minutes
      this.jobs.set('newVideos', cron.schedule('*/10 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Running scheduled new video processing');
          await this.workflowService.processNewVideos();
        } catch (error) {
          logger.error('Error in scheduled new video processing:', error);
        }
      }, {
        scheduled: false,
        name: 'newVideoProcessor'
      }));

      // Process approved scripts every 15 minutes
      this.jobs.set('approvedScripts', cron.schedule('*/15 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Running scheduled script processing');
          await this.workflowService.processApprovedScripts();
        } catch (error) {
          logger.error('Error in scheduled script processing:', error);
        }
      }, {
        scheduled: false,
        name: 'scriptProcessor'
      }));

      // Process video generation every 20 minutes
      this.jobs.set('videoGeneration', cron.schedule('*/20 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Running scheduled video generation');
          await this.workflowService.processVideoGeneration();
        } catch (error) {
          logger.error('Error in scheduled video generation:', error);
        }
      }, {
        scheduled: false,
        name: 'videoGenerator'
      }));

      // Check for approval timeouts every hour
      this.jobs.set('timeouts', cron.schedule('0 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Checking for approval timeouts');
          await this.workflowService.processApprovalTimeouts();
        } catch (error) {
          logger.error('Error checking approval timeouts:', error);
        }
      }, {
        scheduled: false,
        name: 'timeoutChecker'
      }));

      // Daily summary at 9 AM
      this.jobs.set('dailySummary', cron.schedule('0 9 * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Generating daily summary');
          await this.workflowService.generateDailySummary();
        } catch (error) {
          logger.error('Error generating daily summary:', error);
        }
      }, {
        scheduled: false,
        name: 'summaryGenerator'
      }));

      // Health check every 6 hours
      this.jobs.set('healthCheck', cron.schedule('0 */6 * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Running system health check');
          const health = await this.workflowService.processHealthCheck();
          
          if (!health.healthy) {
            logger.warn('System health check failed:', health.checks);
          }
        } catch (error) {
          logger.error('Error in health check:', error);
        }
      }, {
        scheduled: false,
        name: 'healthChecker'
      }));

      logger.info('Cron jobs configured successfully');
    } catch (error) {
      logger.error('Error setting up cron jobs:', error);
      throw error;
    }
  }

  async start() {
    try {
      if (!this.isRunning) {
        logger.error('System not initialized. Call initialize() first.');
        return false;
      }

      // Start all cron jobs
      this.jobs.forEach((job, name) => {
        job.start();
        logger.info(`Started cron job: ${name}`);
      });

      logger.info('='.repeat(50));
      logger.info('🚀 YouTube Automation System Started');
      logger.info('='.repeat(50));
      logger.info('📊 Active Jobs:');
      this.jobs.forEach((job, name) => {
        logger.info(`   ✓ ${name}: ${job.options.name}`);
      });
      logger.info('='.repeat(50));

      // Log system status every hour
      setInterval(() => {
        const stats = this.workflowService.getProcessingStats();
        logger.info('System Status:', stats);
      }, 60 * 60 * 1000);

      return true;
    } catch (error) {
      logger.error('Error starting automation system:', error);
      throw error;
    }
  }

  async stop() {
    try {
      logger.info('Stopping YouTube Automation System...');
      
      this.isRunning = false;
      
      // Stop all cron jobs
      this.jobs.forEach((job, name) => {
        job.stop();
        logger.info(`Stopped cron job: ${name}`);
      });

      logger.info('YouTube Automation System stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping automation system:', error);
      throw error;
    }
  }

  // Manual processing methods for testing/immediate execution
  async processUrl(youtubeUrl) {
    try {
      logger.info(`Manual processing requested for: ${youtubeUrl}`);
      return await this.workflowService.processNewUrl(youtubeUrl);
    } catch (error) {
      logger.error('Error in manual URL processing:', error);
      throw error;
    }
  }

  async forceProcessNewVideos() {
    try {
      logger.info('Force processing new videos');
      return await this.workflowService.processNewVideos();
    } catch (error) {
      logger.error('Error in force processing new videos:', error);
      throw error;
    }
  }

  async forceProcessApprovedScripts() {
    try {
      logger.info('Force processing approved scripts');
      return await this.workflowService.processApprovedScripts();
    } catch (error) {
      logger.error('Error in force processing approved scripts:', error);
      throw error;
    }
  }

  async forceGenerateVideos() {
    try {
      logger.info('Force generating videos');
      return await this.workflowService.processVideoGeneration();
    } catch (error) {
      logger.error('Error in force video generation:', error);
      throw error;
    }
  }

  getSystemStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.jobs.keys()),
      stats: this.workflowService.getProcessingStats(),
      uptime: process.uptime(),
      environment: config.app.nodeEnv
    };
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT signal, shutting down gracefully...');
  
  if (global.automationSystem) {
    await global.automationSystem.stop();
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM signal, shutting down gracefully...');
  
  if (global.automationSystem) {
    await global.automationSystem.stop();
  }
  
  process.exit(0);
});

// Main execution
async function main() {
  try {
    const automation = new YouTubeAutomation();
    global.automationSystem = automation;

    await automation.initialize();
    await automation.start();

    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    logger.error('Failed to start YouTube Automation System:', error);
    process.exit(1);
  }
}

// Export for testing or external use
export default YouTubeAutomation;

// Start the system if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}