#!/usr/bin/env node

import logger, { safeJsonStringify } from '../src/utils/logger.js';
import WorkflowService from '../src/services/workflowService.js';

/**
 * Test script to verify circular reference fix
 * Tests both the logger and the WorkflowService safe error handling
 */

console.log('🧪 Testing Circular Reference Fix...\n');

// Test 1: Test safeJsonStringify function
console.log('Test 1: Safe JSON stringify function');

// Create a circular reference object (like HTTP objects)
const circularObj = {
  name: 'test',
  data: { some: 'data' }
};
circularObj.self = circularObj; // Create circular reference

try {
  const result = safeJsonStringify(circularObj);
  console.log('✅ Safe JSON stringify works:', result.substring(0, 100) + '...');
} catch (error) {
  console.log('❌ Safe JSON stringify failed:', error.message);
}

// Test 2: Test mock HTTP error objects
console.log('\nTest 2: Mock HTTP error objects');

const mockHttpError = {
  message: 'Network Error',
  config: {
    url: 'https://example.com/api',
    method: 'GET'
  },
  request: {
    host: 'example.com'
  }
};
// Create circular reference like axios errors
mockHttpError.request.res = mockHttpError;
mockHttpError.response = mockHttpError.request;

try {
  const result = safeJsonStringify(mockHttpError);
  console.log('✅ HTTP error stringify works:', result.substring(0, 100) + '...');
} catch (error) {
  console.log('❌ HTTP error stringify failed:', error.message);
}

// Test 3: Test WorkflowService error serialization
console.log('\nTest 3: WorkflowService safe error serialization');

try {
  const workflowService = new WorkflowService();
  
  const testError = new Error('Test error message');
  testError.circular = testError; // Create circular reference
  
  const safeError = workflowService.safeErrorSerialization(testError);
  console.log('✅ WorkflowService error serialization works:', JSON.stringify(safeError, null, 2));
} catch (error) {
  console.log('❌ WorkflowService error serialization failed:', error.message);
}

// Test 4: Test logger with circular references
console.log('\nTest 4: Logger with circular references');

try {
  const circularError = {
    message: 'Test circular error',
    data: {}
  };
  circularError.data.parent = circularError;
  
  logger.error('Testing circular reference logging:', circularError);
  console.log('✅ Logger handled circular reference without crashing');
} catch (error) {
  console.log('❌ Logger failed with circular reference:', error.message);
}

// Test 5: Test video ID validation
console.log('\nTest 5: Video ID validation');

const workflowService = new WorkflowService();

// Test with undefined videoId to simulate the original error
try {
  await workflowService.processInitialVideo({ title: 'Test Video' }, undefined);
  console.log('❌ Should have thrown error for undefined video ID');
} catch (error) {
  if (error.message.includes('Video ID is undefined')) {
    console.log('✅ Video ID validation works - caught undefined video ID error');
  } else {
    console.log('❌ Unexpected error:', error.message);
  }
}

console.log('\n🎯 Circular Reference Fix Testing Complete!');
console.log('✨ All tests should show ✅ for the fix to be working correctly.');