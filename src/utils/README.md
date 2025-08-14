# Console Formatter Utility

The Console Formatter utility standardizes all console output formatting across the YouTube automation project, providing consistent styling, spacing, colors, and emoji usage for better readability.

## Quick Start

```javascript
import { 
    formatHeader, 
    formatSuccess, 
    formatError,
    formatProgress 
} from '../utils/consoleFormatter.js';

// Basic usage
console.log(formatHeader('YouTube Processing Started'));
console.log(formatSuccess('Video metadata extracted'));
console.log(formatError('Failed to connect to API'));
console.log(formatProgress(3, 10, 'Processing thumbnails'));
```

## Features

### 🎨 **Consistent Styling**
- Standardized emoji usage across all output
- Proper spacing and indentation (4 spaces)
- Color-coded messages for different types
- Professional separator lines

### 🚀 **Easy Integration**
- Works with existing winston logger system
- Backwards compatible with current console patterns
- Simple import and use across all files
- No external dependencies beyond winston

### 📊 **Rich Formatting Options**
- Headers and sub-headers
- Numbered steps and progress indicators
- Success/error/warning/info messages
- Tables and summary boxes
- Timing information and workflow stages

## Available Formatters

### Basic Message Types

```javascript
formatHeader('Main Process')           // 🚀 MAIN PROCESS
formatSubHeader('Sub Process')         // ➤ Sub Process
formatSuccess('Operation completed')   // ✅ Operation completed
formatError('Something failed')        // ❌ Something failed
formatWarning('Rate limit reached')    // ⚠️ Rate limit reached
formatInfo('Processing data')          // 📋 Processing data
formatDebug('Cache hit ratio: 85%')   // 🔧 Cache hit ratio: 85%
```

### Workflow & Progress

```javascript
formatStep(1, 'Extract metadata')     // 📌 Step 1: Extract metadata
formatProgress(3, 10, 'Thumbnails')   // ⏳ Thumbnails [███.......] 3/10 (30%)
formatProcess('AI Service', 'Active') // 🔄 AI Service: Active
formatWorkflowStage('Processing')     // Formatted stage header
formatCompletion('All done!')         // 🎉 ALL DONE!
```

### Data Presentation

```javascript
// Table formatting
const data = [
    { id: 'VID-001', status: 'Complete', views: '10K' },
    { id: 'VID-002', status: 'Processing', views: '0' }
];
formatTable(data)

// Summary box
formatSummary('Daily Report', [
    'Videos processed: 15',
    'Success rate: 95%'
])

// List items
formatListItem('Script generated: 150 words')
formatListItem('Thumbnails: 3 concepts ready')
```

### Timing & Performance

```javascript
formatTiming(2340)        // ⏱️ Completed in 2.34s
formatTiming(65000)       // ⏱️ Completed in 1.08m
formatSeparator(50, '=')  // Consistent separator lines
```

## Configuration Options

Most formatters accept an options object for customization:

```javascript
formatSuccess('Task completed', {
    emoji: '🎉',           // Custom emoji
    color: COLORS.SUCCESS, // Custom color
    indent: 1              // Indentation level (4 spaces each)
});

formatProgress(5, 10, 'Processing', {
    showBar: true,         // Show progress bar
    showPercentage: true,  // Show percentage
    barLength: 20          // Bar character count
});
```

## Integration with Logger

The formatter integrates seamlessly with the existing winston logger:

```javascript
import logger from '../utils/logger.js';
import { formatForLogger } from '../utils/consoleFormatter.js';

// Format for logger
const logEntry = formatForLogger('info', 'Workflow started', { 
    videoId: 'VID-0015' 
});

logger.info(logEntry.message, logEntry);

// Direct console output with formatting
console.log(formatSuccess('Workflow completed successfully'));
```

## Constants & Utilities

### Available Emojis

```javascript
import { EMOJIS } from '../utils/consoleFormatter.js';

EMOJIS.SUCCESS    // ✅
EMOJIS.ERROR      // ❌
EMOJIS.WARNING    // ⚠️
EMOJIS.PROCESSING // 🔄
EMOJIS.AI         // 🤖
EMOJIS.GOOGLE     // 📊
EMOJIS.TELEGRAM   // 📱
// ... and many more
```

### Available Colors

```javascript
import { COLORS } from '../utils/consoleFormatter.js';

COLORS.SUCCESS    // Green
COLORS.ERROR      // Red  
COLORS.WARNING    // Yellow
COLORS.INFO       // Blue
COLORS.PRIMARY    // Cyan
```

### Utility Functions

```javascript
stripColors(text)           // Remove ANSI color codes
formatForLogger(level, msg) // Format for winston logger
```

## Migration from Raw Console

### Before (Raw Console)
```javascript
console.log('\n🧪 SCRIPT REGENERATION FIXES VALIDATION');
console.log('=======================================');
console.log('✓ Production safety prevents test content');
console.log('✓ Script Breakdown headers use correct format');
console.log('❌ SOME VALIDATION TESTS FAILED');
```

### After (Formatted Console)
```javascript
console.log(formatHeader('Script Regeneration Fixes Validation'));
console.log(formatSeparator());
console.log(formatSuccess('Production safety prevents test content'));
console.log(formatSuccess('Script Breakdown headers use correct format'));
console.log(formatError('Some validation tests failed'));
```

## Best Practices

### 1. **Use Appropriate Types**
- `formatSuccess()` for completed operations
- `formatError()` for failures
- `formatWarning()` for non-critical issues
- `formatInfo()` for general information
- `formatDebug()` for debugging information

### 2. **Consistent Workflow Structure**
```javascript
console.log(formatHeader('Main Process'));
console.log(formatWorkflowStage('Initialization'));
console.log(formatStep(1, 'Load configuration'));
console.log(formatSuccess('Configuration loaded'));
console.log(formatCompletion('Process completed'));
```

### 3. **Use Indentation for Hierarchy**
```javascript
console.log(formatInfo('Starting video processing'));
console.log(formatStep(1, 'Extract metadata', { indent: 1 }));
console.log(formatSuccess('Metadata extracted', { indent: 2 }));
console.log(formatStep(2, 'Generate script', { indent: 1 }));
```

### 4. **Progress Updates**
```javascript
for (let i = 0; i <= total; i++) {
    console.log(formatProgress(i, total, 'Processing videos'));
    // ... processing logic
}
console.log(formatTiming(Date.now() - startTime));
```

## Examples

See `/src/utils/consoleFormatterExamples.js` for comprehensive usage examples covering:

- Basic message formatting
- Workflow stage management
- Progress indicators
- Service-specific formatting
- Error handling patterns
- Table and summary formatting
- Logger integration
- Complete workflow simulation

Run examples:
```bash
node src/utils/consoleFormatterExamples.js
```

## File Structure

```
src/utils/
├── consoleFormatter.js         # Main utility module
├── consoleFormatterExamples.js # Usage examples
└── README.md                   # This documentation
```

## TypeScript Support

The utility is written in JavaScript but includes comprehensive JSDoc comments for excellent IDE support and type hints.

## Backwards Compatibility

The formatter is designed to be:
- Non-breaking with existing code
- Easy to integrate incrementally
- Compatible with current logger patterns
- Minimal impact on performance

Start using it today by importing the specific formatters you need!