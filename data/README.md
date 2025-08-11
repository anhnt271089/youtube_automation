# Data Directory Structure

This directory contains project data files and metadata for the YouTube automation system.

## Directory Structure

```
data/
├── README.md                           # This file
├── metadata/                          # Video metadata storage
│   ├── VID-*.json                    # Active video metadata files
│   └── backups/                      # Backup metadata files
│       └── VID-*_TIMESTAMP.json     # Video metadata backups (1 per active video)
└── test_data_top10_videos.json       # Test data for BeyondBeing channel
```

## File Descriptions

### Active Files
- `test_data_top10_videos.json` - Contains top 10 most viewed videos from BeyondBeing channel for testing
- `metadata/VID-*.json` - Main video metadata files used by the MetadataService
- `metadata/backups/VID-*.json` - Video metadata backup files for recovery operations

## Metadata Service

The MetadataService uses this directory structure to:
1. Store immutable video metadata backups
2. Provide bulletproof metadata recovery
3. Validate data integrity with checksums
4. Support workflow recovery operations

### Backup File Format
Each backup file contains:
- `videoId` - Internal video identifier
- `originalMetadata` - Immutable YouTube metadata
- `workflowMetadata` - Mutable workflow tracking data
- `systemIntegrity` - Validation and backup status

## Cleanup Policy

- Health check test files are automatically removed after health checks
- Orphaned backup files (without corresponding main files) are removed during cleanup
- Only the most recent backup is retained per active video to prevent redundancy
- Deprecated test files are removed when systems migrate
- Backup files are validated for integrity during cleanup operations

## Maintenance

Use `node tools/metadata-cleanup.js` to:
- Remove orphaned backup files for deleted videos
- Consolidate multiple backup files per video (keep most recent)
- Validate file integrity and structure
- Generate cleanup summary reports