# Tools Usage Guide

This guide covers the diagnostic and fix tools for managing script breakdowns in the YouTube automation system.

---

## 🔍 Diagnostic Tool

### `tools/diagnose-missing-breakdowns.js`

**Purpose:** Identify videos with missing or incomplete script breakdowns

### Usage

**Check Specific Video:**
```bash
node tools/diagnose-missing-breakdowns.js VID-0023
```

**Scan All Videos:**
```bash
node tools/diagnose-missing-breakdowns.js
```

### Output

The tool performs three checks:
1. ✅ **Metadata File** - Checks if video metadata exists
2. ✅ **Script Content** - Verifies script in Video Info sheet
3. ✅ **Breakdown Entries** - Confirms Script Breakdown exists

### Example Output

```
📊 DIAGNOSING: VID-0023
────────────────────────────────────────────

🔍 CHECK 1: Metadata File
   ✅ Metadata file exists
   📄 Script Generated: false
   📄 Processed At: N/A

🔍 CHECK 2: Script Content in Google Sheets
   ✅ Script content found: 6,319 characters
   📝 Preview: **Stop Being a Slave to Your Brain's...

🔍 CHECK 3: Script Breakdown Entries
   ❌ No Script Breakdown entries found

📋 DIAGNOSIS SUMMARY:
   Metadata File: ✅
   Script Content: ✅
   Breakdown Entries: ❌

💡 RECOMMENDATION:
   ⚡ Script exists but breakdown is missing
   🔧 Fix command: node tools/fix-missing-breakdown.js VID-0023
```

### Batch Scan Output

When scanning all videos, you'll get:
- Total video count
- Videos with breakdown ✅
- Videos missing breakdown ❌
- Videos without script content ⚠️
- Videos with errors 💥

**Plus:** Batch fix commands for all affected videos

---

## 🔧 Fix Tool

### `tools/fix-missing-breakdown.js`

**Purpose:** Regenerate Script Breakdown from existing script content

### Usage

```bash
node tools/fix-missing-breakdown.js <VIDEO_ID>
```

### Example

```bash
node tools/fix-missing-breakdown.js VID-0023
```

### What It Does

1. **Validates Video ID** - Ensures format is VID-XXXX
2. **Checks Existing Breakdown** - Prevents duplicates
3. **Retrieves Script Content** - Gets from Video Info sheet
4. **Extracts Sentences** - Smart sentence detection
5. **Generates Image Prompts** - With AI or fallback
6. **Creates Breakdown** - Writes to Google Sheets
7. **Verifies Success** - Confirms entries created

### Process Flow

```
🔧 FIX: Regenerating Script Breakdown for VID-0023
═══════════════════════════════════════════════════

📋 STEP 0: Checking existing breakdown...
✅ No existing breakdown found - safe to proceed

📋 STEP 1: Retrieving existing script content...
✅ Found script: 6,319 characters

📋 STEP 2: Breaking script into sentences...
✅ Extracted 21 sentences

📋 STEP 3: Generating image prompts...
✅ Image prompt generation complete: 21/21

📋 STEP 4: Creating Script Breakdown entries...
✅ Successfully created 21 Script Breakdown entries

📋 STEP 5: Verifying the fix...
✅ VERIFICATION PASSED: Script Breakdown now has 21 entries

✅ FIX COMPLETED SUCCESSFULLY!
```

### Safety Features

- **No Overwrites:** Won't modify existing breakdowns
- **Validation:** Checks video exists and has script
- **Error Handling:** Graceful failures with helpful messages
- **Verification:** Confirms breakdown was created successfully

---

## 🚀 Common Workflows

### Fix Single Video

1. **Diagnose the issue:**
   ```bash
   node tools/diagnose-missing-breakdowns.js VID-0023
   ```

2. **Run the fix:**
   ```bash
   node tools/fix-missing-breakdown.js VID-0023
   ```

3. **Verify in Google Sheets:**
   - Open Script Breakdown sheet
   - Look for VID-0023 entries
   - Check search phrases and status

### Fix Multiple Videos

