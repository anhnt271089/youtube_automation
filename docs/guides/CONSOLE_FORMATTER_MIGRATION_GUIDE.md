# Console Formatter Migration Guide

This guide helps migrate existing console output patterns to use the new standardized console formatter utility.

## Overview

The console formatter utility (`/src/utils/consoleFormatter.js`) standardizes all console output formatting across the YouTube automation project, providing:

- ✅ Consistent emoji usage and spacing
- ✅ Proper indentation (4 spaces)  
- ✅ Color support with ANSI codes
- ✅ Configurable separator styles
- ✅ Progress indicators and timing
- ✅ Integration with existing logger system

## Quick Start

### 1. Import the Formatters

```javascript
// Replace raw console statements
import { 
    formatHeader, 
    formatSuccess, 
    formatError,
    formatWarning,
    formatInfo,
    formatStep,
    formatProgress,
    formatSeparator
} from '../utils/consoleFormatter.js';
```

### 2. Replace Console Patterns

#### Headers and Separators

**Before:**
```javascript
console.log('\n🧪 SCRIPT REGENERATION FIXES VALIDATION');
console.log('=======================================');
```

**After:**
```javascript
console.log(formatHeader('Script Regeneration Fixes Validation'));
console.log(formatSeparator());
```

#### Success/Error Messages

**Before:**
```javascript
console.log('✅ Production safety prevents test content');
console.log('❌ SOME VALIDATION TESTS FAILED');
```

**After:**
```javascript
console.log(formatSuccess('Production safety prevents test content'));
console.log(formatError('Some validation tests failed'));
```

#### Progress and Steps

**Before:**
```javascript
console.log('📌 Step 1: Extract metadata');
console.log('⏳ Processing videos (3/10)...');
```

**After:**
```javascript
console.log(formatStep(1, 'Extract metadata'));
console.log(formatProgress(3, 10, 'Processing videos'));
```

## Common Migration Patterns

### Pattern 1: Workflow Headers

**Before:**
```javascript
console.log('\n🔍 ANALYZING VIDEO CONTENT');
console.log('==========================');
console.log('📊 Processing metadata...');
console.log('✅ Metadata extraction complete');
console.log('❌ Failed to generate thumbnails');
```

**After:**
```javascript
console.log(formatHeader('Analyzing Video Content'));
console.log(formatSeparator());
console.log(formatInfo('Processing metadata...'));
console.log(formatSuccess('Metadata extraction complete'));
console.log(formatError('Failed to generate thumbnails'));
```

### Pattern 2: Service Status Updates

**Before:**
```javascript
console.log('📊 Google Sheets: Connected');
console.log('📱 Telegram: Sending notification');
console.log('🎨 Leonardo AI: Generating images');
```

**After:**
```javascript
import { EMOJIS } from '../utils/consoleFormatter.js';

console.log(formatProcess('Google Sheets', 'Connected', { emoji: EMOJIS.GOOGLE }));
console.log(formatProcess('Telegram', 'Sending notification', { emoji: EMOJIS.TELEGRAM }));
console.log(formatProcess('Leonardo AI', 'Generating images', { emoji: EMOJIS.LEONARDO }));
```

### Pattern 3: Validation and Testing

**Before:**
```javascript
console.log('\n🧪 Running validation tests...');
console.log('  ✓ Configuration loaded successfully');
console.log('  ✓ All services connected');
console.log('  ❌ Rate limit exceeded');
console.log('\n🎉 Validation complete!');
```

**After:**
```javascript
console.log(formatHeader('Running Validation Tests', { emoji: EMOJIS.TESTING }));
console.log(formatSuccess('Configuration loaded successfully', { indent: 1 }));
console.log(formatSuccess('All services connected', { indent: 1 }));
console.log(formatError('Rate limit exceeded', { indent: 1 }));
console.log(formatCompletion('Validation complete!'));
```

### Pattern 4: Progress Tracking

**Before:**
```javascript
console.log('⏳ Processing videos...');
console.log('   Video 1/5 processed');
console.log('   Video 2/5 processed');
console.log('   Video 3/5 processed');
console.log('✅ All videos processed successfully!');
```

**After:**
```javascript
console.log(formatInfo('Processing videos...'));
for (let i = 1; i <= 5; i++) {
    console.log(formatProgress(i, 5, 'Processing videos', { indent: 1 }));
    // ... processing logic
}
console.log(formatSuccess('All videos processed successfully!'));
```

### Pattern 5: Error Handling

**Before:**
```javascript
try {
    // ... some operation
    console.log('✅ Operation completed successfully');
} catch (error) {
    console.error('❌ Operation failed:', error.message);
    console.log('🔄 Attempting retry...');
}
```

**After:**
```javascript
try {
    // ... some operation
    console.log(formatSuccess('Operation completed successfully'));
} catch (error) {
    console.log(formatError(`Operation failed: ${error.message}`));
    console.log(formatInfo('Attempting retry...', { emoji: EMOJIS.PROCESSING }));
}
```

## File-by-File Migration Strategy

### Priority 1: Tools and Scripts
Start with files in `/tools/` directory as they have the most console output:

