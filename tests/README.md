# Test Directory

## Structure

- `integration/` - Integration tests for the complete workflow
- `utilities/` - Utility test scripts (currently empty)

## Available Test Scripts

Run integration tests:
```bash
npm run test:integration    # Run Jest integration tests
npm run test:single         # Test single video processing
npm run test:workflow       # Test complete workflow
npm run test:status         # Test status monitoring
```

## Files

**Integration Tests:**
- `test-complete-workflow.js` - End-to-end workflow testing
- `test-single-run.js` - Single video processing tests
- `test-status-monitoring.js` - Status monitoring system tests
- `test-workflow-fixes.js` - Workflow fix validation
- `test-google-sheets-headers.js` - Google Sheets header validation

**Service Tests:**
- `test-youtube-basic.js` - Basic YouTube service testing
- `test-youtube-metadata.js` - YouTube metadata extraction tests
- `test-transcript-fallbacks.js` - Transcript fallback system tests
- `test-google-integration.js` - Google services integration tests
- `test-image-improvements.js` - Image generation improvement tests
- `test-fixed-structure.js` - Fixed structure validation tests
- `quick-youtube-test.js` - Quick YouTube API validation