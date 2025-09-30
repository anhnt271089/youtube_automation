import { EventEmitter } from 'events';
import { config } from '../../config/config.js';
import logger from '../utils/logger.js';

/**
 * SchedulerMonitoringService - Advanced monitoring and alerting for AssetDownloadScheduler
 *
 * Features:
 * - Real-time performance monitoring and metrics collection
 * - Intelligent alerting and notification system
 * - Historical data analysis and trend detection
 * - Automated health checks and diagnostics
 * - Integration with Telegram notifications
 * - Comprehensive logging and audit trails
 */
class SchedulerMonitoringService extends EventEmitter {
  constructor(telegramService = null) {
    super();

    this.telegramService = telegramService;

    // Monitoring configuration
    this.enableNotifications = config.assetDownloadScheduler?.enableNotifications !== false;
    this.healthCheckInterval = config.assetDownloadScheduler?.healthCheckInterval || 300000; // 5 minutes
    this.alertThresholds = {
      consecutiveFailures: 3,
      errorRatePercentage: 20,
      processingTimeoutMinutes: 15,
      maxCooldownVideos: 10
    };

    // Metrics storage
    this.metrics = {
      executions: [],
      videoProcessing: [],
      errors: [],
      performanceData: []
    };

    // Health monitoring state
    this.healthStatus = {
      lastCheck: null,
      status: 'unknown',
      alerts: [],
      trends: {}
    };

    // Performance tracking
    this.performanceMetrics = {
      averageExecutionTime: 0,
      averageVideosPerExecution: 0,
      successRate: 0,
      errorRate: 0,
      lastCalculated: null
    };

    logger.info('SchedulerMonitoringService initialized', {
      enableNotifications: this.enableNotifications,
      healthCheckInterval: this.healthCheckInterval
    });
  }

