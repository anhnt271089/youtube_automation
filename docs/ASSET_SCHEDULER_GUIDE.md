# Asset Download Scheduler - Cron Job System Guide

## Overview

The Asset Download Scheduler is a robust, cron-based system that ensures all approved scripts get their assets downloaded automatically, even if the initial event-driven trigger fails. This system acts as a reliable backup to the existing AssetDownloadOrchestrator.

## Key Features

### 🤖 Intelligent Automation
- **Periodic Checks**: Runs every 7 minutes (configurable) to check for videos needing asset downloads
- **Smart Detection**: Only processes videos with approved scripts that haven't been processed recently
- **Concurrent Processing**: Handles multiple videos simultaneously with configurable limits
- **Cooldown Management**: Prevents excessive retries with intelligent cooldown periods

### 🔍 Comprehensive Monitoring
- **Real-time Status**: Track scheduler health, execution history, and performance metrics
- **Intelligent Alerting**: Telegram notifications for critical issues and status changes
- **Performance Analytics**: Detailed statistics and trend analysis
- **Health Checks**: Automated system health validation

### 🛡️ Robust Error Handling
- **Retry Logic**: Automatic retry with exponential backoff for failed operations
- **Error Recovery**: Graceful handling of temporary failures and service disruptions
- **Circuit Breaker**: Temporary disabling after consecutive failures to prevent system overload
- **Detailed Logging**: Comprehensive audit trails for troubleshooting

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                Asset Download Scheduler                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌──────────────────────────────────┐│
│  │ Cron Scheduler  │────│   Video Detection Engine        ││
│  │ (node-cron)     │    │   • GoogleSheetsService         ││
│  └─────────────────┘    │   • Asset Status Checker        ││
│           │              │   • Priority Calculator         ││
│           ▼              └──────────────────────────────────┘│
│  ┌─────────────────┐    ┌──────────────────────────────────┐│
│  │ Batch Processor │────│   Asset Download Orchestrator   ││
│  │ • Concurrency   │    │   • PexelsService Integration   ││
│  │ • Queue Mgmt    │    │   • Error Handling              ││
│  └─────────────────┘    │   • Status Updates              ││
│           │              └──────────────────────────────────┘│
│           ▼              ┌──────────────────────────────────┐│
│  ┌─────────────────┐    │   Monitoring & Alerting         ││
│  │ Status Tracker  │────│   • SchedulerMonitoringService  ││
│  │ • History       │    │   • Telegram Notifications      ││
│  │ • Metrics       │    │   • Performance Analytics       ││
│  └─────────────────┘    └──────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Integration with Existing System

The scheduler works alongside the existing event-driven system:

1. **Primary Path**: Script approval → Event-driven trigger → Immediate asset download
2. **Backup Path**: Script approval → Cron scheduler detection → Reliable asset download
3. **Coordination**: Both systems prevent duplicate processing through status tracking

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Asset Download Scheduler (Cron-based backup system)
ASSET_SCHEDULER_ENABLED=true                    # Enable/disable scheduler
ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *        # Every 7 minutes
ASSET_SCHEDULER_MAX_CONCURRENT=3                # Max videos processing simultaneously
ASSET_SCHEDULER_TIMEOUT=600000                  # 10 minutes timeout per video
ASSET_SCHEDULER_COOLDOWN=30                     # 30 minutes cooldown between retries
ASSET_SCHEDULER_ENABLE_RETRY=true               # Enable retry logic
ASSET_SCHEDULER_MAX_RETRIES=3                   # Maximum retry attempts
ASSET_SCHEDULER_STATUS_TRACKING=true            # Track processing status
ASSET_SCHEDULER_HEALTH_CHECKS=true              # Enable health monitoring
ASSET_SCHEDULER_NOTIFICATIONS=true              # Telegram notifications
```

### Cron Pattern Examples

| Pattern | Description | Frequency |
|---------|-------------|-----------|
| `*/5 * * * *` | Every 5 minutes | High frequency |
| `*/7 * * * *` | Every 7 minutes | Default (recommended) |
| `*/15 * * * *` | Every 15 minutes | Low frequency |
| `0 */2 * * *` | Every 2 hours | Very low frequency |

## Usage

### Starting the Scheduler

#### Option 1: NPM Scripts (Recommended)
```bash
# Start scheduler
npm run start-asset-scheduler

# Start with custom cron pattern
npm run start-asset-scheduler -- --cron "*/10 * * * *"

# Start in daemon mode (keeps running)
npm run start-asset-scheduler -- --daemon
```

#### Option 2: Direct Command
```bash
# Start scheduler
node tools/start-asset-scheduler.js start

