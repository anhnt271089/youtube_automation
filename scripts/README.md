# Scripts Directory

This directory contains utility scripts organized by purpose:

## 🛠️ Setup Scripts (`/setup/`)
Initial system setup and configuration scripts:
- `setup-google-oauth.js` - Configure Google OAuth authentication
- `create-google-sheets-structure.js` - Initialize Google Sheets database structure
- `recreate-master-sheet.js` - Recreate master sheet with proper schema
- `recreate-fixed-master-sheet.js` - Create fixed master sheet structure
- `update-master-sheet-headers.js` - Update sheet headers to match schema
- `delete-old-sheet.js` - Clean up old sheet versions
- `updateNotionDatabase.js` - Legacy Notion database updates

## 🔧 Maintenance Scripts (`/maintenance/`)
System monitoring and maintenance utilities:
- `health-check.js` - Comprehensive system health monitoring
- `cost-analysis.js` - Analyze API costs and usage patterns
- `verify-timezone.js` - Verify and test timezone configurations

## 🧪 Development Scripts (`/development/`)
Testing and development utilities:
- `test-google-integration.js` - Test Google Sheets/Drive integration
- `test-youtube-basic.js` - Basic YouTube API functionality test
- `test-youtube-metadata.js` - YouTube metadata extraction testing
- `test-fixed-structure.js` - Test fixed Google Sheets structure
- `test-image-improvements.js` - Image generation testing
- `test-transcript-fallbacks.js` - Transcript extraction fallback testing
- `quick-youtube-test.js` - Quick YouTube API validation

## Usage

Run scripts from the project root directory:

```bash
# Setup scripts
node scripts/setup/setup-google-oauth.js
node scripts/setup/create-google-sheets-structure.js

# Maintenance scripts  
node scripts/maintenance/health-check.js
node scripts/maintenance/cost-analysis.js

# Development scripts
node scripts/development/test-google-integration.js
node scripts/development/quick-youtube-test.js
```

All scripts require proper environment configuration in `.env` file.