1. **Scan all videos:**
   ```bash
   node tools/diagnose-missing-breakdowns.js
   ```

2. **Copy the batch fix commands from output:**
   ```bash
   node tools/fix-missing-breakdown.js VID-0018
   node tools/fix-missing-breakdown.js VID-0023
   node tools/fix-missing-breakdown.js VID-0027
   ```

3. **Or create a bash script:**
   ```bash
   #!/bin/bash
   for video in VID-0018 VID-0023 VID-0027; do
     node tools/fix-missing-breakdown.js $video
     sleep 2  # Avoid rate limiting
   done
   ```

### After Fix

1. **Run Asset Scheduler:**
   ```bash
   node src/schedulers/assetScheduler.js
   ```

2. **Check Google Sheets:**
   - Script Breakdown tab
   - Verify Image URL column
   - Check Status column

---

## ⚠️ Important Notes

### Rate Limiting

**Google Sheets API Limit:** 60 read requests per minute

**Impact:**
- Batch diagnostic may hit rate limit after ~18 videos
- Add delays between operations
- Wait 1 minute if rate limit hit

**Recommendation:**
```bash
# Add delay between video checks
for video in VID-0018 VID-0023; do
  node tools/fix-missing-breakdown.js $video
  sleep 2  # 2-second delay
done
```

### Error Scenarios

**1. No Script Content:**
```
❌ ERROR: No script content found for VID-0023
💡 Script must be generated before breakdown can be created
```
**Solution:** Video needs full processing first

**2. Invalid Video ID:**
```
❌ ERROR: Invalid video ID format
Expected format: VID-XXXX (e.g., VID-0023)
```
**Solution:** Use correct format (VID-XXXX)

**3. Breakdown Already Exists:**
```
⚠️  WARNING: Script Breakdown already exists with 21 entries
💡 To proceed with regeneration, delete existing breakdown first
```
**Solution:** Only fix if breakdown is corrupted

### AI Image Prompt Issue

**Known Issue:**
```
Error generating prompt: aiService.generateImagePrompt is not a function
```

**Current Behavior:**
- Uses fallback prompts
- Format: "Visual representation of: [sentence]"
- No impact on breakdown creation
- Search phrases still generated

**Future Fix:**
- Investigate AIService.generateImagePrompt method
- Update method signature
- Enhance fallback prompts

---

## 📋 Troubleshooting

### Tool Won't Run

**Check permissions:**
```bash
chmod +x tools/diagnose-missing-breakdowns.js
chmod +x tools/fix-missing-breakdown.js
```

**Check Node.js:**
```bash
node --version  # Should be v16+
```

### Google Sheets Errors

**Check credentials:**
- Verify Google OAuth tokens in config
- Ensure Sheet ID is correct
- Confirm permissions

**Test connection:**
```bash
node tools/diagnose-missing-breakdowns.js VID-0001
```

### Verification Failed

**If breakdown creation fails:**
1. Check Google Sheets permissions
2. Verify video exists in Master Sheet
3. Confirm script content exists
4. Check API rate limits

**Manual verification:**
- Open Google Sheets
- Check Script Breakdown tab
- Look for video ID entries

---

## 🔗 Related Documentation

- **Fix Report:** `docs/VID-0023-fix-report.md`
- **Original Fix:** `tools/fix-vid-0018-breakdown.js`
- **Service Docs:** `src/services/googleSheetsService.js`

---

## 💡 Tips

1. **Always diagnose first** before running fix
2. **Check rate limits** when processing multiple videos
3. **Verify in Google Sheets** after fix
4. **Run asset scheduler** after creating breakdowns
5. **Add delays** between batch operations

---

## 📞 Support

If you encounter issues:
1. Run diagnostic tool first
2. Check error messages carefully
3. Verify Google Sheets permissions
4. Check rate limits (wait 1 minute)
5. Review fix report for similar issues

**Common Solutions:**
- Wait for rate limit reset (1 minute)
- Verify video has script content
- Check Google OAuth credentials
- Ensure correct video ID format
