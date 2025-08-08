# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Important
- Always use use a specialized subagent to do every single task
- Task need pass QA. QC before mark done
- Update all related document if needed when requirement change 
- When finish task, find issue from Google Sheets Issue List and fix them then change status of that issue in the Google Sheets

## 🔄 Migration Status: Google Sheets + Google Drive Integration

**COMPLETED**: Full migration from Notion + Digital Ocean to Google Sheets + Google Drive

**Key Changes:**
- ✅ **Database Layer**: Migrated from Notion databases to Google Sheets with hierarchical structure
- ✅ **File Storage**: Migrated from Digital Ocean Spaces to Google Drive with shareable links
- ✅ **Service Integration**: Replaced NotionService with GoogleSheetsService
- ✅ **Authentication**: Google Service Account with Sheets + Drive API access
- ✅ **Data Structure**: Master Sheet → Video Info Sheet → Script Details Sheet hierarchy
- ✅ **Asset Management**: Images stored in Google Drive with automatic sharing and URL generation

**Benefits:**
- **Cost Reduction**: Eliminated Digital Ocean storage costs
- **Simplified Setup**: Single Google account for both database and storage
- **Better Integration**: Native Google ecosystem with consistent permissions
- **Enhanced Collaboration**: Direct Google Sheets access for manual workflow management
- **Improved Reliability**: Google's infrastructure and API stability

## 🎬 Script Generation Enhancement (Latest Update)

**MAJOR UPGRADE**: YouTube script generation methodology enhanced with advanced copywriting psychology and viral optimization techniques.

**Key Improvements:**
- ✅ **Advanced Hook Architecture**: Multi-layered pattern interrupts, nested curiosity gaps, authority challenges, identity disruption
- ✅ **Hero's Journey Integration**: Complete narrative structure with retention checkpoints every 15 seconds
- ✅ **Psychological Depth**: Pre-suasion priming, embedded commands, emotional progression mapping
- ✅ **Algorithm Optimization**: Multi-point retention engineering, advanced comment bait, share psychology
- ✅ **Language Pattern Mastery**: Power word hierarchies, embedded commands, cognitive load management
- ✅ **Viral Multiplication**: Social currency integration, quotable moments, strategic controversy

**Performance Targets:**
- 95%+ retention at 15 seconds (up from 90%)
- 15%+ click-through rate potential (up from 12%)
- 3%+ comment rate in first hour (up from 2%)
- 8%+ share probability through social currency
- >75% average watch time for algorithm preference
- >2% subscriber conversion rate optimization


## Project Overview

This is a comprehensive YouTube content automation system built with Node.js that transforms YouTube videos into optimized short-form content using AI. The system orchestrates a complete workflow from URL processing to final video delivery through Google Sheets, Google Drive, and Telegram integrations.