# Start with verbose logging
node tools/start-asset-scheduler.js start --verbose --daemon
```

### Monitoring Operations

#### Check Status
```bash
# Basic status
npm run asset-scheduler-status

# JSON output for automation
npm run asset-scheduler-status -- --json
```

#### View Statistics
```bash
# Overview statistics
npm run asset-scheduler-stats

# Detailed analysis
npm run asset-scheduler-stats -- --detailed
```

#### Health Check
```bash
# Basic health check
npm run asset-scheduler-health

# Verbose health information
npm run asset-scheduler-health -- --verbose
```

#### Live Monitoring
```bash
# Real-time monitoring (updates every 30 seconds)
npm run asset-scheduler-monitor

# Custom interval (60 seconds)
npm run asset-scheduler-monitor -- --interval 60
```

### Manual Operations

#### Trigger Immediate Execution
```bash
# Manual trigger
npm run asset-scheduler-trigger

# With custom reason
npm run asset-scheduler-trigger -- --reason "Emergency processing"
```

#### Stop Scheduler
```bash
npm run stop-asset-scheduler
```

## Monitoring and Alerts

### Telegram Notifications

The scheduler sends intelligent notifications for:

- **System Status**: Scheduler start/stop events
- **Execution Results**: Successful completions and failures
- **Critical Alerts**: Consecutive failures, high error rates
- **Performance Issues**: Long execution times, resource problems

### Health Monitoring

Automated health checks monitor:

- **Service Connectivity**: Google Sheets API availability
- **Processing Performance**: Execution times and success rates
- **Resource Usage**: Memory consumption and system load
- **Error Patterns**: Consecutive failures and error trends

### Performance Metrics

Key metrics tracked:
- **Execution Statistics**: Success/failure rates, average duration
- **Video Processing**: Videos processed per execution, asset completion rates
- **System Health**: Error counts, consecutive failures, recovery times
- **Efficiency**: Processing throughput, resource utilization

## Testing

### Comprehensive Integration Tests

Run the full test suite:
```bash
npm run test-asset-scheduler
```

### Individual Test Categories

```bash
# Configuration validation
node tools/test-asset-scheduler-integration.js test-config

# GoogleSheets integration
node tools/test-asset-scheduler-integration.js test-sheets

# Video detection logic
node tools/test-asset-scheduler-integration.js test-detection
```

### Test Coverage

The test suite validates:
- ✅ Configuration validation and environment setup
- ✅ GoogleSheetsService integration and connectivity
- ✅ Video detection and filtering logic
- ✅ Scheduler initialization and setup
- ✅ Asset processing status checking
- ✅ Monitoring system integration
- ✅ Error handling and recovery mechanisms
- ✅ Performance and resource usage

## Troubleshooting

### Common Issues

#### 1. Scheduler Won't Start
**Problem**: Error during scheduler startup

**Solutions**:
```bash
# Check configuration
npm run test-asset-scheduler -- test-config

# Verify environment variables
node -e "console.log(process.env.ASSET_SCHEDULER_ENABLED)"

# Validate cron pattern
node -e "const cron = require('node-cron'); console.log(cron.validate('*/7 * * * *'))"
```

#### 2. No Videos Being Processed
**Problem**: Scheduler runs but doesn't find videos

**Solutions**:
```bash
# Check video detection
npm run test-asset-scheduler -- test-detection

# View detailed statistics
npm run asset-scheduler-stats -- --detailed

# Check Google Sheets connectivity
npm run test-asset-scheduler -- test-sheets
```

#### 3. High Error Rate
**Problem**: Frequent processing failures

**Solutions**:
```bash
# Check health status
npm run asset-scheduler-health -- --verbose

# Review error patterns
npm run asset-scheduler-monitor

# Test error handling
npm run test-asset-scheduler -- run
```

#### 4. Performance Issues
**Problem**: Slow execution or high resource usage

**Solutions**:
```bash
# Check performance metrics
npm run asset-scheduler-stats

# Adjust concurrent processing
# Edit .env: ASSET_SCHEDULER_MAX_CONCURRENT=2

# Increase cooldown period
# Edit .env: ASSET_SCHEDULER_COOLDOWN=60
```

### Debug Mode

Enable verbose logging for detailed diagnostics:
```bash
# Set debug environment
export LOG_LEVEL=debug

