# Asset Scheduler Duplicate Prevention Fix

**Issue:** Verify scheduler doesn't re-process videos with "Completed" status
**Date Fixed:** 2025-10-03
**Status:** ✅ RESOLVED

---

## Problem Statement

The asset download scheduler runs every 7 minutes to process approved scripts. We needed to verify that it:
1. **Does NOT re-process videos with "Completed" status**
2. **Does NOT re-process videos with "Downloading Assets" status**
3. **Only processes eligible videos needing asset downloads**

---

## Analysis Results

### Original Behavior (BEFORE FIX)

The scheduler had **3 layers of protection**, but NO direct Master Sheet status check:

1. ✅ **Script Breakdown Check** - Checks if >20% of sentences have images
2. ✅ **Concurrent Processing Detection** - Detects "Downloading" status in Script Breakdown
3. ✅ **Cooldown Period** - 30-minute cooldown after successful processing

**GAP IDENTIFIED:** The scheduler queried ALL approved videos without filtering by Master Sheet status.

### Risk Assessment

- **Low Risk** of re-processing completed videos (protected by Script Breakdown check)
- **Medium Risk** of status inconsistencies if Script Breakdown is modified/corrupted
- **Medium Risk** of unnecessary processing attempts if edge cases occur

---

## Solution Implemented

### Code Changes

**File:** `src/services/assetDownloadScheduler.js`
**Lines:** 276-292

```javascript
// ADDED: Extract status from Master Sheet
const status = row[this.sheetsService.masterColumns.status];

// ADDED: Skip if already completed or currently downloading
if (status === 'Completed' || status === 'Downloading Assets') {
  logger.debug(`Skipping ${videoId}: Status is "${status}" (already processed or in progress)`);
  this.statisticsData.videosSkipped++;
  continue;
}
```

### What This Fix Does

1. **Extracts status** from Master Sheet Column C for each video
2. **Checks status** before any other processing
3. **Skips videos** with "Completed" or "Downloading Assets" status
4. **Logs skip reason** for monitoring and debugging
5. **Increments metrics** to track skipped videos

---

## Defense-in-Depth Protection (AFTER FIX)

The scheduler now has **4 layers** of duplicate prevention:

### Layer 1: Master Sheet Status Filter (NEW) 🆕
- **When:** First check, before any processing
- **What:** Filters out "Completed" and "Downloading Assets" videos
- **Why:** Prevents re-processing at the source
- **Performance:** O(1) string comparison

### Layer 2: Script Breakdown Check (Existing)
- **When:** After basic filters pass
- **What:** Checks if >20% of sentences have image URLs
- **Why:** Detects completion even if status wasn't updated
- **Performance:** O(n) query to Script Breakdown sheet

### Layer 3: Concurrent Processing Tracker (Existing)
- **When:** During processing
- **What:** In-memory Set of currently processing videos
- **Why:** Prevents duplicate processing within same instance
- **Performance:** O(1) Set lookup

### Layer 4: Cooldown Period (Existing)
- **When:** After processing completes
- **What:** 30-minute cooldown after successful processing
- **Why:** Prevents excessive retries
- **Performance:** O(1) timestamp comparison

---

## Status Flow

### Normal Processing Flow
```
Initial/Pending
    ↓
Script Approved (user action)
    ↓
Downloading Assets (scheduler starts)
    ↓
Completed (processing succeeds)
```

### Failure Flow
```
Initial/Pending
    ↓
Script Approved (user action)
    ↓
Downloading Assets (scheduler starts)
    ↓
Asset Download Failed (processing fails)
    ↓
[30-min cooldown]
    ↓
Retry → Downloading Assets (retry attempt)
```

### What Gets Skipped
- ❌ Status = "Completed" → **Always skipped** (Layer 1)
- ❌ Status = "Downloading Assets" → **Always skipped** (Layer 1)
- ✅ Status = "Asset Download Failed" → **Re-queued after cooldown** (intended retry)
- ✅ Status = "Pending" or empty → **Processed if script approved**

---

## Test Verification

### Test Scenarios

| Scenario | Status | Script Approved | Expected Behavior | Layer |
|----------|--------|----------------|-------------------|-------|
| Completed video | "Completed" | "Approved" | ✅ Skipped | Layer 1 |
| Downloading video | "Downloading Assets" | "Approved" | ✅ Skipped | Layer 1 |
| Failed video (in cooldown) | "Asset Download Failed" | "Approved" | ✅ Skipped | Layer 4 |
| Failed video (cooldown expired) | "Asset Download Failed" | "Approved" | ✅ Re-queued | - |
| New eligible video | "Pending" or empty | "Approved" | ✅ Processed | - |
| Script not approved | Any | "Pending" | ✅ Skipped | Pre-filter |

