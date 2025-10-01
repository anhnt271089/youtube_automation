# Quick Start: Asset Download Scheduler

**Goal**: Get asset download automation running in 5 minutes

---

## Prerequisites

✅ Node.js 18+ installed
✅ Environment configured (.env file)
✅ Google Sheets API access
✅ Pexels API key
✅ System already set up and running

---

## Step 1: Verify Configuration

Check your `.env` file has:

```bash
# Required for asset downloads
PEXELS_API_KEY=your_pexels_api_key
GOOGLE_MASTER_SHEET_ID=your_sheet_id
GOOGLE_VIDEOS_ROOT_FOLDER_ID=your_folder_id

# Optional scheduler config (has defaults)
ASSET_SCHEDULER_ENABLED=true              # Default: true
ASSET_SCHEDULER_CRON_PATTERN=*/7 * * * *  # Default: every 7 min
```

---

## Step 2: Start the System

### Option A: Normal Start (Scheduler Auto-Starts)

```bash
npm start
```

**Look for**:
```
🤖 Initializing Asset Download Scheduler...
✅ Asset Download Scheduler started successfully
```

### Option B: Production (PM2)

```bash
npm run pm2:start
```

---

## Step 3: Verify It's Working

### Check Status
```bash
npm run asset-scheduler-status
```

**Expected Output**:
```
📊 Asset Download Scheduler Status

🤖 Scheduler Information:
   Status: 🟢 Running
   Enabled: ✅ Yes
   Cron Pattern: */7 * * * *
   Next Run: [timestamp]
```

### View Logs
```bash
tail -f logs/app.log | grep "Asset"
```

---

## Step 4: Test It

1. **Open Google Sheets** (Master Sheet)
2. **Find a video** with a generated script
3. **Change "Script Status"** to "Approved"
4. **Wait up to 7 minutes** (or trigger manually)
5. **Watch for asset downloads** in logs

### Manual Trigger (Don't Wait)
```bash
npm run asset-scheduler-trigger
```

---

## Step 5: Monitor Progress

### Real-Time Monitoring
```bash
npm run asset-scheduler-monitor
```

### Check Statistics
```bash
npm run asset-scheduler-stats
```

### View Specific Video
```bash
node tools/check-asset-status.js
```

---

## Common Commands

| Command | Description |
|---------|-------------|
| `npm run asset-scheduler-status` | Check if scheduler is running |
| `npm run asset-scheduler-trigger` | Force immediate execution |
| `npm run asset-scheduler-stats` | View processing statistics |
| `npm run asset-scheduler-health` | Health check |
| `npm run asset-scheduler-monitor` | Live monitoring |
| `npm run stop-asset-scheduler` | Stop scheduler |

---

## Troubleshooting

### Scheduler Not Running?

```bash
# Check config
grep ASSET_SCHEDULER_ENABLED .env

# Start manually
npm run start-asset-scheduler
```

### Assets Not Downloading?

```bash
# Check health
npm run asset-scheduler-health

# Check for pending videos
node tools/check-asset-status.js

# Manual download for specific video
node tools/download-assets-for-video.js [VIDEO_ID]
```

### Too Many Errors?

```bash
# Reduce load
echo "ASSET_SCHEDULER_MAX_CONCURRENT=1" >> .env
echo "ASSET_SCHEDULER_CRON_PATTERN=*/15 * * * *" >> .env

# Restart
npm run pm2:restart
```

---

## What Happens Automatically?

1. **Every 7 minutes**: Scheduler scans Master Sheet
2. **Finds approved scripts**: Videos with `scriptApproved = "Approved"`
3. **Validates prerequisites**: Checks script breakdown exists
4. **Downloads assets**: Gets images from Pexels
5. **Uploads to Drive**: Stores with shareable links
6. **Updates Sheet**: Marks as complete

---

## Next Steps

✅ **Let it run**: Scheduler handles everything automatically
✅ **Monitor logs**: Keep an eye on performance
✅ **Adjust config**: Tune settings based on load
✅ **Use PM2**: For production stability

---

## Need Help?

📖 **Full Documentation**: See `docs/ASSET_AUTOMATION_GUIDE.md`
🔍 **Analysis Report**: See `docs/ASSET_DOWNLOAD_AUTOMATION_ANALYSIS.md`
💬 **Support**: Check logs and run health checks first

---

**You're Done!** 🎉

The asset download automation is now running. Just change script status to "Approved" and assets will download automatically.
