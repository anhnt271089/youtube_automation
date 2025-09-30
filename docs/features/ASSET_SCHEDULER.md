# Asset Download Scheduler - Reliable Cron-Based Asset Processing

## Overview

The Asset Download Scheduler is a production-ready cron job system that ensures all approved scripts receive their assets automatically, providing a robust backup to the event-driven asset download system.

## Quick Start

### 1. Start the Scheduler
```bash
npm run start-asset-scheduler -- --daemon
```

### 2. Monitor Status
```bash
npm run asset-scheduler-status
npm run asset-scheduler-stats
```

### 3. Health Check
```bash
npm run asset-scheduler-health
```

## Key Features

- ✅ **Automated Detection**: Finds videos with approved scripts needing assets
- ✅ **Smart Processing**: Prevents duplicate downloads and handles cooldowns
- ✅ **Concurrent Handling**: Processes multiple videos simultaneously
- ✅ **Comprehensive Monitoring**: Real-time status and performance metrics
- ✅ **Error Recovery**: Intelligent retry logic and failure handling
- ✅ **Telegram Alerts**: Critical notifications and status updates

## Configuration

Default settings run every 7 minutes with 3 concurrent video processing. Customize via `.env`:

```env
ASSET_SCHEDULER_ENABLED=true
ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *
ASSET_SCHEDULER_MAX_CONCURRENT=3
ASSET_SCHEDULER_COOLDOWN=30
```

## System Integration

The scheduler integrates seamlessly with existing systems:

```
Approved Script → Event-Driven Download (Primary)
                ↓ (if failed)
              Cron Scheduler Detection → Reliable Download (Backup)
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `npm run start-asset-scheduler` | Start scheduler |
| `npm run stop-asset-scheduler` | Stop scheduler |
| `npm run asset-scheduler-status` | Check status |
| `npm run asset-scheduler-trigger` | Manual trigger |
| `npm run asset-scheduler-health` | Health check |
| `npm run asset-scheduler-stats` | View statistics |
| `npm run asset-scheduler-monitor` | Live monitoring |
| `npm run test-asset-scheduler` | Run tests |

## Files Created

- `src/services/assetDownloadScheduler.js` - Main scheduler service
- `src/services/schedulerMonitoringService.js` - Monitoring and alerting
- `tools/start-asset-scheduler.js` - Management CLI tool
- `tools/test-asset-scheduler-integration.js` - Integration tests
- `docs/ASSET_SCHEDULER_GUIDE.md` - Complete documentation

## Benefits

1. **Reliability**: Never miss asset downloads for approved scripts
2. **Monitoring**: Full visibility into processing operations
3. **Recovery**: Automatic error handling and retry mechanisms
4. **Scalability**: Handles increasing content volumes efficiently
5. **Integration**: Works alongside existing systems seamlessly

For detailed documentation, see [ASSET_SCHEDULER_GUIDE.md](../ASSET_SCHEDULER_GUIDE.md).

Ryan, sir.