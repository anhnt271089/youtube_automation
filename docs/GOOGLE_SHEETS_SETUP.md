# Google Sheets + Google Drive Setup Guide

This guide explains how to set up the Google Sheets and Google Drive integration for the YouTube automation workflow.

## Overview

The new system replaces:
- **Notion Database** → **Google Sheets** (Master tracking sheet)
- **Digital Ocean Spaces** → **Google Drive** (File storage)

## Architecture

### Master Tracking Sheet
One main Google Sheet that tracks all videos (replaces main Notion database).

### Template Workbook
A template workbook that gets copied for each video (replaces Notion script details database).

### Google Drive Folders
Organized folder structure for storing images and assets.

## Setup Steps

### 1. Create Google Cloud Project & OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable APIs:
   - Google Sheets API
   - Google Drive API
4. Create OAuth 2.0 credentials:
   - Go to Credentials → Create Credentials → OAuth 2.0 Client IDs
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/callback`
5. Download the client credentials JSON

### 2. Create Master Tracking Sheet

Create a new Google Sheet with these columns:

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | Video ID | Text | VID-XX format |
| B | YouTube URL | URL | Source video URL |
| C | Title | Text | Video title |
| D | Status | Dropdown | New, Processing, Script Separated, Approved, Generating Images, Completed, Error |
| E | Channel | Text | Source channel name |
| F | Duration | Text | Video duration |
| G | View Count | Number | Video views |
| H | Published Date | Date | Video publish date |
| I | YouTube Video ID | Text | YouTube video ID |
| J | Optimized Title | Text | AI-generated title |
| K | Optimized Description | Text | AI-generated description |
| L | Keywords | Text | SEO keywords |
| M | Total Sentences | Number | Script sentence count |
| N | Completed Sentences | Number | Progress counter |
| O | Thumbnail URLs | URL | Generated thumbnails |
| P | Thumbnail Prompt | Text | AI thumbnail prompts |
| Q | Script Approved | Checkbox | Manual approval flag |
| R | Voice Status | Checkbox | Legacy voice status |
| S | Voice Generation Status | Dropdown | Not Ready, Not Started, In Progress, Completed, Need Changes |
| T | Video Editing Status | Dropdown | Not Ready, Not Started, In Progress, First Draft, Completed, Published |
| U | Drive Folder | URL | Video folder link |
| V | Detail Workbook URL | URL | Link to detail workbook |
| W | Created Time | Timestamp | Auto-populated |
| X | Last Edited Time | Timestamp | Auto-populated |

#### Master Sheet Setup:
1. Name the sheet "Videos"
2. Add data validation for Status, Voice Generation Status, and Video Editing Status columns
3. Set up conditional formatting for status visualization
4. Protect auto-populated columns (C, D, E, F, G, H, I, J, K, L, M, N, O, P, W, X)

### 3. Create Template Workbook

Create a new Google Sheets workbook with 3 sheets:

#### Sheet 1: "Video Info"
Basic video information and metadata.

| Column | Header | Description |
|--------|--------|-------------|
| A | Field | Field name |
| B | Value | Field value |

Pre-populate with fields like:
- Video ID
- Title
- Status
- YouTube URL
- Channel
- Duration
- etc.

#### Sheet 2: "Script Breakdown"
Sentence-level breakdown of the script.

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | Sentence # | Number | Sequential number |
| B | Script Text | Text | The sentence content |
| C | Image Prompt | Text | AI-generated prompt |
| D | Image URL | URL | Generated image link |
| E | Editor Keywords | Text | Editing keywords |
| F | Status | Dropdown | Pending, Processing, Image Generated, Complete |
| G | Word Count | Formula | `=LEN(TRIM(B2))-LEN(SUBSTITUTE(TRIM(B2)," ",""))+1` |

#### Sheet 3: "Analytics"
Progress tracking and analytics.

Add formulas for:
- Progress percentage: `=N2/M2*100` (Completed/Total sentences)
- Status summary charts
- Timeline tracking

### 4. Set Up Conditional Formatting

#### Master Sheet:
- Status column: Color-code based on status values
- Progress visualization: Color gradient based on completion percentage

#### Template Workbook:
- Script status: Green for Complete, Yellow for Processing, Red for Pending
- Progress bars and visual indicators

### 5. Configure Environment Variables

Update your `.env` file:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_oauth_client_id
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/callback

# Google Sheets & Drive IDs
GOOGLE_MASTER_SHEET_ID=your_master_sheet_id
GOOGLE_TEMPLATE_WORKBOOK_ID=your_template_workbook_id
GOOGLE_DRIVE_FOLDER_ID=your_drive_folder_id

# OAuth Tokens (obtained after authentication)
GOOGLE_ACCESS_TOKEN=your_access_token
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

### 6. OAuth Authentication Flow

Run the OAuth setup script to obtain tokens:

```bash
node scripts/setup-google-oauth.js
```

This will:
1. Open browser for Google authentication
2. User grants permissions for Sheets + Drive access
3. Tokens are saved to environment variables
4. Test connection to verify setup

### 7. Folder Structure in Google Drive

Create this folder structure in your Google Drive:

```
YouTube Automation/
├── Templates/
│   └── Video Template Workbook
├── Videos/
│   ├── VID-01 - Video Title/
│   │   ├── Images/
│   │   ├── Audio/
│   │   └── Final/
│   └── VID-02 - Video Title/
│       ├── Images/
│       ├── Audio/
│       └── Final/
└── Archives/
```

## Benefits of This Setup

### Advantages:
1. **Single Ecosystem** - Everything in Google workspace
2. **No Storage Quota Issues** - OAuth uses your personal storage
3. **Cost Effective** - Google Drive 15GB free tier
4. **Better Integration** - Native Google services work well together
5. **Familiar Interface** - Most users know Google Sheets

### Features:
1. **Auto-copying** - Template workbook copied for each video
2. **Real-time Collaboration** - Multiple users can work simultaneously  
3. **Rich Formatting** - Conditional formatting, charts, formulas
4. **Automatic Backups** - Google handles versioning and backups
5. **Mobile Access** - Works on all devices

## Migration from Notion

If migrating from existing Notion setup:

1. Export Notion data to CSV
2. Import to master Google Sheet
3. Create detail workbooks for existing videos
4. Update video URLs to point to new Google Drive assets
5. Test workflow with a sample video

## Troubleshooting

### Common Issues:

1. **OAuth Token Expired**
   - Refresh tokens automatically handle this
   - Manual refresh if needed: `node scripts/refresh-google-tokens.js`

2. **Sheet Not Found**
   - Verify sheet IDs in environment variables
   - Check sheet sharing permissions

3. **Drive Upload Fails**
   - Check folder permissions
   - Verify OAuth scopes include Drive access

4. **Template Copy Fails**
   - Ensure template workbook is shared properly
   - Check Drive API permissions

### Debugging:

Enable debug logging:
```env
LOG_LEVEL=debug
```

Test individual components:
```bash
node scripts/test-google-sheets.js
node scripts/test-google-drive.js
```

## Security Notes

1. **Token Storage**: Store refresh tokens securely (encrypt if possible)
2. **Scope Limitation**: Only request necessary OAuth scopes
3. **Sheet Protection**: Protect auto-populated columns from manual editing
4. **Access Control**: Limit sheet sharing to authorized users only
5. **API Quotas**: Monitor Google API usage to avoid rate limits

## Performance Optimization

1. **Batch Operations**: Use batchUpdate for multiple changes
2. **Caching**: Cache frequently accessed sheet data
3. **Async Processing**: Handle multiple videos concurrently
4. **Error Handling**: Implement exponential backoff for API calls