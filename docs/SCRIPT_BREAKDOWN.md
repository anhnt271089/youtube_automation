# Script Breakdown System

## Overview

The YouTube automation system creates detailed script breakdowns to organize video content into manageable segments. The system supports two methods: **Notion** (primary) and **Google Sheets** (optional).

## Current Implementation

### Primary Method: Notion Script Breakdown
- **Default behavior**: Script breakdowns are created directly in Notion database
- **Rich formatting**: Includes emojis, visual separators, and structured layout
- **Status tracking**: Individual sentence status via multi-select property
- **Integration**: Centralized with all video data in Notion

### Optional Method: Google Sheets
- **Fallback option**: Can be enabled via `ENABLE_SHEETS_FALLBACK=true`
- **Tabular format**: 5-column structure (Sentence #, Script Text, Image Prompt, Image URL, Status)
- **Requires**: Google Sheets API enabled and configured

## Configuration

### Notion-Only Setup (Default)
```bash
# No additional configuration needed
# System uses Notion script breakdown by default
```

### Google Sheets Fallback (Optional)
```bash
# Add to .env to enable Google Sheets fallback
ENABLE_SHEETS_FALLBACK=true
GOOGLE_DRIVE_FOLDER_ID=your_shared_folder_id

# Requires Google Sheets API enabled:
# https://console.cloud.google.com/apis/library/sheets.googleapis.com
```

## Notion Database Requirements

### Main Database Properties
1. **Thumbnail** (URL)
   - Generated thumbnail image URL
   - Updated when AI thumbnail generation completes

2. **New Thumbnail Prompt** (Text)
   - AI-generated prompt for thumbnail creation
   - Used by DALL-E or other image generation services

3. **Sentence Status** (Select)
   - Overall script processing status
   - Values: 'Script Created', 'Images Generated', 'Complete', etc.
   - Tracks full script progress instead of individual sentences

### Per-Video Script Databases
- **Automatic Creation**: Each video gets its own dedicated script breakdown database
- **Child Pages**: Script databases are created as child pages of the main video entry
- **No Main DB References**: No longer store database IDs/URLs in main database
- **Individual Sentence Tracking**: Each sentence tracked separately in its own database

## Script Breakdown Format

### Notion Format
```
📋 SCRIPT BREAKDOWN

📊 Overview: 8 sentences, 8 image prompts

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 SENTENCE 1
📝 Text: Welcome to today's video about...
🎨 Image Prompt: A vibrant YouTube studio setup...
✅ Status: Pending

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 SENTENCE 2
📝 Text: First, let's explore the main topic...
🎨 Image Prompt: An infographic showing...
✅ Status: Pending

[... continues for all sentences ...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Processing Status: Script breakdown completed
🕒 Created: 2025-01-08 14:30:25
```

### Google Sheets Format (if enabled)
| Sentence # | Script Text | Image Prompt | Generated Image URL | Status |
|------------|-------------|--------------|-------------------|---------|
| 1 | Welcome to today's video about... | A vibrant YouTube studio setup... | | Pending |
| 2 | First, let's explore the main topic... | An infographic showing... | | Pending |

## Workflow Integration

### 1. Initial Processing
When a new YouTube URL is processed:
1. Script sentences are extracted and enhanced with AI
2. Image prompts are generated for each sentence
3. **Notion breakdown** is created with formatted content
4. **Google Sheets** (if enabled) are created in shared folder
5. Status tracking is initialized

### 2. Image Generation Phase
When images are generated:
1. Notion status is updated for individual sentences
2. Google Sheets (if enabled) are updated with image URLs
3. Status changes from "Pending" to "Generated"

### 3. Notifications
- Telegram notifications include Notion page links
- Google Sheets links (if enabled) are included
- Sentence and image prompt counts are reported

## Testing

### Test Notion Breakdown
```bash
node test-single-run.js single-video https://youtube.com/watch?v=VIDEO_ID
```

### Test Google Sheets (if enabled)
```bash
# First enable fallback in .env
echo "ENABLE_SHEETS_FALLBACK=true" >> .env
echo "GOOGLE_DRIVE_FOLDER_ID=your_folder_id" >> .env

# Test sheets creation  
node test-single-run.js single-video https://youtube.com/watch?v=VIDEO_ID
```

## Migration from Google Sheets

### For Existing Installations
1. **Update Notion Database**: Add "Script Breakdown" and "Sentence Status" properties
2. **Optional Configuration**: Set `ENABLE_SHEETS_FALLBACK=false` to disable sheets (default)
3. **Test**: Process a video to verify Notion breakdown works

### Benefits of Notion-Primary Approach
- ✅ **Simplified Setup**: No Google Sheets API configuration required
- ✅ **Centralized Data**: All information in single Notion database
- ✅ **Rich Formatting**: Better visual presentation with emojis and structure
- ✅ **No External Dependencies**: Eliminates Google Sheets API limitations
- ✅ **Better Integration**: Direct access from video entries

## Troubleshooting

### Notion Breakdown Issues
- **Property Missing**: Ensure "Script Breakdown" rich text property exists
- **Status Not Updating**: Verify "Sentence Status" multi-select property exists
- **Truncation**: Long scripts automatically truncated to fit Notion limits

### Google Sheets Issues (if enabled)
- **403 Errors**: Enable Google Sheets API in Cloud Console
- **Permission Denied**: Share folder with service account email
- **Storage Quota**: System automatically falls back to CSV upload method

## Performance Notes

- **Memory Usage**: Minimal impact, text processing only
- **API Calls**: Single Notion API call per breakdown
- **Processing Time**: <1 second for typical script breakdowns
- **Storage**: Efficient text storage in Notion database