# Asset Download Status Report

## Executive Summary

**Date:** October 3, 2025
**Status:** CRITICAL ISSUE IDENTIFIED
**Videos Affected:** 4 videos stuck in "Downloading Assets" status

## Current Situation

### Videos with "Downloading Assets" Status

| Video ID | Title | Progress | Failed Assets |
|----------|-------|----------|---------------|
| VID-0023 | Stop being controlled by your brain under 90 seconds | 39/57 (68%) | 18 assets |
| VID-0029 | How to actually unfu** your Attention Span | 40/57 (70%) | 17 assets |
| VID-0033 | How to stop giving a SH*T about everything | 48/55 (87%) | 7 assets |
| VID-0034 | This is why you still don't know your purpose | 43/59 (73%) | 16 assets |

**Total:** 4 videos with 58 failed assets needing retry

## Root Cause Analysis

### Issue #1: Asset Download Failed Status Not Retriable

**Problem:**
- Assets marked as "Asset Download Failed" cannot be retried automatically
- PexelsService only processes sentences with status: "Pending", "", or null
- Failed assets remain stuck indefinitely

**Impact:**
- 58 assets across 4 videos cannot be downloaded
- Videos cannot progress to "Completed" status
- Manual intervention required for each failed asset

### Issue #2: Google Sheets Row Calculation Error

**Critical Bug in `updateSentenceStatus` method:**

```javascript
// Line 1119 in googleSheetsService.js
const rowIndex = sentenceNumber + 1; // WRONG!
```

**Problem:**
- Method assumes `sentenceNumber` directly maps to sheet row
- ERROR: "Range ('Script Breakdown'!G211) exceeds grid limits. Max rows: 200"
- Attempting to write to row 211 when sheet only has 200 rows
- Sentence numbers are not sequential row numbers - they're identifiers

**Root Cause:**
- The `sentenceNumber` stored in the sheet is NOT the same as the row position
- `getScriptBreakdown` reads `sentenceNumber` from column A, which may not match row index
- `updateSentenceStatus` incorrectly uses this number as a row offset

### Issue #3: PexelsService Duplicate Detection

**Problem:**
- PexelsService skips sentences with "Asset Download Failed" status
- Logs: "Sentence X already being processed (status: Asset Download Failed), skipping duplicate"
- No retry mechanism exists for failed downloads

## Tools Created

### 1. Diagnostic Tool: `find-stuck-downloads.js`

✅ **Status:** Working correctly
**Purpose:** Identify videos stuck in "Downloading Assets" status
**Output:** Detailed progress report with recommendations

**Key Features:**
- Detects various stuck states (0%, partial, retry needed, etc.)
- Counts assets by status (Complete, Pending, Failed)
- Provides actionable recommendations

### 2. Completion Tool: `complete-stuck-downloads.js`

❌ **Status:** Has limitations
**Issues:**
- Cannot reset "Asset Download Failed" to "Pending" (updateSentenceStatus bug)
- PexelsService skips failed assets
- Row calculation error prevents status updates

### 3. Retry Tool: `retry-failed-assets.js`

❌ **Status:** Blocked by row calculation bug
**Issues:**
- Attempts to reset failed assets to "Pending"
- Fails due to Google Sheets row index error
- Cannot proceed with retry logic

## Attempted Solutions

### Attempt 1: Direct Status Reset
**Action:** Reset "Asset Download Failed" → "Pending" in completion tool
**Result:** ❌ Failed - row calculation error

### Attempt 2: Dedicated Retry Tool
**Action:** Created `retry-failed-assets.js` to reset and retry
**Result:** ❌ Failed - same row calculation error

### Attempt 3: Use updateSentenceStatus
**Action:** Call `sheetsService.updateSentenceStatus()` to change status
**Result:** ❌ Failed - method has critical bug (row 211 > 200 max rows)

## Recommended Solutions

### SHORT-TERM FIX (MANUAL)

**Option A: Manual Status Update via Google Sheets UI**
1. Open each video's Detail Workbook
2. Go to "Script Breakdown" sheet
3. Find rows with status "Asset Download Failed"
4. Manually change to "Pending"
5. Re-run asset download