# Start with verbose output
npm run start-asset-scheduler -- --verbose --daemon
```

### Log Analysis

Important log patterns to monitor:
- `🔍 Starting scheduled asset download check` - Execution begins
- `🎯 Found X videos needing asset download` - Video detection results
- `✅ Asset download completed` - Successful processing
- `❌ Asset download failed` - Processing failures
- `🚨 Critical Alert` - System issues requiring attention

## Best Practices

### Production Deployment

1. **Resource Allocation**
   - Ensure adequate memory (minimum 512MB available)
   - Monitor CPU usage during peak processing
   - Configure appropriate concurrent processing limits

2. **Monitoring Setup**
   - Enable Telegram notifications for critical alerts
   - Set up log aggregation for audit trails
   - Configure health check endpoints for external monitoring

3. **Error Recovery**
   - Set reasonable cooldown periods (30-60 minutes)
   - Enable retry logic with backoff
   - Monitor consecutive failure patterns

### Performance Optimization

1. **Concurrency Tuning**
   ```env
   # Conservative settings for stability
   ASSET_SCHEDULER_MAX_CONCURRENT=2

   # Aggressive settings for performance
   ASSET_SCHEDULER_MAX_CONCURRENT=5
   ```

2. **Frequency Adjustment**
   ```env
   # High-volume processing
   ASSET_SCHEDULER_CRON_PATTERN=*/5 * * * *

   # Standard processing
   ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *

   # Low-volume processing
   ASSET_SCHEDULER_CRON_PATTERN=*/15 * * * *
   ```

3. **Resource Management**
   - Monitor memory usage patterns
   - Adjust processing timeout based on asset complexity
   - Use cooldown periods to prevent API rate limiting

### Security Considerations

1. **API Access Control**
   - Use OAuth2 with minimal required scopes
   - Rotate access tokens regularly
   - Monitor API usage patterns

2. **Error Information**
   - Avoid logging sensitive data in error messages
   - Use structured logging for security audit trails
   - Implement proper error sanitization

3. **Process Isolation**
   - Run scheduler in isolated environment if possible
   - Limit network access to required services only
   - Monitor for unusual activity patterns

## Advanced Configuration

### Custom Scheduling Logic

For complex scheduling requirements, you can extend the scheduler:

```javascript
// Custom priority calculation
scheduler.calculateProcessingPriority = (videoData, lastProcessing) => {
  let priority = 100;

  // Your custom logic here
  if (videoData.urgent) priority += 200;
  if (videoData.category === 'premium') priority += 100;

  return priority;
};
```

### Monitoring Integration

Integrate with external monitoring systems:

```javascript
// Custom monitoring service
const customMonitoring = new SchedulerMonitoringService(telegramService);

// Add custom metrics
customMonitoring.on('videoProcessed', (data) => {
  // Send to your monitoring system
  externalMetrics.increment('asset_scheduler.videos_processed', 1, {
    video_id: data.videoId,
    execution_id: data.executionId
  });
});
```

### Webhook Integration

Set up webhooks for external system integration:

```javascript
// Webhook notifications on scheduler events
scheduler.on('executionCompleted', async (data) => {
  if (data.videosProcessed > 0) {
    await fetch('https://your-webhook-url.com/scheduler-completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        executionId: data.executionId,
        videosProcessed: data.videosProcessed,
        duration: data.duration,
        timestamp: new Date().toISOString()
      })
    });
  }
});
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**
   - Review scheduler statistics and performance metrics
   - Check for accumulated errors or warnings
   - Verify system health and resource usage

2. **Monthly**
   - Clear old monitoring data and logs
   - Review and adjust configuration based on usage patterns
   - Update documentation for any configuration changes

3. **Quarterly**
   - Perform comprehensive system testing
   - Review and update error handling procedures
   - Evaluate performance optimizations and improvements

### Getting Help

If you encounter issues:

1. **Run Diagnostics**
   ```bash
   npm run test-asset-scheduler
   npm run asset-scheduler-health -- --verbose
   ```

2. **Check Logs**
   - Review application logs for error patterns
   - Check system resource usage
   - Examine Telegram notifications for alerts

3. **Contact Support**
   - Provide scheduler status output
   - Include recent error logs
   - Share configuration details (without sensitive data)

---

## Summary

The Asset Download Scheduler provides a robust, automated solution for ensuring all approved scripts receive their assets, even when the primary event-driven system fails. With comprehensive monitoring, intelligent error handling, and flexible configuration options, it serves as a critical backup system for reliable content processing workflow.

Key benefits:
- ✅ **Reliability**: Never miss asset downloads for approved scripts
- ✅ **Monitoring**: Comprehensive visibility into system operations
- ✅ **Flexibility**: Configurable scheduling and processing parameters
- ✅ **Integration**: Seamless coordination with existing systems
- ✅ **Scalability**: Handles growing content volumes efficiently