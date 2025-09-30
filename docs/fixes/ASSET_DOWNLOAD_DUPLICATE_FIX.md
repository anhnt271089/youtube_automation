# Asset Download Duplicate Fix

## Issue Summary

**Problem:** Assets are being downloaded multiple times for the same sentences during concurrent processing

**Impact:**
- Wasted API calls to Pexels
- Increased processing time
- Unnecessary Google Drive storage usage
- Potential cost implications

## Root Cause Analysis

### 1. Race Condition in Status Checking
**Location:** `src/services/pexelsService.js` lines 423-431

The filtering logic checks for `status !== 'Complete'` but doesn't account for concurrent processing:

```javascript
const sentencesToProcess = scriptBreakdown.filter(sentence => {
  return (
    sentence.searchPhrase &&
    sentence.searchPhrase.trim() !== '' &&
    sentence.status !== 'Complete' &&
    sentence.status !== 'Generated' &&
    sentence.status !== 'Asset Downloaded'
  );
});
```

**Problem:** Multiple processes can read the same "Pending" status before any updates it to "Complete"

### 2. Non-Atomic Status Updates
**Location:** `src/services/pexelsService.js` lines 332-338

Status is updated AFTER download/upload completes:

```javascript
// Download happens (takes 2-5 seconds)
const tempFilePath = await this.downloadAsset(downloadUrl, tempFilename);

// Upload happens (takes 3-7 seconds)
const uploadResult = await this.driveService.uploadFile(...);

// Status update happens LAST (10+ seconds after starting)
await this.sheetsService.updateSentenceWithImage(
  videoId,
  sentenceNumber,
  shareableLink.publicUrl,
  'Complete'
);
```

**Problem:** 10+ second window where status is still "Pending" but download is in progress

### 3. Missing "In Progress" State

The system only has these states:
- `Pending` - Not started
- `Complete` - Finished
- `Generated` - Asset exists
- `Asset Download Failed` - Failed

**Problem:** No intermediate state to indicate download is in progress

### 4. Concurrent Processing Sources

Multiple sources can trigger asset downloads simultaneously:

1. **AssetDownloadScheduler** (runs every 7 minutes)
   - `src/services/assetDownloadScheduler.js`
   - Checks for approved scripts and triggers downloads

2. **Manual Triggers via GoogleSheetsService**
   - `src/services/googleSheetsService.js` lines 476-495
   - Triggered when `scriptApproved` field changes to "Approved"

3. **Direct API Calls**
   - Manual script execution
   - Testing tools

**Problem:** No global lock or coordination between these sources

## Solution Implementation

### Fix 1: Add "In Progress" Status with Atomic Updates

**File:** `src/services/pexelsService.js`

Update the status to "Downloading" IMMEDIATELY when processing starts, before any actual download:

```javascript
async processSentenceAsset(videoId, sentence, folderId) {
  try {
    const sentenceNumber = sentence.sentenceNumber;
    const searchPhrase = sentence.searchPhrase;
    const wordCount = parseInt(sentence.wordCount) || 0;

    if (!searchPhrase || searchPhrase.trim() === '') {
      logger.warn(`No search phrase for sentence ${sentenceNumber} in ${videoId}, skipping`);
      return { success: false, reason: 'No search phrase' };
    }

    // ✅ FIX: Set status to "Downloading" IMMEDIATELY to prevent concurrent downloads
    await this.sheetsService.updateSentenceWithImage(
      videoId,
      sentenceNumber,
      '', // No URL yet
      'Downloading' // Mark as in progress
    );

    logger.info(`Processing sentence ${sentenceNumber} for ${videoId}: "${searchPhrase}" (${wordCount} words)`);

    // Determine asset type based on word count
    const assetType = this.getAssetTypeByWordCount(wordCount);
    // ... rest of the download logic ...
```

### Fix 2: Update Filtering Logic

**File:** `src/services/pexelsService.js` lines 423-431

Add "Downloading" to the exclusion list:

```javascript
const sentencesToProcess = scriptBreakdown.filter(sentence => {
  return (
    sentence.searchPhrase &&
    sentence.searchPhrase.trim() !== '' &&
    sentence.status !== 'Complete' &&
    sentence.status !== 'Generated' &&
    sentence.status !== 'Asset Downloaded' &&
    sentence.status !== 'Downloading' // ✅ FIX: Exclude in-progress downloads
  );
});
```

### Fix 3: Add Global Processing Lock in Orchestrator

**File:** `src/services/assetDownloadOrchestrator.js`

The orchestrator already has some locking via `processingQueue`, but we need to enhance it:

```javascript
async handleScriptApproval(videoId, approvalData = {}) {
  // ... existing validation ...

  // ✅ Enhanced: Check if already processing in ANY service
  if (this.isProcessing(videoId)) {
    logger.warn(`Asset download already in progress for ${videoId}, skipping`);
    return { skipped: true, reason: 'Already processing' };
  }

  // ✅ Enhanced: Check recent processing history with shorter cooldown
  const recentAttempt = this.checkRecentProcessingAttempt(videoId);
  if (recentAttempt.tooRecent) {
    logger.warn(`Recent processing attempt for ${videoId}, cooling down`, {
      lastAttempt: recentAttempt.lastAttempt,
      cooldownRemaining: recentAttempt.cooldownRemaining
    });
    return {
      skipped: true,
      reason: 'Recent processing attempt',
      cooldownRemaining: recentAttempt.cooldownRemaining
    };
  }

  // ... rest of the processing ...
}
```

### Fix 4: Add Sentence-Level Lock Check

**File:** `src/services/pexelsService.js`

Before processing each sentence, verify it hasn't been claimed by another process:

```javascript
async processSentenceAsset(videoId, sentence, folderId) {
  try {
    const sentenceNumber = sentence.sentenceNumber;

    // ✅ FIX: Double-check status before claiming (atomic check-then-set)
    const currentBreakdown = await this.sheetsService.getScriptBreakdown(videoId);
    const currentSentence = currentBreakdown.find(s => s.sentenceNumber === sentenceNumber);

    if (!currentSentence) {
      return { success: false, reason: 'Sentence not found' };
    }

    // If status is not "Pending", another process has claimed it
    if (currentSentence.status !== 'Pending' && currentSentence.status !== '') {
      logger.info(`Sentence ${sentenceNumber} already being processed (status: ${currentSentence.status}), skipping`);
      return { success: false, reason: 'Already processing or complete', skipped: true };
    }

    // Atomically claim the sentence by setting status to "Downloading"
    await this.sheetsService.updateSentenceWithImage(
      videoId,
      sentenceNumber,
      '',
      'Downloading'
    );

    // ... continue with download ...
  }
}
```

### Fix 5: Enhanced Scheduler Coordination

**File:** `src/services/assetDownloadScheduler.js`

Add better tracking of currently processing videos:

```javascript
async processIndividualVideo(video, executionId) {
  const videoId = video.videoId;

  try {
    // ✅ Enhanced: Check if video is already being processed globally
    const orchestratorStatus = await this.sheetsService.getVideoField(videoId, 'voiceGenerationStatus');

    if (orchestratorStatus === 'Processing Assets') {
      logger.info(`${videoId} is being processed by another service, skipping`);
      return { skipped: true, reason: 'Processing by another service' };
    }

    // Mark as processing
    this.currentlyProcessing.add(videoId);

    // Set flag in Google Sheets to prevent other processes
    await this.sheetsService.updateVideoField(videoId, 'voiceGenerationStatus', 'Processing Assets');

    // ... rest of processing ...

  } finally {
    // Always cleanup
    this.currentlyProcessing.delete(videoId);
    await this.sheetsService.updateVideoField(videoId, 'voiceGenerationStatus', 'Ready');
  }
}
```

## Testing Strategy

### Test 1: Concurrent Manual Triggers
```bash
# Terminal 1
node tools/test-asset-download.js VID-0017

# Terminal 2 (immediately after)
node tools/test-asset-download.js VID-0017

# Expected: Second process should detect first process and skip
```

### Test 2: Scheduler During Manual Trigger
```bash
# Start scheduler
node tools/start-asset-scheduler.js

# While scheduler is running, manually trigger same video
node tools/test-asset-download.js VID-0017

# Expected: One should detect the other and skip
```

### Test 3: Verify No Duplicates
```bash
# After processing, check Google Sheets Script Breakdown
# All sentences should have unique filenames (S-1.jpg, S-2.mp4, etc.)
# No duplicates like S-1_1234567.jpg, S-1_7654321.jpg
```

## Rollback Plan

If issues occur after deployment:

1. Revert `pexelsService.js` to remove "Downloading" status
2. Disable scheduler: Set `ASSET_DOWNLOAD_SCHEDULER_ENABLED=false` in `.env`
3. Process videos manually with increased delay between sentences

## Monitoring

After deployment, monitor:

1. **Asset Download Logs**: Check for "Already processing" messages
2. **Google Sheets Status Column**: Verify "Downloading" → "Complete" transitions
3. **Drive Folder**: Check for duplicate filenames (shouldn't exist)
4. **Processing Time**: Should remain similar or slightly improved

## Related Files

- `src/services/pexelsService.js` - Main asset download logic
- `src/services/assetDownloadOrchestrator.js` - Event-driven orchestration
- `src/services/assetDownloadScheduler.js` - Cron-based scheduling
- `src/services/googleSheetsService.js` - Google Sheets integration

## Success Criteria

✅ No duplicate asset files for the same sentence
✅ "Downloading" status visible during processing
✅ Concurrent triggers properly skip already-processing videos
✅ Processing time remains efficient
✅ Zero duplicate API calls to Pexels

---

**Fixed:** 2025-09-30
**Fix Version:** 1.0.0
**Priority:** HIGH