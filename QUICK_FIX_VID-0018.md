# 🚀 Quick Fix Guide: VID-0018 Script Breakdown Issue

## Problem Summary
VID-0018 exists in Video Info sheet with a complete script, but has **no Script Breakdown entries** preventing asset downloads and video editing workflow.

## Root Cause
The Script Breakdown feature was either:
- Not available when VID-0018 was created (most likely)
- Disabled during video processing
- Failed silently during execution

## Quick Fix (2 minutes)

### Option 1: Automated Fix (RECOMMENDED)
```bash
cd /Users/theanh/Documents/Claude-Project/youtube_automation

# Run the fix script
node tools/fix-vid-0018-breakdown.js
```

This will:
1. Extract the script from Video Info sheet
2. Break it into ~46 sentences
3. Generate image prompts using AI
4. Create Script Breakdown entries
5. Verify the fix

### Option 2: Manual Fix
1. Open the detail workbook: https://docs.google.com/spreadsheets/d/1uAHT5FlzsjEtYU2Mbx29YBzItpMPtA3_JvcgjOIwk-c
2. Copy CLEAN VOICE SCRIPT from Video Info sheet
3. Break into sentences
4. Manually add to Script Breakdown sheet (not recommended - use Option 1)

## Verification Steps

After running the fix:

1. **Check Google Sheets:**
   - Open: https://docs.google.com/spreadsheets/d/1uAHT5FlzsjEtYU2Mbx29YBzItpMPtA3_JvcgjOIwk-c
   - Go to "Script Breakdown" tab
   - Confirm: ~46 rows of data (not just header)

2. **Run diagnostic again:**
   ```bash
   node tools/diagnose-vid-0018.js
   ```
   Should show: ✅ Script Breakdown sheet has entries

3. **Check asset download readiness:**
   ```bash
   node tools/check-asset-status.js VID-0018
   ```

## Expected Results

After fix completes:
- Script Breakdown sheet: ~46 entries ✅
- Each entry has: Sentence text, Image prompt, Search phrase ✅
- Asset download can proceed ✅
- Video editing workflow unblocked ✅

## If Fix Fails

Check logs and contact support with:
- Error message from fix script
- Output from diagnostic script
- Google Sheets URL
- Video ID: VID-0018

## Prevention

To prevent this for future videos:
1. Ensure `.env` has: `ENABLE_SCRIPT_BREAKDOWN=true` ✅ (already set)
2. Check other videos for similar issues: `node tools/find-videos-missing-breakdown.js` (create if needed)
3. Add automated health checks (recommended)

## Related Files
- Diagnostic report: `/DIAGNOSTIC_REPORT_VID-0018.md`
- Diagnostic script: `/tools/diagnose-vid-0018.js`
- Fix script: `/tools/fix-vid-0018-breakdown.js`

---
**Quick Start:** Just run `node tools/fix-vid-0018-breakdown.js` and you're done! 🎉
