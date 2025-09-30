# Asset Download Concurrent Processing Fix

## Issue Summary
**Date Identified**: 2025-09-29
**Affected Component**: Asset Download System (PexelsService)
**Severity**: Critical - System Crash

## Root Cause Analysis

### The Problem
The asset download system was crashing when processing multiple videos concurrently, specifically failing when multiple videos tried to download assets for sentences with the same number.

### Technical Details
1. **Race Condition**: When processing videos concurrently (up to 3 at a time), multiple videos could process the same sentence number simultaneously
2. **File Collision**: All videos used the same temporary filename format: `S-{sentenceNumber}.mp4`
3. **Critical Failure**: When VID-0017 and VID-0006 both processed sentence 5, they attempted to use `/tmp/pexels-assets/S-5.mp4` simultaneously
4. **System Crash**: File access conflict resulted in `ENOENT: no such file or directory` error, causing an uncaught exception

### Impact
- VID-0017: Only 5 of 63 sentences processed before crash
- Other videos: Similar incomplete processing
- System: Complete scheduler failure requiring manual restart
- Recovery: Blocked by cooldown periods (15-30 minutes)

## Solution Implemented

### 1. Unique Temporary Filenames
**File**: `/src/services/pexelsService.js`
**Change**: Modified temporary filename generation to include video ID and timestamp
```javascript
// Before: const filename = `S-${sentenceNumber}${fileExtension}`;
// After:
const timestamp = Date.now();
const filename = `${videoId}_S-${sentenceNumber}_${timestamp}${fileExtension}`;
```

### 2. Clean Upload Filenames
**Purpose**: Maintain clean, consistent filenames in Google Drive
```javascript
const tempFilename = filename;  // Unique for temp storage
const uploadFilename = `S-${sentenceNumber}${fileExtension}`;  // Clean for Drive
```

### 3. Enhanced Error Handling
**File**: `/tools/start-asset-scheduler.js`
**Changes**:
- Added graceful shutdown on uncaught exceptions
- Improved cleanup before process exit
- Better error recovery mechanisms

### 4. File Operation Safety
**Improvements**:
- Added try-catch blocks around file write operations
- Automatic cleanup of partial files on failure
- Better error messages for debugging

## Testing Recommendations

### Manual Testing
1. Start the scheduler with multiple videos pending:
   ```bash
   node tools/start-asset-scheduler.js start -d -v
   ```

2. Monitor concurrent processing:
   ```bash
   node tools/start-asset-scheduler.js monitor
   ```

3. Check for file collisions:
   ```bash
   ls -la /tmp/pexels-assets/
   ```

### Automated Testing
- Set `maxConcurrentProcessing: 5` temporarily to stress test
- Process videos with identical sentence counts
- Monitor for ENOENT errors in logs

## Prevention Measures

### Short Term
- Unique temporary filenames prevent immediate collisions
- Better error handling prevents complete system crashes
- Graceful shutdown preserves system state

### Long Term Recommendations
1. Implement proper file locking mechanism
2. Use separate temp directories per video
3. Add transaction-like processing with rollback capability
4. Implement distributed locking for multi-instance deployments

## Monitoring

### Key Metrics to Track
- Concurrent processing count
- File operation errors
- Uncaught exceptions
- Processing completion rates

### Log Patterns to Watch
```bash
# Check for file errors
grep -E "ENOENT|EACCES|EMFILE" scheduler.log

# Monitor concurrent processing
grep "Currently processing:" scheduler.log

# Track completion rates
grep "Completed Pexels asset processing" scheduler.log
```

## Recovery Instructions

### If System Crashes Again
1. Check the error in scheduler.log:
   ```bash
   tail -100 scheduler.log | grep -E "Exception|Error"
   ```

2. Clear processing history if needed:
   ```bash
   node tools/start-asset-scheduler.js clear-history
   ```

3. Manually trigger processing for stuck videos:
   ```bash
   node tools/start-asset-scheduler.js trigger -r "Manual recovery"
   ```

4. Monitor recovery:
   ```bash
   node tools/start-asset-scheduler.js monitor -i 10
   ```

## Files Modified
1. `/src/services/pexelsService.js` - Lines 254-295, 328-333, 153-170
2. `/tools/start-asset-scheduler.js` - Lines 542-574

## Verification
After applying these fixes, the system should:
- Process multiple videos concurrently without file conflicts
- Handle errors gracefully without crashing
- Maintain clean, organized filenames in Google Drive
- Provide clear error messages for debugging

---

**Fix Applied By**: Senior Node.js Developer
**Review Status**: Ready for Testing
**Deployment**: Can be deployed immediately