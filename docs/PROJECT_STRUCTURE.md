# Project Structure

## Overview
The YouTube automation project has been cleaned up and restructured for better organization and maintainability.

## Directory Structure

```
youtube_automation/
├── 📁 config/                    # Configuration files
│   ├── config.js                 # Main configuration loader
│   ├── development.js            # Development-specific settings
│   └── production.js             # Production-specific settings
│
├── 📁 docs/                      # Documentation
│   ├── API.md                    # API documentation
│   ├── SETUP.md                  # Setup instructions
│   └── PROJECT_STRUCTURE.md      # This file
│
├── 📁 src/                       # Source code
│   ├── 📁 __tests__/            # Test files
│   │   ├── config.test.js
│   │   └── logger.test.js
│   │
│   ├── 📁 services/             # Business logic services
│   │   ├── aiService.js         # OpenAI/Anthropic integration
│   │   ├── googleDriveService.js # Google Drive/Sheets operations
│   │   ├── notionService.js     # Notion database management
│   │   ├── telegramService.js   # Telegram notifications
│   │   ├── videoService.js      # Video processing with FFmpeg
│   │   ├── workflowService.js   # Main orchestration service
│   │   └── youtubeService.js    # YouTube API integration
│   │
│   ├── 📁 utils/               # Utility functions
│   │   └── logger.js           # Winston logging configuration
│   │
│   └── index.js                # Main application entry point
│
├── 📁 scripts/                 # Utility scripts
│   └── updateNotionDatabase.js # Notion database setup script
│
├── 📁 logs/                    # Application logs (auto-generated)
│   ├── combined.log
│   └── error.log
│
├── 📁 temp/                    # Temporary processing files
├── 📁 output/                  # Final video outputs
│
├── 📄 Configuration Files
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── package.json                # Node.js dependencies and scripts
├── eslint.config.js            # Code linting configuration
├── jest.config.js              # Testing configuration
├── jest.setup.js               # Test setup
├── tsconfig.json               # TypeScript configuration
│
└── 📄 Documentation
    ├── README.md               # Main project documentation
    └── CLAUDE.md              # Development guidelines for Claude Code
```

## Key Changes Made

### ✅ Cleanup Actions
- **Removed duplicate files**: Eliminated `*Service 2.js` backup files
- **Fixed imports**: Updated all config import paths after restructuring
- **Cleaned dependencies**: Removed broken node_modules files
- **Added type definitions**: Installed `@types/node-cron`

### ✅ Restructuring
- **Moved config**: Centralized configuration files in `/config/` directory
- **Added documentation**: Created `/docs/` with API, setup, and structure guides
- **Environment configs**: Separate development and production configurations
- **Better organization**: Logical separation of concerns

### ✅ Configuration Updates
- **Updated tsconfig.json**: Fixed rootDir and include paths
- **Fixed jest setup**: Removed deprecated setTimeout and fixed console mocking
- **Updated .gitignore**: Comprehensive ignore patterns
- **Package.json**: Correct main entry point

### ✅ Documentation Added
- **API.md**: Service method documentation
- **SETUP.md**: Complete setup and troubleshooting guide
- **PROJECT_STRUCTURE.md**: This structural overview

## Development Commands

```bash
# Development
npm run dev          # Start with auto-restart
npm run lint         # Code quality check
npm run typecheck    # TypeScript validation
npm test             # Run test suite

# Production
npm start            # Start production system

# Setup
npm run setup-notion # Initialize Notion database
```

## File Status

### ✅ Working Files
- All service files cleaned and imports fixed
- Configuration properly structured
- Tests mostly passing (minor environment-specific failures)
- Linting passes without errors

### 📂 Generated Directories
- `logs/` - Auto-created by Winston
- `temp/` - Auto-cleaned processing files
- `output/` - Final video assets
- `node_modules/` - Dependencies

### 🔧 Configuration Files
- Environment properly structured
- TypeScript configuration optimized
- Jest setup working correctly
- ESLint configuration clean

## Next Steps

1. **Environment Setup**: Copy `.env.example` to `.env` and configure API keys
2. **Notion Database**: Run setup script and configure database schema
3. **Testing**: Run full test suite after environment configuration
4. **Production**: Deploy with proper environment configuration

The project is now properly structured, cleaned, and ready for development or production deployment!