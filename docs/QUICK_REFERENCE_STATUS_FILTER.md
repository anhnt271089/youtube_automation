# Asset Scheduler Status Filter - Quick Reference Card

## 🎯 The Fix (One-Liner)
**Added Master Sheet status check to prevent re-processing videos with "Completed" or "Downloading Assets" status.**

---

## 📍 Where to Look

### Code Change
**File:** `src/services/assetDownloadScheduler.js`
**Lines:** 276-292

```javascript
const status = row[this.sheetsService.masterColumns.status];

if (status === 'Completed' || status === 'Downloading Assets') {
  logger.debug(`Skipping ${videoId}: Status is "${status}"`);
  this.statisticsData.videosSkipped++;
  continue;
}
```

---

## 🛡️ Protection Layers (4 Total)

| Layer | What | When | Speed |
|-------|------|------|-------|
| **1** 🆕 | Master Sheet status filter | First check | O(1) |
| **2** | Script Breakdown (>20% assets) | After basic filters | O(n) |
| **3** | Concurrent processing tracker | During processing | O(1) |
| **4** | Cooldown period (30 min) | After completion | O(1) |

---

## 🚦 Status Decision Table

| Master Sheet Status | Script Approved | What Happens |
|---------------------|-----------------|--------------|
| `Completed` | `Approved` | ✅ **Skip** (Layer 1) |
| `Downloading Assets` | `Approved` | ✅ **Skip** (Layer 1) |
| `Asset Download Failed` | `Approved` | ✅ **Retry** (after 30min) |
| `Pending` or empty | `Approved` | ✅ **Process** |
| Any | `Pending` | ✅ **Skip** (not approved) |

---

## 📊 How to Verify

### Quick Check (1 minute)
```bash
# Find completed videos being skipped
grep "Status is \"Completed\"" logs/combined.log | tail -5
```

### Live Monitor (real-time)
```bash
# Watch skip events as they happen
tail -f logs/combined.log | grep "Skipping.*Status is"
```

### Count Metrics
```bash
# How many completed videos were skipped?
grep "Status is \"Completed\"" logs/combined.log | wc -l

# How many downloading videos were skipped?
grep "Status is \"Downloading Assets\"" logs/combined.log | wc -l
```

---

## 📝 Expected Log Messages

### ✅ Good (Video Skipped)
```
[DEBUG] Skipping VID-001: Status is "Completed" (already processed or in progress)
[DEBUG] Skipping VID-002: Status is "Downloading Assets" (already processed or in progress)
```

### ✅ Good (Video Processed)
```
[INFO] 🎬 Starting asset download for VID-003 [exec_1234567890]
[INFO] ✅ Master Sheet status updated to "Downloading Assets" for VID-003
[INFO] ✅ Asset processing successful for VID-003
[INFO] ✅ Master Sheet status updated to "Completed" for VID-003
```

### ❌ Bad (Should NOT see)
```
[INFO] 🎬 Starting asset download for VID-001 [exec_1234567890]
# ^ If VID-001 status is "Completed", this should NOT happen
```

---

## 🔍 Test Scenarios

### Test 1: Completed Video
1. Find video with status = `Completed` in Google Sheets
2. Wait for scheduler run (every 7 minutes)
3. ✅ Should see: "Skipping VID-XXX: Status is 'Completed'"
4. ✅ Should NOT see: "Starting asset download for VID-XXX"

### Test 2: Downloading Video
1. Find video with status = `Downloading Assets`
2. Wait for scheduler run
3. ✅ Should see: "Skipping VID-XXX: Status is 'Downloading Assets'"

### Test 3: Failed Video
1. Find video with status = `Asset Download Failed`
2. Check if cooldown expired (30 minutes since last attempt)
3. ✅ If expired: Should be re-queued (retry)
4. ✅ If not expired: Should be skipped with cooldown message

---

## 📈 Monitoring Dashboard Commands

### Get Scheduler Status
```bash
curl http://localhost:3000/api/scheduler/status | jq
```

### Count Skip Events by Reason
```bash
grep "Skipping" logs/combined.log | \
  sed -n 's/.*Skipping [^:]*: \(.*\)/\1/p' | \
  sort | uniq -c | sort -rn
```

### Processing Success Rate
```bash
echo "Successful: $(grep 'Asset processing successful' logs/combined.log | wc -l)"
echo "Failed: $(grep 'Asset processing attempt.*failed' logs/combined.log | wc -l)"
```

---

## 📁 Documentation Files

| File | Purpose | When to Use |
|------|---------|-------------|
| `ASSET_SCHEDULER_FIX_SUMMARY.md` | Executive summary | Quick overview |
| `docs/analysis/asset-download-scheduler-status-check.md` | Full analysis | Deep dive into findings |
| `docs/testing/status-filter-verification.md` | Test plan | Running tests |
| `docs/fixes/asset-scheduler-duplicate-prevention-fix.md` | Fix details | Understanding implementation |
| `scripts/test-scheduler-status-filter.js` | Test script | Automated testing |
| `docs/QUICK_REFERENCE_STATUS_FILTER.md` | This file | Quick lookup |

---

## 🚀 Deployment Checklist

- [x] Code implemented
- [x] Committed (b2cef40)
- [x] Documentation complete
- [ ] Deploy to production
- [ ] Monitor for 24 hours
- [ ] Verify metrics
- [ ] Close Google Sheets issue

---

## ⚡ Quick Commands

```bash
# View the fix
git show b2cef40 --stat

# Check if fix is deployed
grep -n "Status is.*Completed\|Downloading Assets" src/services/assetDownloadScheduler.js

# Monitor in real-time
tail -f logs/combined.log | grep -E "Skipping|Starting asset download|status updated"

# Count skips today
grep "$(date +%Y-%m-%d)" logs/combined.log | grep "Status is" | wc -l
```

---

## 🆘 Troubleshooting

### Issue: Completed videos still being processed
**Check:**
1. Is the fix deployed? `git log --oneline | grep "status filter"`
2. What does the log say? `grep "VID-XXX" logs/combined.log`
3. What's the actual status? Check Google Sheets Column C

### Issue: No videos being processed
**Check:**
1. Are there eligible videos? (Script Approved + no "Completed" status)
2. Is scheduler running? `curl localhost:3000/api/scheduler/status`
3. Any errors? `grep ERROR logs/combined.log | tail -20`

---

**Last Updated:** 2025-10-03
**Git Commit:** b2cef40
**Branch:** feature/google-sheets-drive-integration
