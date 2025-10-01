# Asset Download Automation - Setup & Usage Guide

**Version**: 2.0
**Last Updated**: October 1, 2025
**Status**: ✅ Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [How It Works](#how-it-works)
3. [Setup Instructions](#setup-instructions)
4. [Usage](#usage)
5. [Management](#management)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Configuration](#advanced-configuration)

---

## Overview

The Asset Download Automation system automatically downloads and manages assets (images from Pexels) when a video's script status is changed to "Approved" in Google Sheets.

### Key Features

✅ **Automatic Triggering**: Downloads start when Script Status = "Approved"
✅ **Dual-Layer System**: Cron scheduler + event-driven orchestrator
✅ **Duplicate Prevention**: Atomic status updates prevent concurrent processing
✅ **Smart Retry Logic**: Exponential backoff and priority-based queue
✅ **Resource Management**: Configurable concurrency and cooldown periods
✅ **Comprehensive Monitoring**: Event-based logging and status tracking

---

## How It Works

### Workflow Diagram

```
┌─────────────────────────────────────┐
│  User Changes Script Status         │
│  to "Approved" in Google Sheets     │
└───────────────┬─────────────────────┘
                │
    ┌───────────┴───────────┐
    │                       │
    ▼                       ▼
┌────────────┐      ┌──────────────┐
│  Cron      │      │  Event       │
│  Scheduler │      │  Orchestrator│
│  (Every    │      │  (Immediate) │
│  7 min)    │      │              │
└─────┬──────┘      └──────┬───────┘
      │                    │
      └──────────┬─────────┘
                 │
                 ▼
      ┌──────────────────┐
      │  Asset Download  │
      │  Service         │
      │  (Pexels)        │
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │  Upload to       │
      │  Google Drive    │
      └─────────┬────────┘
                │
                ▼
      ┌──────────────────┐
      │  Update Sheet    │
      │  Status          │
      └──────────────────┘
```

### Processing Logic

1. **Detection**: System detects `scriptApproved = "Approved"`
2. **Validation**: Checks prerequisites (script breakdown exists, Drive folder ready)
3. **Queue Check**: Ensures video not already processing or in cooldown
4. **Asset Download**: Fetches images from Pexels based on search phrases
5. **Upload**: Stores images in Google Drive with shareable links
6. **Status Update**: Updates Google Sheets with URLs and completion status

### Duplicate Prevention

The system prevents duplicate downloads through:

1. **"Downloading" Status**: Marks sentences as "Downloading" during processing
2. **Processing Set**: Tracks videos currently being processed in memory
3. **Cooldown Period**: 30-minute cooldown between retry attempts
4. **Completion Check**: Skips if >20% of sentences have images

---

## Setup Instructions

### Option 1: Auto-Start (Recommended)

The asset scheduler **automatically starts** with the main application.

**Configuration**:
```bash
# .env file
ASSET_SCHEDULER_ENABLED=true                    # Enable scheduler (default: true)
ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *       # Every 7 minutes
ASSET_SCHEDULER_MAX_CONCURRENT=3                # Max 3 videos at once
ASSET_SCHEDULER_COOLDOWN=30                     # 30 min cooldown
```

**Start the system**:
```bash
npm start
```

The asset scheduler will automatically initialize and start running.

**Verify**:
```bash
# Check logs for:
# 🤖 Initializing Asset Download Scheduler...
# ✅ Asset Download Scheduler started successfully
```

### Option 2: PM2 Process Manager (Production)

For production deployments, use PM2 for automatic restarts and monitoring.

**Install PM2**:
```bash
npm install -g pm2
```

**Start with PM2**:
```bash
# Start all processes
npm run pm2:start

# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Monitor
npm run pm2:monit
```

**PM2 Auto-Startup** (runs on server boot):
```bash
# Generate startup script
pm2 startup

# Save current process list
pm2 save
```

### Option 3: Standalone Scheduler (Advanced)

Run the scheduler as a separate process (independent of main app).

**Manual Start**:
```bash
node tools/start-asset-scheduler.js start --daemon
```

**With PM2**:
```bash
# Edit ecosystem.config.cjs - set autostart: true for 'asset-scheduler'
pm2 start ecosystem.config.cjs --only asset-scheduler
```

---

## Usage

### Basic Workflow

1. **Add Video to Master Sheet**: Paste YouTube URL
2. **System Processes**: Auto-generates script
3. **Approve Script**: Change "Script Status" to "Approved"
4. **Auto Download**: Assets download automatically (within 7 minutes)
5. **Monitor Progress**: Check status updates in Google Sheets

### Manual Operations

#### Check Scheduler Status
```bash
npm run asset-scheduler-status
```

Output:
```
📊 Asset Download Scheduler Status

🤖 Scheduler Information:
   Status: 🟢 Running
   Enabled: ✅ Yes
   Cron Pattern: */7 * * * *
   Next Run: 2025-10-01T10:14:00.000Z
   Last Run: 2025-10-01T10:07:00.000Z

⚙️  Processing Information:
   Currently Processing: 0 videos
   Max Concurrent: 3

📈 Statistics:
   Total Runs: 15
   Successful Processing: 12
   Failed Processing: 1
   Videos Skipped: 2
```

#### View Statistics
```bash
npm run asset-scheduler-stats
```

#### Manual Trigger
```bash
npm run asset-scheduler-trigger
```

Force immediate execution (doesn't wait for cron schedule).

#### Health Check
```bash
npm run asset-scheduler-health
```

Verifies:
- Scheduler is running
- Google Sheets connectivity
- Pexels API accessibility
- System resources

#### Live Monitoring
```bash
npm run asset-scheduler-monitor
```

Real-time monitoring with periodic status updates.

---

## Management

### Starting the Scheduler

**Auto-start (Default)**:
```bash
npm start  # Scheduler starts automatically
```

**Manual start**:
```bash
npm run start-asset-scheduler
```

**With custom cron pattern**:
```bash
node tools/start-asset-scheduler.js start --cron "*/5 * * * *"  # Every 5 minutes
```

### Stopping the Scheduler

**Graceful stop**:
```bash
npm run stop-asset-scheduler
```

**Force stop** (if main app is running):
```bash
# Stop main app (stops scheduler too)
pm2 stop youtube-automation
```

### Restarting

**PM2**:
```bash
npm run pm2:restart
```

**Manual**:
```bash
npm run stop-asset-scheduler
npm run start-asset-scheduler
```

### Monitoring

**View Logs**:
```bash
# PM2 logs
npm run pm2:logs

# Application logs
tail -f logs/app.log
tail -f logs/asset-scheduler-combined.log
```

**Monitor Performance**:
```bash
npm run pm2:monit
```

**Check Queue**:
```bash
# See videos pending asset download
node tools/check-asset-status.js
```

---

## Troubleshooting

### Common Issues

#### 1. Scheduler Not Running

**Symptom**: Assets not downloading automatically

**Check**:
```bash
npm run asset-scheduler-status
```

**Solutions**:
```bash
# Check if enabled in config
grep ASSET_SCHEDULER_ENABLED .env

# Manually start
npm run start-asset-scheduler

# Check logs for errors
tail -f logs/app.log
```

#### 2. Videos Stuck in Queue

**Symptom**: Video approved but assets not downloading

**Check**:
```bash
npm run asset-scheduler-stats
```

**Solutions**:
```bash
# Manual trigger
npm run asset-scheduler-trigger

# Check specific video
node tools/download-assets-for-video.js [VIDEO_ID]

# Retry failed asset
node tools/retry-failed-asset.js [VIDEO_ID]
```

#### 3. Duplicate Downloads

**Symptom**: Same video being processed multiple times

**Check status in Google Sheets**: Look for "Downloading" status

**Solutions**:
- System should auto-prevent duplicates
- Check cooldown period: Default 30 minutes
- Verify status update logic in logs

#### 4. High Error Rate

**Symptom**: Many failed processing attempts

**Check**:
```bash
npm run asset-scheduler-health
```

**Common causes**:
- Pexels API rate limits (500 requests/hour)
- Google Drive quota exceeded
- Network connectivity issues
- Invalid search phrases

**Solutions**:
```bash
# Reduce concurrency
# Edit .env:
ASSET_SCHEDULER_MAX_CONCURRENT=1

# Increase cooldown
ASSET_SCHEDULER_COOLDOWN=60  # 60 minutes

# Restart scheduler
npm run pm2:restart
```

#### 5. Scheduler Disabled Itself

**Symptom**: Status shows "disabled_error"

**Cause**: Too many consecutive errors (5+)

**Solution**:
```bash
# Wait 30 minutes (auto re-enables)
# OR manually restart
npm run pm2:restart
```

---

## Advanced Configuration

### Environment Variables

```bash
# Asset Download Scheduler
ASSET_SCHEDULER_ENABLED=true                    # Enable/disable (default: true)
ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *       # Cron pattern (default: every 7 min)
ASSET_SCHEDULER_MAX_CONCURRENT=3                # Max videos processing (default: 3)
ASSET_SCHEDULER_TIMEOUT=600000                  # Timeout per video in ms (default: 10 min)
ASSET_SCHEDULER_COOLDOWN=30                     # Cooldown in minutes (default: 30)
ASSET_SCHEDULER_ENABLE_RETRY=true              # Enable retry logic (default: true)
ASSET_SCHEDULER_MAX_RETRIES=3                   # Max retry attempts (default: 3)
ASSET_SCHEDULER_STATUS_TRACKING=true           # Track status (default: true)
ASSET_SCHEDULER_HEALTH_CHECKS=true             # Enable health checks (default: true)
ASSET_SCHEDULER_NOTIFICATIONS=true             # Telegram notifications (default: true)

# Asset Download Service
ENABLE_AUTO_ASSET_DOWNLOAD=true                # Enable auto-download (default: true)
ASSET_DOWNLOAD_MAX_RETRIES=3                    # Max retries (default: 3)
ASSET_DOWNLOAD_RETRY_DELAY=5000                # Retry delay in ms (default: 5s)
ASSET_DOWNLOAD_TIMEOUT=300000                   # Timeout in ms (default: 5 min)
ASSET_DOWNLOAD_DELAY=2000                       # Delay between assets (default: 2s)
ASSET_DOWNLOAD_COOLDOWN=15                      # Cooldown in minutes (default: 15)
ASSET_DOWNLOAD_MAX_CONCURRENT=2                # Max concurrent downloads (default: 2)
```

### Cron Pattern Examples

```bash
# Every 5 minutes
ASSET_SCHEDULER_CRON_PATTERN=*/5 * * * *

# Every 10 minutes
ASSET_SCHEDULER_CRON_PATTERN=*/10 * * * *

# Every hour at minute 0
ASSET_SCHEDULER_CRON_PATTERN=0 * * * *

# Every 30 minutes
ASSET_SCHEDULER_CRON_PATTERN=*/30 * * * *

# Every day at 2 AM
ASSET_SCHEDULER_CRON_PATTERN=0 2 * * *

# Every Monday at 9 AM
ASSET_SCHEDULER_CRON_PATTERN=0 9 * * 1
```

### Performance Tuning

#### High Volume (Many Videos)
```bash
ASSET_SCHEDULER_CRON_PATTERN=*/5 * * * *       # More frequent checks
ASSET_SCHEDULER_MAX_CONCURRENT=5                # Higher concurrency
ASSET_SCHEDULER_COOLDOWN=15                     # Shorter cooldown
```

#### Resource Constrained
```bash
ASSET_SCHEDULER_CRON_PATTERN=*/15 * * * *      # Less frequent checks
ASSET_SCHEDULER_MAX_CONCURRENT=1                # Lower concurrency
ASSET_SCHEDULER_TIMEOUT=300000                  # Shorter timeout
```

#### API Rate Limit Sensitive
```bash
ASSET_SCHEDULER_MAX_CONCURRENT=2                # Moderate concurrency
ASSET_SCHEDULER_COOLDOWN=60                     # Longer cooldown
ASSET_DOWNLOAD_DELAY=3000                       # Longer delay between requests
```

### Priority-Based Processing

The system automatically prioritizes:

1. **Failed videos** (+50 priority)
2. **New videos** (<1 day old: +30, <3 days: +20, <7 days: +10)
3. **High view count** (>100K: +25, >50K: +15, >10K: +10)

### Event-Based Integration

Listen to scheduler events in your code:

```javascript
import AssetDownloadScheduler from './src/services/assetDownloadScheduler.js';

const scheduler = new AssetDownloadScheduler();

scheduler.on('videoProcessed', (data) => {
  console.log(`✅ ${data.videoId}: ${data.title}`);
  // Send notification, update dashboard, etc.
});

scheduler.on('videoProcessingFailed', (data) => {
  console.error(`❌ ${data.videoId}: ${data.error}`);
  // Alert admin, log to external service, etc.
});

scheduler.start();
```

---

## API Reference

### Scheduler Methods

```javascript
// Start scheduler
scheduler.start()

// Stop scheduler
scheduler.stop()

// Get status
const status = scheduler.getStatus()

// Manual trigger
await scheduler.triggerManualExecution('Reason')

// Health check
const health = await scheduler.performHealthCheck()

// Clear history
scheduler.clearProcessingHistory()
```

### Status Object Structure

```javascript
{
  scheduler: {
    isRunning: true,
    enabled: true,
    cronPattern: '*/7 * * * *',
    nextRunTime: '2025-10-01T10:14:00.000Z',
    lastRunTime: '2025-10-01T10:07:00.000Z'
  },
  processing: {
    currentlyProcessing: ['video123'],
    processingCount: 1,
    maxConcurrentProcessing: 3
  },
  statistics: {
    totalRuns: 15,
    successfulProcessing: 12,
    failedProcessing: 1,
    videosSkipped: 2
  },
  health: {
    status: 'healthy',
    lastHealthCheck: '2025-10-01T10:10:00.000Z',
    errorCount: 1,
    consecutiveErrors: 0
  }
}
```

---

## Support

### Getting Help

1. **Check logs**: `tail -f logs/app.log`
2. **Run health check**: `npm run asset-scheduler-health`
3. **View statistics**: `npm run asset-scheduler-stats`
4. **Test specific video**: `node tools/download-assets-for-video.js [VIDEO_ID]`

### Reporting Issues

Include in your report:
- Scheduler status output
- Relevant log excerpts
- Video ID (if applicable)
- Configuration settings
- Expected vs actual behavior

---

**Last Updated**: October 1, 2025
**Maintained By**: YouTube Automation Team
**Documentation Version**: 2.0
