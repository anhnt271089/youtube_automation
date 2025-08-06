# Notion Property Protection System

## Overview

Since Notion doesn't support native column-level permissions, we've implemented a **programmatic property protection system** in the `NotionService` class that prevents unauthorized edits to auto-generated data.

## Visual Protection Indicators

All protected (auto-generated) properties are prefixed with 🔒 to clearly indicate they should not be manually edited:

### Main Database Protected Properties
- 🔒 VideoID (Formula) - Auto-generated sequential ID
- 🔒 Title (Title) - Extracted from YouTube
- 🔒 Status (Select) - Workflow state tracking
- 🔒 Channel (Text) - YouTube channel name
- 🔒 Duration (Text) - Video duration from YouTube API
- 🔒 View Count (Number) - YouTube view count
- 🔒 Published Date (Date) - YouTube publish date
- 🔒 YouTube Video ID (Text) - Extracted from URL
- 🔒 Optimized Title (Text) - AI-generated
- 🔒 Optimized Description (Text) - AI-generated
- 🔒 Keywords (Multi-select) - AI-generated
- 🔒 Total Sentences (Number) - Auto-calculated
- 🔒 Completed Sentences (Number) - Auto-calculated
- 🔒 Thumbnail (URL) - AI-generated
- 🔒 New Thumbnail Prompt (Text) - AI-generated
- 🔒 Sentence Status (Select) - Processing state
- 🔒 Drive Folder (URL) - Auto-generated
- 🔒 Created Time (Created time) - Notion system field
- 🔒 Last Edited Time (Last edited time) - Notion system field

### Main Database User-Editable Properties
- YouTube URL (URL) - **USER INPUT REQUIRED**
- Script Approved (Checkbox) - **MANUAL APPROVAL REQUIRED**

### Video Detail Database Protected Properties
- 🔒 Sentence Number (Number) - Auto-generated sequence
- 🔒 Script Text (Rich Text) - AI-generated
- 🔒 Image Prompt (Rich Text) - AI-generated
- 🔒 Generated Image URL (URL) - AI-generated
- 🔒 Status (Select) - Processing state
- 🔒 Word Count (Formula) - Auto-calculated
- 🔒 Created Time (Created time) - Notion system field
- 🔒 Last Edited Time (Last edited time) - Notion system field

### Video Detail Database User-Editable Properties
- Sentence (Title) - **MANUAL EDITING ALLOWED** for script corrections

## Protection Implementation

### 1. Property Validation
The `NotionService` class maintains Sets of protected and allowed properties:

```javascript
// Protected properties (auto-generated, locked)
this.protectedMainDbProperties = new Set([...]);
this.protectedDetailDbProperties = new Set([...]);

// User-editable properties (allowed for manual changes)
this.allowedMainDbProperties = new Set(['YouTube URL', 'Script Approved']);
this.allowedDetailDbProperties = new Set(['Sentence']);
```

### 2. Safe Update Methods

All database updates go through validation:

```javascript
// System updates (automation) - can update any property
async updateVideoStatus(pageId, status, additionalData = {}) {
  // Uses safePageUpdate with isSystemUpdate = true
}

// User updates - filtered to only allowed properties
async userUpdateVideoProperties(pageId, properties) {
  return this.safePageUpdate(pageId, properties, false, false);
}

async userUpdateDetailProperties(pageId, properties) {
  return this.safePageUpdate(pageId, properties, false, true);
}
```

### 3. Property Filtering

The `safePageUpdate` method automatically filters properties:

```javascript
async safePageUpdate(pageId, properties, isSystemUpdate = true, isDetailDatabase = false) {
  const validatedProperties = isDetailDatabase 
    ? this.validateDetailDatabaseUpdate(properties, isSystemUpdate)
    : this.validateMainDatabaseUpdate(properties, isSystemUpdate);
  
  // Only validated properties are sent to Notion API
}
```

