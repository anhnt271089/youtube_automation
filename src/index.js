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
      logger.info('Starting system initialization...');
      validateConfig();

      // Create necessary directories
      this.createDirectories();

      // Initialize services
      await this.setupCronJobs();
      
      // Perform initial health check
      const healthCheck = await this.workflowService.processHealthCheck();
      
      if (!healthCheck.healthy) {
        logger.warn('Health check failed:', healthCheck.checks);
      }

      this.isRunning = true;
      logger.info('System initialized successfully');
      
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
      // Define timezone configuration for all cron jobs
      const cronOptions = {
        scheduled: false,
        timezone: config.app.timezone
      };

      // Process new videos every 10 minutes
      this.jobs.set('newVideos', cron.schedule('*/10 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Processing new videos...');
          await this.workflowService.processNewVideos();
        } catch (error) {
          logger.error('Error in scheduled new video processing:', error);
        }
      }, {
        ...cronOptions,
        name: 'newVideoProcessor'
      }));

      // Process videos ready for review every 12 minutes
      this.jobs.set('readyForReview', cron.schedule('*/12 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Processing videos ready for review...');
          await this.workflowService.processReadyForReview();
        } catch (error) {
          logger.error('Error in scheduled ready for review processing:', error);
        }
      }, {
        ...cronOptions,
        name: 'reviewProcessor'
      }));

      // Process approved scripts every 15 minutes
      this.jobs.set('approvedScripts', cron.schedule('*/15 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Processing approved scripts...');
          await this.workflowService.processApprovedScripts();
        } catch (error) {
          logger.error('Error in scheduled script processing:', error);
        }
      }, {
        ...cronOptions,
        name: 'scriptProcessor'
      }));

      // Process error videos for retry every 2 hours
      this.jobs.set('errorVideos', cron.schedule('0 */2 * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Processing error videos for retry...');
          await this.workflowService.processErrorVideos();
        } catch (error) {
          logger.error('Error in scheduled error video processing:', error);
        }
      }, {
        ...cronOptions,
        name: 'errorProcessor'
      }));

      // Video generation removed from automated workflow
      // Users will now manually handle video generation after voice processing

      // Check for approval timeouts every hour
      this.jobs.set('timeouts', cron.schedule('0 * * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Checking approval timeouts...');
          await this.workflowService.processTimeouts();
        } catch (error) {
          logger.error('Error checking approval timeouts:', error);
        }
      }, {
        ...cronOptions,
        name: 'timeoutChecker'
      }));

      // Daily summary at 9 AM Bangkok time
      this.jobs.set('dailySummary', cron.schedule('0 9 * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Generating daily summary...');
          await this.workflowService.generateDailySummary();
        } catch (error) {
          logger.error('Error generating daily summary:', error);
        }
      }, {
        ...cronOptions,
        name: 'summaryGenerator'
      }));

      // Health check every 6 hours (starting at midnight Bangkok time)
      this.jobs.set('healthCheck', cron.schedule('0 */6 * * *', async () => {
        if (!this.isRunning) return;
        
        try {
          logger.info('Running health check...');
          const health = await this.workflowService.processHealthCheck();
          
          if (!health.healthy) {
            logger.warn('Health check failed:', health.checks);
          }
        } catch (error) {
          logger.error('Error in health check:', error);
        }
      }, {
        ...cronOptions,
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
      this.jobs.forEach((job) => {
        job.start();
      });

      logger.info('YouTube Automation System Started');
      logger.info(`Active jobs: ${Array.from(this.jobs.keys()).join(', ')}`);

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
      this.jobs.forEach((job) => {
        job.stop();
      });

      logger.info('System stopped successfully');
      return true;
    } catch (error) {
      logger.error('Error stopping automation system:', error);
      throw error;
    }
  }

  // Manual processing methods for testing/immediate execution
  async processUrl(youtubeUrl) {
    try {
      logger.info(`Processing URL: ${youtubeUrl}`);
      return await this.workflowService.processNewUrl(youtubeUrl);
    } catch (error) {
      logger.error('Error in manual URL processing:', error);
      throw error;
    }
  }

  async forceProcessNewVideos() {
    try {
      logger.info('Force processing new videos...');
      return await this.workflowService.processNewVideos();
    } catch (error) {
      logger.error('Error in force processing new videos:', error);
      throw error;
    }
  }

  async forceProcessReadyForReview() {
    try {
      logger.info('Force processing videos ready for review...');
      return await this.workflowService.processReadyForReview();
    } catch (error) {
      logger.error('Error in force processing ready for review:', error);
      throw error;
    }
  }

  async forceProcessApprovedScripts() {
    try {
      logger.info('Force processing scripts...');
      return await this.workflowService.processApprovedScripts();
    } catch (error) {
      logger.error('Error in force processing approved scripts:', error);
      throw error;
    }
  }

  async forceProcessErrorVideos() {
    try {
      logger.info('Force processing error videos for retry...');
      return await this.workflowService.processErrorVideos();
    } catch (error) {
      logger.error('Error in force processing error videos:', error);
      throw error;
    }
  }

  // Video generation removed from automated workflow
  // Manual video generation will be handled outside this system

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