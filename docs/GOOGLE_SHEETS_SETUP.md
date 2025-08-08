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

Create a new Google Sheet with these simplified, icon-only headers (A-P = 16 columns):

| Column | Header | Type | Description |
|--------|--------|------|-------------|
| A | 🤖 Video ID | Text | VID-XXXX format (auto-generated) |
| B | 🔧 YouTube URL | URL | Source video URL (user input) |
| C | 🤖 Title | Text | Video title (auto-populated) |
| D | 🤖 Status | Dropdown | New, Processing, Script Separated, Approved, Generating Images, Completed, Error |
| E | 🤖 Channel | Text | Source channel name (auto-populated) |
| F | 🤖 Duration | Text | Video duration (auto-populated) |
| G | 🤖 View Count | Number | Video views (auto-populated) |
| H | 🤖 Published Date | Date | Video publish date (auto-populated) |
| I | 🤖 YouTube Video ID | Text | YouTube video ID (auto-populated) |
| J | 👤 Script Approved | Dropdown | Pending, Approved, Needs Changes (manual) |
| K | 👤 Voice Generation Status | Dropdown | Not Ready, Not Started, In Progress, Completed, Need Changes |
| L | 👤 Video Editing Status | Dropdown | Not Ready, Not Started, In Progress, First Draft, Completed, Published |
| M | 🤖 Drive Folder Link | URL | Video folder link (auto-populated) |
| N | 🤖 Detail Workbook URL | URL | Link to detail workbook (auto-populated) |
| O | 🤖 Created Time | Timestamp | Auto-populated creation time |
| P | 🤖 Last Edited Time | Timestamp | Auto-populated last edit time |

**Icon Meanings:**
- 🤖 = Automatically populated by system
- 👤 = Requires human interaction/decision  
- 🔧 = User input required

#### Master Sheet Setup:
1. Name the sheet "Videos"
2. Add data validation for Status (D), Script Approved (J), Voice Generation Status (K), and Video Editing Status (L) columns
3. Set up conditional formatting for status visualization
4. Protect auto-populated columns (A, C, D, E, F, G, H, I, M, N, O, P)

**Simplified Structure Benefits:**
- Clean, professional appearance with icon-only headers
- Reduced column count from 24 to 16 (A-P)
- Better mobile responsiveness and readability
- Streamlined workflow with essential data only

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
npm run setup-google
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

### 8. Create or Update Sheet Structure

#### For New Installations:
```bash
npm run create-google-sheets
```
This creates both the master sheet and template workbook with the new simplified headers.

#### For Existing Users (Update Headers):
```bash
npm run update-sheet-headers
```
This updates your existing master sheet to use the new simplified icon-only headers.

### 9. Test Your Setup

Verify everything is working correctly:
```bash
npm run test-sheet-headers
```
This comprehensive test will:
1. Check service health
2. Test video ID generation
3. Create a test entry
4. Verify column mappings
5. Test status updates
6. Validate the structure

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
npm run test-google      # Full Google integration test
npm run test-sheet-headers # Test new header structure
npm run test-google-health # Quick health check
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