## Usage Guidelines

### For System/Automation Updates
Use existing methods - they automatically have system privileges:
```javascript
// These methods can update protected properties
await notionService.updateVideoStatus(pageId, 'Processing', additionalData);
await notionService.autoPopulateVideoData(pageId, youtubeData);
await notionService.updateSentenceStatus(videoPageId, sentenceNumber, 'Complete', imageUrl);
```

### For User-Initiated Updates
Use the new user-safe methods:
```javascript
// Main database - only YouTube URL and Script Approved allowed
await notionService.userUpdateVideoProperties(pageId, {
  'YouTube URL': 'https://youtube.com/watch?v=newurl',
  'Script Approved': true,
  '🔒 Title': 'Hack attempt' // This will be BLOCKED and logged
});

// Detail database - only Sentence title allowed
await notionService.userUpdateDetailProperties(detailPageId, {
  'Sentence': 'Corrected sentence text',
  '🔒 Script Text': 'Hack attempt' // This will be BLOCKED and logged
});
```

### Property Information Methods
```javascript
// Check what users can edit
const allowedMain = notionService.getAllowedMainDbProperties();
const allowedDetail = notionService.getAllowedDetailDbProperties();

// Check if specific property is user-editable
const canEdit = notionService.isUserAllowedMainDbProperty('YouTube URL'); // true
const cannotEdit = notionService.isUserAllowedMainDbProperty('🔒 Title'); // false
```

## Security Features

### 1. Automatic Filtering
- Protected properties are automatically removed from user update requests
- Only allowed properties reach the Notion API
- No exceptions - even system admins must use system update methods

### 2. Comprehensive Logging
- All blocked property attempts are logged with WARNING level
- User vs. system updates are clearly differentiated in logs
- Property names and attempted values are recorded for security auditing

### 3. Fail-Safe Design
- Unknown properties are allowed (future-proofing)
- System breaks gracefully if validation fails
- No data corruption possible - blocked properties simply don't get updated

## Implementation Notes

### New Video Detail Databases
All newly created video detail databases automatically use the 🔒 prefix system:

```javascript
async createVideoScriptDatabase(videoTitle, videoPageId) {
  const properties = {
    'Sentence': { title: {} }, // User-editable
    '🔒 Sentence Number': { number: {} }, // Protected
    '🔒 Script Text': { rich_text: {} }, // Protected
    // ... other protected properties
  };
}
```

### Existing Database Migration
For existing video detail databases without 🔒 prefixes:

1. **Visual Update**: The property names now use 🔒 prefixes in new databases
2. **Code Compatibility**: All reference methods updated to use new property names
3. **Backward Compatibility**: Old databases will continue working but should be migrated

### Formula Updates
Word Count formula updated to reference new property name:
```javascript
'🔒 Word Count': {
  formula: {
    expression: 'length(prop("🔒 Script Text"))'
  }
}
```

## Monitoring and Maintenance

### Log Analysis
Monitor logs for blocked property attempts:
```bash
grep "protected property" logs/combined.log
grep "User attempted to modify" logs/combined.log
```

### Property Updates
When adding new properties:
1. Add to appropriate protection Set in constructor
2. Use 🔒 prefix for auto-generated fields
3. Update validation tests

### Security Auditing
Regular checks recommended:
- Review blocked property attempts in logs
- Verify system vs. user update patterns
- Monitor for unusual access patterns

## Benefits

1. **Data Integrity**: Auto-generated data cannot be accidentally corrupted
2. **Clear UX**: 🔒 prefix clearly indicates non-editable fields
3. **Security**: Prevents both accidental and malicious data modification
4. **Audit Trail**: Complete logging of all blocked attempts
5. **Flexibility**: Easy to add new protected or allowed properties
6. **Future-Proof**: Unknown properties allowed for system expansion

This system provides the closest equivalent to column-level permissions that Notion's architecture allows.