**Option B: Direct Sheets API Update**
```javascript
// Bypass updateSentenceStatus - update by actual row position
// Find row in getScriptBreakdown response
// Update using actual row index from values array
```

### LONG-TERM FIX (CODE CHANGES)

#### Fix 1: Correct updateSentenceStatus Row Calculation

**File:** `src/services/googleSheetsService.js`
**Line:** 1119

**Current (WRONG):**
```javascript
const rowIndex = sentenceNumber + 1; // Assumes sentenceNumber = row position
```

**Proposed Fix:**
```javascript
// Get actual script breakdown data
const breakdown = await this.getScriptBreakdown(videoId);

// Find the sentence in the breakdown
const sentenceIndex = breakdown.findIndex(s =>
  s.sentenceNumber == sentenceNumber
);

if (sentenceIndex === -1) {
  throw new Error(`Sentence ${sentenceNumber} not found in breakdown`);
}

// Row index is: header (1) + array index (0-based) + 1 = index + 2
const rowIndex = sentenceIndex + 2;
```

#### Fix 2: Add Retry Logic to PexelsService

**File:** `src/services/pexelsService.js`
**Line:** 277-279

**Current:**
```javascript
const validPendingStatuses = ['Pending', '', null];
if (!validPendingStatuses.includes(currentSentence.status)) {
  logger.info(`Sentence ${sentenceNumber} already being processed...`);
  return { success: false, reason: 'Already processing or complete' };
}
```

**Proposed Fix:**
```javascript
const validPendingStatuses = ['Pending', '', null, 'Asset Download Failed'];
const skipStatuses = ['Complete', 'Generated']; // Actually complete

if (skipStatuses.includes(currentSentence.status)) {
  return { success: false, reason: 'Already complete' };
}

if (!validPendingStatuses.includes(currentSentence.status)) {
  logger.info(`Sentence ${sentenceNumber} already being processed...`);
  return { success: false, reason: 'Already processing' };
}
```

#### Fix 3: Add Automatic Retry on Failure

**Enhance AssetDownloadOrchestrator:**
- After download attempt, check for "Asset Download Failed" status
- Automatically retry failed assets up to maxRetries
- Only mark as "Asset Download Failed" after all retries exhausted

## Immediate Action Required

### Priority 1: Fix updateSentenceStatus Bug
**Impact:** HIGH - Blocks all status updates for failed assets
**Effort:** MEDIUM - Need to rewrite row calculation logic
**Risk:** LOW - Well-defined fix

### Priority 2: Enable Retry for Failed Assets
**Impact:** HIGH - Unlocks 58 stuck assets
**Effort:** LOW - One-line change to validPendingStatuses
**Risk:** LOW - Simple array addition

### Priority 3: Manual Workaround for Current Videos
**Impact:** MEDIUM - Unblocks 4 videos
**Effort:** LOW - Manual Google Sheets editing
**Risk:** NONE - Read-only manual fix

## Next Steps

1. ✅ **COMPLETED:** Diagnostic tools created and tested
2. ❌ **BLOCKED:** Automatic retry blocked by row calculation bug
3. ⏳ **PENDING:** Manual workaround via Google Sheets UI
4. ⏳ **PENDING:** Code fixes for long-term solution

## Files Created

### Diagnostic & Repair Tools
- `/tools/find-stuck-downloads.js` ✅ Working
- `/tools/complete-stuck-downloads.js` ⚠️ Limited functionality
- `/tools/retry-failed-assets.js` ❌ Blocked by bug
- `/tools/debug-asset-status.js` ✅ Debug helper

### Documentation
- `/ASSET_DOWNLOAD_STATUS_REPORT.md` ✅ This file

## Conclusion

**Current State:** 4 videos stuck with 58 failed assets

**Blocker:** Critical bug in `updateSentenceStatus` prevents status updates

**Workaround:** Manual Google Sheets editing required

**Permanent Fix:** Code changes to googleSheetsService.js and pexelsService.js

**Timeline:**
- **Immediate:** Manual fix (30 minutes)
- **Short-term:** Code fix and deploy (2-4 hours)
- **Long-term:** Add retry automation (1 day)

---

**Generated:** October 3, 2025
**Author:** Claude Code (Senior Node.js Developer Agent)
**Status:** Awaiting code fix approval
