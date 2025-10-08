# Script Breakdown Retry Tests

Quick reference guide for testing the script breakdown retry bug fix.

## Available Tests

### 1. Basic Functionality Test

**File**: `script-breakdown-retry-test.js`

**Purpose**: Verifies that script breakdown works correctly with moderately long scripts

**Run**:
```bash
node tests/script-breakdown-retry-test.js
```

**Expected Output**:
```
✅ Passed: 7/7
🎉 ALL TESTS PASSED!
```

**What it tests**:
- ✅ Result is defined (not undefined)
- ✅ Result is an array
- ✅ Array is not empty
- ✅ Array contains strings
- ✅ Sentence count within limit (60)
- ✅ All items are valid strings
- ✅ No empty strings

---

### 2. Stress Test

**File**: `script-breakdown-retry-stress-test.js`

**Purpose**: Tests behavior with extremely long scripts that exceed limits

**Run**:
```bash
node tests/script-breakdown-retry-stress-test.js
```

**Expected Behavior**:
- May fail with malformed JSON from AI (expected for extremely long inputs)
- Tests error handling and graceful degradation
- Verifies that errors are clear and actionable

**What it tests**:
- ✅ Handling of edge cases (78+ sentence scripts)
- ✅ Error message clarity
- ✅ Graceful failure vs silent failure
- ✅ JSON parsing robustness

---

## Quick Test Commands

```bash
# Run basic test (recommended)
npm run test:script-breakdown

# Or run directly
node tests/script-breakdown-retry-test.js

# Run stress test (for debugging edge cases)
node tests/script-breakdown-retry-stress-test.js

# Run both tests
npm run test:script-breakdown && node tests/script-breakdown-retry-stress-test.js
```

---

## What to Look For

### ✅ Success Indicators

1. **Test Output**:
   ```
   ✅ PASS - Result is defined
   ✅ PASS - Result is array
   ✅ PASS - Contains strings
   ✅ PASS - Within max limit (60)
   ```

2. **Logs**:
   ```
   📋 Script breakdown: 52 sentences (limit: 60)
   ```

3. **Return Value**:
   - Array of strings
   - Length ≤ 60
   - All sentences are meaningful

### ❌ Failure Indicators (from old bug)

1. **Test Output**:
   ```
   ❌ FAIL - Result is defined      ← undefined returned
   ❌ FAIL - Result is array         ← not an array
   ```

2. **Logs**:
   ```
   ✅ Retry successful: undefined sentences   ← BUG!
   ```

3. **Workflow**:
   - Script breakdown not created in Google Sheets
   - Asset download doesn't trigger
   - Silent workflow failure

---

## Interpreting Results

### Basic Test

| Result | Meaning | Action |
|--------|---------|--------|
| 7/7 passed | ✅ Fix working correctly | None needed |
| 6/7 passed | ⚠️ Minor issue | Check which test failed |
| <6/7 passed | ❌ Major issue | Review code changes |

### Stress Test

| Result | Meaning | Action |
|--------|---------|--------|
| All pass | ✅ Handles edge cases | None needed |
| Parse error | ⚠️ Expected for extreme inputs | Normal behavior |
| undefined return | ❌ Bug not fixed | Review retry logic |

---

## Testing Scenarios

### Scenario 1: Normal Script (recommended)

```bash
node tests/script-breakdown-retry-test.js
```

**Expected**: Quick success, 52-60 sentences returned

### Scenario 2: Trigger Retry Logic

To manually trigger retry logic, create a test with a script that generates 67-75 sentences on first attempt. The script will:

1. First attempt: Generate 67-75 sentences
2. Log: `⚠️ AI generated X sentences, exceeds buffer limit`
3. Retry: Generate ≤60 sentences
4. Log: `✅ Retry successful: X sentences`
5. Return: Valid sentence array

### Scenario 3: Production Monitoring

```bash
# Monitor logs for retry patterns
tail -f logs/combined.log | grep "Retry successful"

# Should show valid sentence counts, not "undefined"
✅ Retry successful: 58 sentences (within limit: 60)
```

---

## Troubleshooting

### Issue: Test hangs or times out

**Cause**: API rate limits or network issues

**Solution**:
```bash
# Wait 1 minute and retry
# Or check API keys in .env
```

### Issue: Parse error with stress test

**Cause**: AI generating malformed JSON with extremely long scripts

**Solution**: This is expected behavior - test is working correctly

### Issue: undefined still returned

**Cause**: Fix not applied correctly

**Solution**:
1. Check `/src/services/aiService.js` lines 1162-1297
2. Verify OpenAI API is used for all attempts
3. Verify validation logic is present

---

## Adding to CI/CD

```yaml
# .github/workflows/test.yml
- name: Run Script Breakdown Tests
  run: |
    node tests/script-breakdown-retry-test.js
```

---

## Manual Production Verification

1. **Trigger workflow with long script**:
   - Add YouTube URL to Google Sheets
   - Use video with 10+ minute runtime
   - Set Script Status to "Approved"

2. **Monitor logs**:
   ```bash
   tail -f logs/combined.log | grep "Script breakdown"
   ```

3. **Check Google Sheets**:
   - Script Details sheet should be created
   - Should have ≤60 sentences
   - All sentences should be valid

4. **Verify workflow completes**:
   - Asset download triggers
   - Images downloaded and uploaded to Drive
   - Status updates to "Assets Ready"

---

## Summary

**Primary Test**: `script-breakdown-retry-test.js`
**Run Before**: Deploying to production
**Expected**: 7/7 tests pass
**Time**: ~20 seconds

If basic test passes, the fix is working correctly.
