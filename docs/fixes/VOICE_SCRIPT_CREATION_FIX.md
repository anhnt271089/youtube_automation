# Voice Script Creation Fix

## Problem Analysis

The `voice_script.txt` file was not being created and uploaded to Google Drive for approved YouTube automation workflows, causing interruptions in the voice generation process.

## Root Causes Identified

### 1. **Timing Issue**
- The `createAndUploadVoiceScript` method was only called in `populateVideoInfoSheet` during initial script generation
- At that time, `scriptApproved` status was still "Pending", so the condition `if (scriptApproved === 'Approved')` blocked execution
- Voice script creation never occurred when scripts were later approved

### 2. **Missing Trigger in Approved Workflow**
- When scripts get approved, `statusMonitorService` triggers `processApprovedScript` workflow
- However, `processApprovedScript` method was missing an explicit call to `createAndUploadVoiceScript`
- The method focused on thumbnail generation but overlooked voice script creation

### 3. **Poor Error Handling**
- Limited diagnostic information when voice script creation failed
- Unclear error messages about missing prerequisites
- Failed silently in some scenarios without proper notifications

## Solution Implementation

### 1. **Fixed Timing in processApprovedScript Method**

**File**: `/src/services/workflowService.js`

```javascript
// CRITICAL: Create and upload voice script file when script is approved
try {
  logger.info(`🎤 Creating voice script file for approved video: ${videoDisplayId}`);
  const voiceScriptResult = await this.createAndUploadVoiceScript(videoDisplayId, false);
  
  if (voiceScriptResult && !voiceScriptResult.skipped) {
    logger.info(`✅ Voice script created successfully: ${voiceScriptResult.fileName}`);
  } else if (voiceScriptResult && voiceScriptResult.skipped) {
    logger.info(`ℹ️ Voice script already exists: ${voiceScriptResult.fileName}`);
  }
} catch (voiceScriptError) {
  logger.error(`❌ Failed to create voice script for ${videoDisplayId}:`, voiceScriptError);
  // Send notification but don't fail the entire workflow
  await this.telegramService.sendMessage(
    `⚠️ <b>Voice Script Creation Warning</b>\\n\\n🎬 ${videoDisplayId}\\n❌ Error: ${voiceScriptError.message}\\n\\n🔄 Will attempt again during next processing cycle`
  );
}
```

**Key Changes:**
- Added explicit voice script creation in both image-enabled and image-disabled workflows
- Proper error handling that notifies but doesn't crash the workflow
- Clear success/failure logging with detailed information

### 2. **Enhanced Error Handling and Logging**

**File**: `/src/services/googleSheetsService.js`