1. **High Impact Files:**
   - `tools/validate-regeneration-fixes.js`
   - `tools/test-*.js` files
   - `tools/check-*.js` files

2. **Migration Steps:**
   ```javascript
   // Add import at top
   import { formatHeader, formatSuccess, formatError } from '../src/utils/consoleFormatter.js';
   
   // Replace console patterns
   // Before: console.log('✅ Test passed');
   // After:  console.log(formatSuccess('Test passed'));
   ```

### Priority 2: Services
Update service files that have console output:

1. **Service Files:**
   - `src/services/keywordAnalyzer.js`
   - `src/services/enhancedKeywordResearch.js`
   - Any service with error logging

2. **Migration Pattern:**
   ```javascript
   // Before
   console.error('Keyword analysis failed:', error);
   
   // After
   import { formatError } from '../utils/consoleFormatter.js';
   console.log(formatError(`Keyword analysis failed: ${error.message}`));
   ```

### Priority 3: Main Application Files
Update core application files:

1. **Main Files:**
   - `src/index.js`
   - Main workflow controllers

## Advanced Usage Examples

### Custom Workflow Stages

```javascript
console.log(formatWorkflowStage('Content Generation'));
console.log(formatStep(1, 'Extract YouTube metadata'));
console.log(formatStep(2, 'Generate AI script content'));
console.log(formatStep(3, 'Create thumbnail concepts'));
console.log(formatStep(4, 'Upload to Google Drive'));
console.log(formatCompletion('Content generation workflow completed!'));
```

### Service Integration with Custom Emojis

```javascript
import { EMOJIS, formatProcess } from '../utils/consoleFormatter.js';

console.log(formatProcess('Google Sheets API', 'Initializing', { 
    emoji: EMOJIS.GOOGLE 
}));
console.log(formatProcess('Claude AI', 'Generating script', { 
    emoji: EMOJIS.AI 
}));
console.log(formatProcess('Leonardo AI', 'Creating thumbnails', { 
    emoji: EMOJIS.LEONARDO 
}));
```

### Hierarchical Information Display

```javascript
console.log(formatHeader('Video Processing Results'));
console.log(formatSubHeader('Generated Content'));
console.log(formatListItem('Script: 150 words, optimized for retention'));
console.log(formatListItem('Thumbnails: 3 concepts with viral elements'));
console.log(formatListItem('Title: Click-optimized with keyword targeting'));

console.log(formatSubHeader('Upload Status'));
console.log(formatSuccess('Google Drive: All files uploaded', { indent: 1 }));
console.log(formatSuccess('Google Sheets: Metadata updated', { indent: 1 }));
console.log(formatWarning('Telegram: Notification pending', { indent: 1 }));
```

### Data Tables and Summaries

```javascript
// Display tabular data
const videoStats = [
    { id: 'VID-001', status: 'Complete', duration: '1:30', views: '10.2K' },
    { id: 'VID-002', status: 'Processing', duration: '0:45', views: '0' }
];

console.log(formatHeader('Video Status Report'));
console.log(formatTable(videoStats));

// Summary boxes
const dailySummary = [
    'Videos processed: 15',
    'Success rate: 92%',
    'Average time: 2.3 min',
    'Storage used: 450MB'
];

console.log(formatSummary('Daily Processing Summary', dailySummary));
```

## Integration with Existing Logger

The formatter integrates seamlessly with the existing winston logger:

```javascript
import logger from '../utils/logger.js';
import { formatForLogger, formatSuccess } from '../utils/consoleFormatter.js';

// For file logging (stripped of colors)
const logEntry = formatForLogger('info', 'Workflow completed', { 
    videoId: 'VID-0015',
    duration: 2340 
});
logger.info(logEntry.message, logEntry);

// For console output (with colors and formatting)
console.log(formatSuccess('Workflow completed successfully'));
```

## Testing Your Migration

1. **Run Examples:**
   ```bash
   node src/utils/consoleFormatterExamples.js
   ```

2. **Run Tests:**
   ```bash
   npm test -- src/__tests__/consoleFormatter.test.js
   ```

3. **Visual Check:**
   - Consistent emoji usage
   - Proper indentation (4 spaces)
   - Color consistency
   - Readable spacing

## Rollback Strategy

If needed, the migration can be rolled back easily:

1. **Gradual Rollback:** Remove imports and revert to raw console statements
2. **No Breaking Changes:** The formatter doesn't modify existing functionality
3. **Backwards Compatible:** Old console patterns still work alongside formatted ones

## Benefits After Migration

- ✅ **Consistency:** All output follows the same visual patterns
- ✅ **Maintainability:** Easy to update formatting across entire project
- ✅ **Readability:** Professional, easy-to-scan console output
- ✅ **Debugging:** Clear visual hierarchy helps identify issues faster
- ✅ **Documentation:** Self-documenting code with clear visual cues

## Support

- **Documentation:** `/src/utils/README.md`
- **Examples:** `/src/utils/consoleFormatterExamples.js`
- **Tests:** `/src/__tests__/consoleFormatter.test.js`

Start with high-impact files and migrate incrementally. The utility is designed to be non-breaking and easy to adopt gradually across the codebase.