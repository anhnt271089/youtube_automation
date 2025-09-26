# Google Drive API Query Escaping Fix

**Date:** August 12, 2025  
**Issue:** VID-0008 and VID-0013 having ERROR status due to Google Drive API query failures  
**Root Cause:** Over-escaping and folder name sanitization mismatch  
**Status:** ✅ **RESOLVED**

## Problem Analysis

### Affected Videos
- **VID-0008**: "How to Control your Brain ( before it's TOO late )"
- **VID-0013**: "The Art of Being Unbothered By Opinions ( Don't let them Shape you )"

### Root Causes Identified

#### 1. Over-Escaping in Google Drive API Queries
**Issue**: The `escapeDriveQuery` function was escaping too many characters
- **Before**: `str.replace(/['\\()\"]/g, '\\$&')` (escaped quotes, backslashes, parentheses, double quotes)
- **Problem**: Google Drive API treats over-escaping as "Invalid Value" error
- **Solution**: Only escape single quotes: `str.replace(/'/g, "\\'")`

#### 2. Folder Name Sanitization Mismatch  
**Issue**: Inconsistency between folder creation and folder search
- **GoogleDriveService**: Uses `sanitizeFolderName()` when creating folders
- **GoogleSheetsService**: Was NOT using `sanitizeFolderName()` when searching for folders
- **Result**: Searching for names that don't exist in Drive

## Implementation

### Files Modified

#### 1. `/src/services/googleSheetsService.js`
```javascript
// Added sanitizeFolderName function for consistency
sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

// Updated escapeDriveQuery to minimal escaping
escapeDriveQuery(str) {
  if (!str) return str;
  // Only escape single quotes - Google Drive API fails with over-escaping
  return str.replace(/'/g, "\\'");
}

// Updated folder name construction to use sanitized titles
async createVideoDetailWorkbook(videoId, videoTitle) {
  const sanitizedTitle = this.sanitizeFolderName(videoTitle);
  const folderName = `(${videoId}) ${sanitizedTitle}`;
  // ... rest of implementation
}
```

#### 2. `/src/services/thumbnailService.js`
```javascript
// Added matching escapeDriveQuery function
escapeDriveQuery(str) {
  if (!str) return str;
  return str.replace(/'/g, "\\'");
}

// Updated all Drive API queries to use this.escapeDriveQuery()
const response = await this.googleDriveService.drive.files.list({
  q: `name='${this.escapeDriveQuery(folderName)}' and mimeType='application/vnd.google-apps.folder' and parents in '${parentId}' and trashed=false`
});
```

### Key Changes Summary

1. **Minimal Escaping**: Only escape single quotes, not parentheses or other characters
2. **Consistent Sanitization**: Both services now use identical folder name sanitization
3. **Fixed Query Construction**: All Drive API queries now use proper escaping
4. **Backward Compatibility**: Normal titles without special characters work unchanged

## Testing Results

### Before Fix
```
❌ VID-0008 Folder Query: FAILED - Invalid Value
❌ VID-0013 Folder Query: FAILED - Invalid Value
```

### After Fix
```
✅ VID-0008 Folder Query: SUCCESS (1 folder found)
✅ VID-0013 Folder Query: SUCCESS (1 folder found) 
✅ VID-0008 Workbook Query: SUCCESS 
✅ VID-0013 Workbook Query: SUCCESS
```

### Test Coverage
- ✅ Problematic video titles with parentheses and apostrophes
- ✅ Mixed quote scenarios ("double" and 'single')
- ✅ Backward compatibility with normal titles
- ✅ Service consistency (GoogleSheetsService vs ThumbnailService)

## Technical Details

### Google Drive API Query Syntax
Google Drive API has specific escaping requirements:
- **Single quotes**: Must be escaped as `\'` 
- **Parentheses**: Do NOT need escaping (handled natively)
- **Double quotes**: Do NOT need escaping (handled natively)
- **Backslashes**: Do NOT need escaping in most cases

### Folder Name Sanitization Rules
Characters removed by `sanitizeFolderName()`:
- `< > : " / \ | ? *` - File system incompatible characters
- Multiple spaces collapsed to single spaces
- Leading/trailing whitespace trimmed
- Length limited to 100 characters

## Alternative Approaches Considered

### 1. "Contains" Query Approach
```javascript
// Instead of exact match:
q: `name='${exactName}' and mimeType='application/vnd.google-apps.folder'`

// Use contains + post-filtering:
q: `name contains '${videoId}' and mimeType='application/vnd.google-apps.folder'`
// Then filter results programmatically for exact match
```
**Decision**: Not implemented (exact match works with correct escaping)

### 2. Different Escaping Methods
Tested multiple approaches:
- ❌ No escaping → Invalid Value
- ❌ Over-escaping → Invalid Value  
- ❌ URL encoding → Invalid Value
- ✅ Only single quotes → SUCCESS

## Impact

### Videos Fixed
- ✅ VID-0008: Can now create and find folders/workbooks
- ✅ VID-0013: Can now create and find folders/workbooks

### System Improvements  
- ✅ Consistent folder naming across all services
- ✅ Reliable Google Drive API queries
- ✅ No more "Invalid Value" errors for special characters
- ✅ Future-proof for videos with apostrophes, parentheses, etc.

## Verification Commands

```bash
# Test the fix with problematic videos
node tools/test-problematic-videos-fix.js

# Test escaping function consistency
node tools/test-drive-query-escaping.js

# Test alternative approaches (for reference)
node tools/test-alternative-approach.js
```

## Maintenance Notes

### When Adding New Services
If creating new services that interact with Google Drive:
1. Copy the `escapeDriveQuery()` function exactly as implemented
2. Use `sanitizeFolderName()` when constructing folder names for searches
3. Test with titles containing apostrophes and parentheses

### Future Considerations
- Monitor Google Drive API changes that might affect escaping rules
- Consider migrating to "contains" queries if exact matching becomes problematic
- Update sanitization rules if new problematic characters are discovered

---

**Fix Author**: API Integration Expert  
**Tested By**: Comprehensive test suite  
**Approved By**: System validation  
**Deployment**: Ready for production