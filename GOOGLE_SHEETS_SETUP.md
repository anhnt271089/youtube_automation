# Google Sheets API Setup Guide

## Issue Identified

The Google Sheets API v4 is **NOT ENABLED** in your Google Cloud Console project (ID: 610931361339). This is why Google Sheets files are not being created with content in your YouTube automation system.

## Solution: Enable Google Sheets API

### Step 1: Enable the API

1. **Go to Google Cloud Console APIs & Services**
   - Visit: https://console.cloud.google.com/apis/library
   - Or use direct link: https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=610931361339

2. **Search for Google Sheets API**
   - In the search bar, type "Google Sheets API"
   - Click on "Google Sheets API" from the results

3. **Enable the API**
   - Click the blue "ENABLE" button
   - Wait 1-2 minutes for the API to be activated

### Step 2: Verify the Fix

After enabling the API, run this test command:

```bash
node test-google-sheets.js
```

You should see all tests pass with ✅ marks.

### Step 3: Test Integration

Test your actual system:

```bash
# Start the system
npm start

# Or test a single URL processing
node -e "
import('./src/index.js').then(async (m) => {
  const automation = new m.default();
  await automation.initialize();
  const result = await automation.processUrl('YOUR_YOUTUBE_URL');
  console.log(result);
  await automation.stop();
});"
```

## What This Fixes

Once enabled, your system will:

✅ Create Google Sheets with proper content
✅ Populate script breakdown with sentences  
✅ Add image prompts for each sentence
✅ Track status for each row
✅ Include proper headers and formatting

## Current Status

- ✅ Google Drive API: Working
- ✅ Service Account Authentication: Working  
- ✅ Folder Creation: Working
- ❌ Google Sheets API: **DISABLED** (needs to be enabled)

## Alternative: Manual Google Sheets Creation

If you prefer not to enable the API immediately, the system will continue working but will skip spreadsheet creation. The workflow will log a warning but continue processing videos.

## Need Help?

If you encounter any issues after enabling the API, run the diagnostic test:

```bash
node test-google-sheets.js
```

This will provide detailed debugging information about any remaining issues.