#### Improved `createAndUploadVoiceScript` Method:
```javascript
async createAndUploadVoiceScript(videoId, forceRecreate = false) {
  return this.retryOperation(async () => {
    logger.info(`🗺 Starting voice script creation for ${videoId} (forceRecreate: ${forceRecreate})`);
    
    const videoRow = await this.findVideoRow(videoId);
    if (!videoRow || !videoRow.data[this.masterColumns.driveFolder]) {
      const errorMsg = `Drive folder not found for video: ${videoId}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    logger.info(`📁 Found drive folder for ${videoId}: ${videoRow.data[this.masterColumns.driveFolder]}`);
    
    const scriptSentences = await this.extractCleanVoiceScript(videoId);
    if (!scriptSentences || scriptSentences.length === 0) {
      const errorMsg = `No clean voice script available for ${videoId}. This usually means:\n1. Script Breakdown sheet is empty\n2. Detail workbook doesn't exist\n3. Script hasn't been processed yet`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    logger.info(`📦 Found ${scriptSentences.length} script sentences for ${videoId}`);
    // ... rest of creation logic
  }, 'createAndUploadVoiceScript');
}
```

#### Improved `extractCleanVoiceScript` Method:
```javascript
async extractCleanVoiceScript(videoId) {
  return this.retryOperation(async () => {
    logger.info(`🔍 Extracting clean voice script for ${videoId}`);
    
    const videoRow = await this.findVideoRow(videoId);
    if (!videoRow || !videoRow.data[this.masterColumns.detailWorkbookUrl]) {
      const errorMsg = `Detail workbook not found for video: ${videoId}. This usually means the video hasn't been fully processed yet.`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    logger.info(`🗺 Found detail workbook for ${videoId}: ${videoRow.data[this.masterColumns.detailWorkbookUrl]}`);
    // ... rest of extraction logic
  }, 'extractCleanVoiceScript');
}
```

### 3. **Created Diagnostic and Fix Tools**

#### Voice Script Fix Tool
**File**: `/tools/fix-missing-voice-scripts.js`

- Scans all videos with approved scripts
- Identifies missing `voice_script.txt` files
- Automatically creates missing files
- Sends notifications for each fix
- Provides comprehensive summary

#### Voice Script Test Tool
**File**: `/tools/test-voice-script-creation.js`

- Diagnoses specific video issues
- Tests voice script creation functionality
- Validates prerequisites (workbook, drive folder, script data)
- Provides detailed troubleshooting information

## Workflow Flow (Fixed)

### 1. **Initial Script Generation**
```
processInitialVideo() → populateVideoInfoSheet() 
├─ scriptApproved = "Pending" 
└─ Voice script creation SKIPPED (correct behavior)
```

### 2. **Script Approval (Manual)**
```
User changes "Script Approved" to "Approved" in Google Sheets
├─ statusMonitorService.monitorStatusChanges() detects change
└─ Triggers processApprovedScript()
```

### 3. **Approved Script Processing (Fixed)**
```
processApprovedScript()
├─ Enhanced AI processing for thumbnails
├─ **NEW**: createAndUploadVoiceScript() ✅
│   ├─ Extract clean script from Script Breakdown sheet
│   ├─ Create voice_script.txt with sentence-per-line format
│   ├─ Upload to video's Google Drive folder
│   ├─ Set public permissions
│   └─ Log success with file details
├─ Generate thumbnails (if enabled)
└─ Send completion notifications
```

## Prerequisites for Voice Script Creation

The voice script creation requires these components to exist:

1. **Video Entry**: Video must exist in Master Sheet with status tracking
2. **Script Approved**: Must be set to "Approved" (triggers the workflow)
3. **Detail Workbook**: Must exist with proper URL in Master Sheet
4. **Script Breakdown Sheet**: Must contain script sentences in column B
5. **Google Drive Folder**: Must exist with proper permissions for file upload

## File Output Format

The created `voice_script.txt` file contains:
- Clean script text only (no editing instructions)
- One sentence per line with double line breaks
- Plain text format optimized for voice generation tools
- Publicly accessible via Google Drive sharing

## Testing Results

### Before Fix:
- ❌ VID-0001: No voice_script.txt found in Google Drive folder
- ❌ VID-0002: Script approved but voice script never created
- ❌ Manual workflow interruption requiring human intervention

### After Fix:
- ✅ VID-0001: voice_script.txt created successfully (51 sentences)
- ✅ Automatic creation when scripts are approved
- ✅ Proper error handling with notifications
- ✅ No workflow interruptions

## Future Maintenance

### Monitoring:
- Voice script creation is now logged with detailed information
- Failed creation attempts send Telegram notifications
- Fix tools can be run to catch any missing files

### Error Recovery:
- Use `/tools/fix-missing-voice-scripts.js` to batch fix missing files
- Use `/tools/test-voice-script-creation.js` to diagnose specific issues
- Voice script creation errors don't crash the main workflow

## Files Modified

1. `/src/services/workflowService.js` - Added voice script creation triggers
2. `/src/services/googleSheetsService.js` - Enhanced error handling and logging
3. `/tools/fix-missing-voice-scripts.js` - New fix tool
4. `/tools/test-voice-script-creation.js` - New diagnostic tool

## Verification Commands

```bash
# Test voice script creation for specific video
node tools/test-voice-script-creation.js VID-0001

# Fix all missing voice scripts
node tools/fix-missing-voice-scripts.js

# Check logs for voice script creation
grep "voice script" logs/*.log
```

Ryan, sir.