  /**
   * Start monitoring an AssetDownloadScheduler instance
   * @param {AssetDownloadScheduler} scheduler - Scheduler instance to monitor
   */
  startMonitoring(scheduler) {
    this.scheduler = scheduler;

    // Set up comprehensive event listeners
    this.setupSchedulerEventListeners();

    // Start periodic health checks
    this.startHealthCheckInterval();

    // Initial metrics calculation
    this.calculatePerformanceMetrics();

    logger.info('Scheduler monitoring started');

    // Send startup notification
    if (this.enableNotifications) {
      this.sendNotification('🤖 Asset Download Scheduler Monitoring Started',
        'Real-time monitoring and alerting system is now active.', 'info');
    }

    return true;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckTimer);
    }

    logger.info('Scheduler monitoring stopped');

    // Send shutdown notification
    if (this.enableNotifications) {
      this.sendNotification('🛑 Scheduler Monitoring Stopped',
        'Monitoring service has been deactivated.', 'info');
    }

    return true;
  }

  /**
   * Set up comprehensive event listeners for the scheduler
   */
  setupSchedulerEventListeners() {
    if (!this.scheduler) return;

    // Execution monitoring
    this.scheduler.on('executionStarted', (data) => {
      this.recordExecutionStart(data);
    });

    this.scheduler.on('executionCompleted', (data) => {
      this.recordExecutionCompletion(data);
      this.analyzeExecutionPerformance(data);
    });

    this.scheduler.on('executionError', (data) => {
      this.recordExecutionError(data);
      this.checkErrorThresholds(data);
    });

    // Video processing monitoring
    this.scheduler.on('videoProcessed', (data) => {
      this.recordVideoProcessingSuccess(data);
    });

    this.scheduler.on('videoProcessingFailed', (data) => {
      this.recordVideoProcessingFailure(data);
    });

    this.scheduler.on('videoProcessingError', (data) => {
      this.recordVideoProcessingError(data);
    });

    // Scheduler state monitoring
    this.scheduler.on('schedulerStarted', (data) => {
      this.recordSchedulerStateChange('started', data);
    });

    this.scheduler.on('schedulerStopped', (data) => {
      this.recordSchedulerStateChange('stopped', data);
    });

    logger.info('Scheduler event listeners configured');
  }

  /**
   * Record execution start for timing and concurrency tracking
   */
  recordExecutionStart(data) {
    const executionRecord = {
      executionId: data.executionId,
      startTime: data.startTime || new Date(),
      status: 'running'
    };

    this.metrics.executions.push(executionRecord);

    // Keep only last 100 executions
    if (this.metrics.executions.length > 100) {
      this.metrics.executions.shift();
    }

    logger.debug(`Recorded execution start: ${data.executionId}`);
  }

  /**
   * Record execution completion and calculate metrics
   */
  recordExecutionCompletion(data) {
    const executionRecord = this.metrics.executions.find(e => e.executionId === data.executionId);

    if (executionRecord) {
      executionRecord.endTime = new Date();
      executionRecord.duration = data.duration;
      executionRecord.status = 'completed';
      executionRecord.videosProcessed = data.videosProcessed;
      executionRecord.results = data.results;
      executionRecord.result = data.result;
    }

    logger.debug(`Recorded execution completion: ${data.executionId}`);

    // Update performance metrics
    this.calculatePerformanceMetrics();

    // Check for performance alerts
    this.checkPerformanceThresholds(data);
  }

  /**
   * Record execution errors for trend analysis
   */
  recordExecutionError(data) {
    const errorRecord = {
      executionId: data.executionId,
      timestamp: new Date(),
      error: data.error,
      duration: data.duration,
      consecutiveErrors: data.consecutiveErrors
    };

    this.metrics.errors.push(errorRecord);

    // Keep only last 50 errors
    if (this.metrics.errors.length > 50) {
      this.metrics.errors.shift();
    }

    logger.warn(`Recorded execution error: ${data.executionId} - ${data.error}`);
  }

  /**
   * Record video processing success
   */
  recordVideoProcessingSuccess(data) {
    const processingRecord = {
      videoId: data.videoId,
      title: data.title,
      executionId: data.executionId,
      timestamp: new Date(),
      result: 'success',
      details: data.details
    };

    this.metrics.videoProcessing.push(processingRecord);

    // Keep only last 200 video processing records
    if (this.metrics.videoProcessing.length > 200) {
      this.metrics.videoProcessing.shift();
    }

    logger.debug(`Recorded video processing success: ${data.videoId}`);
  }

  /**
   * Record video processing failure
   */
  recordVideoProcessingFailure(data) {
    const processingRecord = {
      videoId: data.videoId,
      title: data.title,
      executionId: data.executionId,
      timestamp: new Date(),
      result: 'failed',
      error: data.error
    };

    this.metrics.videoProcessing.push(processingRecord);

    logger.warn(`Recorded video processing failure: ${data.videoId} - ${data.error}`);

    // Send immediate notification for repeated failures
    this.checkVideoProcessingFailures(data.videoId);
  }

  /**
   * Record video processing errors
   */
  recordVideoProcessingError(data) {
    const processingRecord = {
      videoId: data.videoId,
      title: data.title,
      executionId: data.executionId,
      timestamp: new Date(),
      result: 'error',
      error: data.error
    };

    this.metrics.videoProcessing.push(processingRecord);

    logger.error(`Recorded video processing error: ${data.videoId} - ${data.error}`);

    // Immediate notification for critical errors
    if (this.enableNotifications) {
      this.sendNotification(`🚨 Video Processing Error`,
        `Critical error processing ${data.videoId}: ${data.error}`, 'error');
    }
  }

  /**
   * Record scheduler state changes
   */
  recordSchedulerStateChange(state, data) {
    logger.info(`Scheduler state change: ${state}`, data);

    if (this.enableNotifications) {
      const emoji = state === 'started' ? '🟢' : '🔴';
      const message = state === 'started' ?
        `Scheduler started successfully. Next run: ${data.nextRunTime}` :
        `Scheduler stopped. Total runs completed: ${data.totalRuns}`;

      this.sendNotification(`${emoji} Scheduler ${state.toUpperCase()}`, message, 'info');
    }
  }

  /**
   * Calculate performance metrics from collected data
   */
  calculatePerformanceMetrics() {
    const completedExecutions = this.metrics.executions.filter(e => e.status === 'completed' && e.duration);

    if (completedExecutions.length === 0) {
      return;
    }

    // Average execution time
    const totalExecutionTime = completedExecutions.reduce((sum, e) => sum + e.duration, 0);
    this.performanceMetrics.averageExecutionTime = Math.round(totalExecutionTime / completedExecutions.length);

    // Average videos per execution
    const totalVideos = completedExecutions.reduce((sum, e) => sum + (e.videosProcessed || 0), 0);
    this.performanceMetrics.averageVideosPerExecution = Math.round(totalVideos / completedExecutions.length * 100) / 100;

    // Success rate calculation
    const totalExecutions = this.metrics.executions.length;
    const successfulExecutions = completedExecutions.length;
    const failedExecutions = this.metrics.errors.length;

    if (totalExecutions > 0) {
      this.performanceMetrics.successRate = Math.round((successfulExecutions / totalExecutions) * 100);
      this.performanceMetrics.errorRate = Math.round((failedExecutions / totalExecutions) * 100);
    }

    this.performanceMetrics.lastCalculated = new Date();

    logger.debug('Performance metrics updated', this.performanceMetrics);
  }

  /**
   * Analyze execution performance for anomalies
   */
  analyzeExecutionPerformance(data) {
    // Check for unusually long execution times
    if (data.duration > 600000) { // 10 minutes
      const alert = {
        type: 'performance',
        severity: 'warning',
        message: `Execution ${data.executionId} took ${Math.round(data.duration / 60000)} minutes`,
        timestamp: new Date(),
        data: data
      };

      this.healthStatus.alerts.push(alert);

      if (this.enableNotifications) {
        this.sendNotification('⏰ Long Execution Time', alert.message, 'warning');
      }
    }

    // Check for low processing efficiency
    if (data.videosProcessed === 0 && data.duration > 60000) { // No videos processed in over 1 minute
      const alert = {
        type: 'efficiency',
        severity: 'warning',
        message: `Execution ${data.executionId} processed no videos but took ${Math.round(data.duration / 1000)} seconds`,
        timestamp: new Date(),
        data: data
      };

      this.healthStatus.alerts.push(alert);
    }
  }

  /**
   * Check error thresholds and trigger alerts
   */
  checkErrorThresholds(data) {
    // Check consecutive errors
    if (data.consecutiveErrors >= this.alertThresholds.consecutiveFailures) {
      const alert = {
        type: 'consecutive_errors',
        severity: 'critical',
        message: `${data.consecutiveErrors} consecutive execution failures detected`,
        timestamp: new Date(),
        data: data
      };

      this.healthStatus.alerts.push(alert);

      if (this.enableNotifications) {
        this.sendNotification('🚨 Critical Alert: Consecutive Failures',
          `${data.consecutiveErrors} consecutive failures. System may need attention.`, 'critical');
      }
    }

    // Update health status
    this.updateHealthStatus();
  }

  /**
   * Check for repeated video processing failures
   */
  checkVideoProcessingFailures(videoId) {
    const recentFailures = this.metrics.videoProcessing.filter(record =>
      record.videoId === videoId &&
      record.result !== 'success' &&
      Date.now() - record.timestamp.getTime() < 3600000 // Last hour
    );

    if (recentFailures.length >= 3) {
      const alert = {
        type: 'video_failures',
        severity: 'warning',
        message: `Video ${videoId} has failed ${recentFailures.length} times in the last hour`,
        timestamp: new Date(),
        videoId: videoId
      };

      this.healthStatus.alerts.push(alert);

      if (this.enableNotifications) {
        this.sendNotification('🎬 Repeated Video Failures', alert.message, 'warning');
      }
    }
  }

  /**
   * Check performance thresholds
   */
  checkPerformanceThresholds(data) {
    // Check for declining success rates
    if (this.performanceMetrics.errorRate > this.alertThresholds.errorRatePercentage) {
      const alert = {
        type: 'high_error_rate',
        severity: 'warning',
        message: `Error rate is ${this.performanceMetrics.errorRate}% (threshold: ${this.alertThresholds.errorRatePercentage}%)`,
        timestamp: new Date()
      };

      this.healthStatus.alerts.push(alert);
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthCheckInterval() {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.healthCheckInterval);

    logger.info(`Health check interval started: ${this.healthCheckInterval}ms`);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    try {
      this.healthStatus.lastCheck = new Date();

      // Clean old alerts (older than 1 hour)
      const oneHourAgo = Date.now() - 3600000;
      this.healthStatus.alerts = this.healthStatus.alerts.filter(alert =>
        alert.timestamp.getTime() > oneHourAgo
      );

      // Update health status based on recent activity
      this.updateHealthStatus();

      // Calculate trends
      this.calculateTrends();

      logger.debug('Health check completed', {
        status: this.healthStatus.status,
        activeAlerts: this.healthStatus.alerts.length
      });

    } catch (error) {
      logger.error('Health check failed:', error);

      this.healthStatus.status = 'unhealthy';
      this.healthStatus.alerts.push({
        type: 'health_check_error',
        severity: 'error',
        message: `Health check failed: ${error.message}`,
        timestamp: new Date()
      });
    }
  }

  /**
   * Update overall health status based on collected metrics
   */
  updateHealthStatus() {
    const criticalAlerts = this.healthStatus.alerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = this.healthStatus.alerts.filter(alert => alert.severity === 'warning');

    if (criticalAlerts.length > 0) {
      this.healthStatus.status = 'critical';
    } else if (warningAlerts.length > 2) {
      this.healthStatus.status = 'degraded';
    } else if (warningAlerts.length > 0) {
      this.healthStatus.status = 'warning';
    } else if (this.scheduler && this.scheduler.isRunning) {
      this.healthStatus.status = 'healthy';
    } else {
      this.healthStatus.status = 'stopped';
    }
  }

  /**
   * Calculate performance trends
   */
  calculateTrends() {
    const recentExecutions = this.metrics.executions.filter(e =>
      e.endTime && Date.now() - e.endTime.getTime() < 3600000 // Last hour
    );

    if (recentExecutions.length < 2) {
      return;
    }

    // Calculate execution time trend
    const executionTimes = recentExecutions.map(e => e.duration).filter(d => d);
    if (executionTimes.length >= 2) {
      const recent = executionTimes.slice(-3).reduce((a, b) => a + b) / 3;
      const older = executionTimes.slice(0, -3).reduce((a, b) => a + b) / Math.max(1, executionTimes.length - 3);

      this.healthStatus.trends.executionTime = {
        direction: recent > older ? 'increasing' : 'decreasing',
        percentage: Math.round(((recent - older) / older) * 100)
      };
    }

    // Calculate success rate trend
    const recentSuccesses = recentExecutions.filter(e => e.status === 'completed').length;
    const recentSuccessRate = (recentSuccesses / recentExecutions.length) * 100;

    this.healthStatus.trends.successRate = {
      current: Math.round(recentSuccessRate),
      direction: recentSuccessRate > this.performanceMetrics.successRate ? 'improving' : 'declining'
    };
  }

  /**
   * Send notification via Telegram if available
   */
  async sendNotification(title, message, severity = 'info') {
    if (!this.enableNotifications || !this.telegramService) {
      return;
    }

    try {
      const emoji = this.getSeverityEmoji(severity);
      const formattedMessage = `${emoji} *${title}*\n\n${message}\n\n_Asset Download Scheduler Monitoring_`;

      await this.telegramService.sendMessage(formattedMessage);

      logger.debug('Notification sent', { title, severity });
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Get emoji for severity level
   */
  getSeverityEmoji(severity) {
    switch (severity) {
      case 'critical': return '🚨';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📋';
    }
  }

  /**
   * Get comprehensive monitoring report
   */
  getMonitoringReport() {
    return {
      healthStatus: this.healthStatus,
      performanceMetrics: this.performanceMetrics,
      statistics: {
        totalExecutions: this.metrics.executions.length,
        totalErrors: this.metrics.errors.length,
        totalVideoProcessing: this.metrics.videoProcessing.length,
        activeAlerts: this.healthStatus.alerts.length
      },
      recentActivity: {
        lastExecution: this.metrics.executions[this.metrics.executions.length - 1],
        recentErrors: this.metrics.errors.slice(-5),
        recentVideoProcessing: this.metrics.videoProcessing.slice(-10)
      }
    };
  }

  /**
   * Clear historical data (for maintenance)
   */
  clearHistoricalData(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);

    // Clear old executions
    this.metrics.executions = this.metrics.executions.filter(e =>
      !e.endTime || e.endTime.getTime() > cutoffTime
    );

    // Clear old errors
    this.metrics.errors = this.metrics.errors.filter(e =>
      e.timestamp.getTime() > cutoffTime
    );

    // Clear old video processing records
    this.metrics.videoProcessing = this.metrics.videoProcessing.filter(record =>
      record.timestamp.getTime() > cutoffTime
    );

    // Clear old alerts
    this.healthStatus.alerts = this.healthStatus.alerts.filter(alert =>
      alert.timestamp.getTime() > cutoffTime
    );

    logger.info(`Cleared historical data older than ${olderThanHours} hours`);
  }
}

export default SchedulerMonitoringService;