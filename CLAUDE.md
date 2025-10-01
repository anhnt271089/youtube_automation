# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Important
- Always use use a specialized subagent to do every single task
- Task need pass QA. QC before mark done
- Update all related document if needed when requirement change 
- When finish task, find issue from Google Sheets Issue List and fix them then change status of that issue in the Google Sheets

## 🔄 Migration Status: Google Sheets + Google Drive Integration

**COMPLETED**: Full migration from Notion + Digital Ocean to Google Sheets + Google Drive

**Key Changes:**
- ✅ **Database Layer**: Migrated from Notion databases to Google Sheets with hierarchical structure
- ✅ **File Storage**: Migrated from Digital Ocean Spaces to Google Drive with shareable links
- ✅ **Service Integration**: Replaced NotionService with GoogleSheetsService
- ✅ **Authentication**: Google Service Account with Sheets + Drive API access
- ✅ **Data Structure**: Master Sheet → Video Info Sheet → Script Details Sheet hierarchy
- ✅ **Asset Management**: Images stored in Google Drive with automatic sharing and URL generation

**Benefits:**
- **Cost Reduction**: Eliminated Digital Ocean storage costs
- **Simplified Setup**: Single Google account for both database and storage
- **Better Integration**: Native Google ecosystem with consistent permissions
- **Enhanced Collaboration**: Direct Google Sheets access for manual workflow management
- **Improved Reliability**: Google's infrastructure and API stability

## 🎬 Script Generation Enhancement (Latest Update)

**MAJOR UPGRADE**: YouTube script generation methodology enhanced with advanced copywriting psychology and viral optimization techniques.

**Key Improvements:**
- ✅ **Advanced Hook Architecture**: Multi-layered pattern interrupts, nested curiosity gaps, authority challenges, identity disruption
- ✅ **Hero's Journey Integration**: Complete narrative structure with retention checkpoints every 15 seconds
- ✅ **Psychological Depth**: Pre-suasion priming, embedded commands, emotional progression mapping
- ✅ **Algorithm Optimization**: Multi-point retention engineering, advanced comment bait, share psychology
- ✅ **Language Pattern Mastery**: Power word hierarchies, embedded commands, cognitive load management
- ✅ **Viral Multiplication**: Social currency integration, quotable moments, strategic controversy

**Performance Targets:**
- 95%+ retention at 15 seconds (up from 90%)
- 15%+ click-through rate potential (up from 12%)
- 3%+ comment rate in first hour (up from 2%)
- 8%+ share probability through social currency
- >75% average watch time for algorithm preference
- >2% subscriber conversion rate optimization


## 📥 Asset Download Automation (Latest Update - October 2025)

**STATUS**: ✅ FULLY AUTOMATED - Auto-starts with main application

**Key Features:**
- ✅ **Auto-Start**: Asset scheduler automatically starts with main application
- ✅ **Dual-Layer System**: Cron scheduler (every 7 min) + event-driven orchestrator
- ✅ **Smart Queue**: Priority-based processing with duplicate prevention
- ✅ **Atomic Updates**: Status updates prevent concurrent processing
- ✅ **PM2 Ready**: Production-ready with process management
- ✅ **Comprehensive Monitoring**: Event-based logging and health checks

**How It Works:**
1. User changes Script Status to "Approved" in Google Sheets
2. System automatically triggers asset download (within 7 minutes)
3. Downloads images from Pexels based on script breakdown
4. Uploads to Google Drive with shareable links
5. Updates Google Sheets with completion status

**Configuration** (in `.env`):
```bash
ASSET_SCHEDULER_ENABLED=true              # Auto-start enabled (default)
ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *  # Every 7 minutes (default)
ASSET_SCHEDULER_MAX_CONCURRENT=3          # Max 3 videos at once (default)
ASSET_SCHEDULER_COOLDOWN=30               # 30 min cooldown (default)
```

**Management Commands:**
- `npm start` - Scheduler auto-starts with main app
- `npm run asset-scheduler-status` - Check scheduler status
- `npm run asset-scheduler-trigger` - Force immediate execution
- `npm run asset-scheduler-stats` - View statistics
- `npm run pm2:start` - Production mode with PM2

**Documentation:**
- 📖 Full Guide: `docs/ASSET_AUTOMATION_GUIDE.md`
- 🔍 Analysis: `docs/ASSET_DOWNLOAD_AUTOMATION_ANALYSIS.md`
- 🚀 Quick Start: `docs/QUICK_START_ASSET_SCHEDULER.md`

**Integration Points:**
- `/src/index.js` - Auto-start initialization
- `/src/services/assetDownloadScheduler.js` - Cron scheduler
- `/src/services/assetDownloadOrchestrator.js` - Event-driven processing
- `/src/services/googleSheetsService.js` - Trigger points
- `/ecosystem.config.cjs` - PM2 configuration

## Project Overview

This is a comprehensive YouTube content automation system built with Node.js that transforms YouTube videos into optimized short-form content using AI. The system orchestrates a complete workflow from URL processing to final video delivery through Google Sheets, Google Drive, and Telegram integrations.