### Expected Logs

**When completed video is encountered:**
```
[DEBUG] Skipping VID-001: Status is "Completed" (already processed or in progress)
```

**When downloading video is encountered:**
```
[DEBUG] Skipping VID-002: Status is "Downloading Assets" (already processed or in progress)
```

**When eligible video is processed:**
```
[INFO] 🎬 Starting asset download for VID-003 [exec_1234567890]
[INFO] ✅ Master Sheet status updated to "Downloading Assets" for VID-003
[INFO] ✅ Asset processing successful for VID-003
[INFO] ✅ Master Sheet status updated to "Completed" for VID-003
```

---

## Performance Impact

### Overhead Added
- **1 array access:** `row[this.sheetsService.masterColumns.status]`
- **1 string comparison:** `status === 'Completed' || status === 'Downloading Assets'`
- **Estimated time:** < 1ms per video
- **Overall impact:** ✅ NEGLIGIBLE

### Benefits Gained
- ✅ Reduces unnecessary Script Breakdown queries
- ✅ Prevents wasted API calls to Pexels
- ✅ Improves scheduler efficiency
- ✅ Clearer logging and metrics

---

## Monitoring & Metrics

### Key Metrics to Track
```javascript
{
  videosSkipped: 0,           // Total videos skipped (all reasons)
  successfulProcessing: 0,    // Successfully completed
  failedProcessing: 0,        // Failed attempts
  currentlyProcessing: []     // Videos being processed now
}
```

### Monitoring Commands

**View skip events:**
```bash
grep "Skipping.*Status is" logs/combined.log | tail -20
```

**Count skips by reason:**
```bash
grep "Skipping" logs/combined.log | \
  sed -n 's/.*Skipping [^:]*: \(.*\)/\1/p' | \
  sort | uniq -c | sort -rn
```

**Check processing success rate:**
```bash
# Successful
grep "Asset processing successful" logs/combined.log | wc -l

# Failed
grep "Asset processing attempt.*failed" logs/combined.log | wc -l
```

---

## Files Changed

### Implementation
- ✅ `src/services/assetDownloadScheduler.js` (Lines 276-292)

### Documentation
- ✅ `docs/analysis/asset-download-scheduler-status-check.md` (Full analysis)
- ✅ `docs/testing/status-filter-verification.md` (Test plan)
- ✅ `docs/fixes/asset-scheduler-duplicate-prevention-fix.md` (This file)
- ✅ `scripts/test-scheduler-status-filter.js` (Test script)

---

## Related Systems

### Status Update Flow
1. **AssetDownloadOrchestrator** sets status to "Downloading Assets" when processing starts
2. **PexelsService** downloads assets and updates Script Breakdown
3. **AssetDownloadOrchestrator** sets status to "Completed" when all assets succeed
4. **AssetDownloadOrchestrator** sets status to "Asset Download Failed" if processing fails

### Scheduler Query Flow
1. **AssetDownloadScheduler** queries all videos from Master Sheet
2. **Filter by scriptApproved** = "Approved"
3. **Filter by status** ≠ "Completed" and ≠ "Downloading Assets" (NEW)
4. **Check Script Breakdown** for existing assets
5. **Apply cooldown** if recently processed
6. **Queue for processing** if all checks pass

---

## Deployment Checklist

- [x] Code changes implemented
- [x] Analysis documentation created
- [x] Test plan documented
- [x] Test script created
- [x] Expected behavior documented
- [ ] Live testing in production
- [ ] Monitor logs for 24 hours
- [ ] Verify metrics are accurate
- [ ] Mark issue as resolved in Google Sheets

---

## Rollback Plan

If issues occur, revert the status check:

```bash
# Rollback command
git diff HEAD~1 src/services/assetDownloadScheduler.js
git checkout HEAD~1 -- src/services/assetDownloadScheduler.js
```

Or manually remove lines 278 and 287-292 from `assetDownloadScheduler.js`.

---

## Conclusion

✅ **ISSUE RESOLVED:** Scheduler now explicitly skips videos with "Completed" or "Downloading Assets" status

✅ **PROTECTION ENHANCED:** 4-layer defense against duplicate processing

✅ **PERFORMANCE:** Negligible overhead, improved efficiency

✅ **MONITORING:** Clear logs and metrics for verification

### Next Steps
1. Deploy to production
2. Monitor scheduler execution
3. Verify completed videos are never re-processed
4. Check metrics show expected skip counts
5. Close issue in Google Sheets tracker

---

**Fix Status:** ✅ COMPLETE
**Testing Status:** ⏳ PENDING LIVE VERIFICATION
**Documentation Status:** ✅ COMPLETE
