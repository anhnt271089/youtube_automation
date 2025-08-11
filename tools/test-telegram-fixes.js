#!/usr/bin/env node
/**
 * Test Telegram Service Fixes
 * Verifies that the enhanced Telegram service works correctly with network issues
 */

import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';

class TelegramFixTester {
  constructor() {
    this.telegramService = new TelegramService();
    this.testResults = {
      basicSend: null,
      safeSend: null,
      gracefulNotification: null,
      errorHandling: null,
      retryLogic: null
    };
  }

  async runAllTests() {
    console.log('🔧 Testing Telegram Service Fixes...\n');

    try {
      // Test 1: Basic Health Check
      await this.testHealthCheck();
      
      // Test 2: Enhanced sendMessage with retry logic
      await this.testEnhancedSendMessage();
      
      // Test 3: Safe message sending
      await this.testSafeMessageSending();
      
      // Test 4: Graceful notification system
      await this.testGracefulNotifications();
      
      // Test 5: Error classification and diagnostics
      await this.testErrorDiagnostics();
      
      // Test 6: Fallback logging system
      await this.testFallbackLogging();
      
      // Generate test report
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      logger.error('Telegram fix test suite error:', {
        error: error.message,
        stack: error.stack
      });
    }
  }

  async testHealthCheck() {
    console.log('1️⃣ Testing Health Check...');
    
    try {
      const healthResult = await this.telegramService.healthCheck();
      console.log('   ✅ Health check passed');
      this.testResults.basicSend = { success: true };
    } catch (error) {
      console.log('   ❌ Health check failed:', error.message);
      this.testResults.basicSend = { success: false, error: error.message };
    }
    console.log();
  }

  async testEnhancedSendMessage() {
    console.log('2️⃣ Testing Enhanced sendMessage with Retry Logic...');
    
    try {
      const testMessage = `🔧 <b>Enhanced sendMessage Test</b>

⏰ <b>Time:</b> ${new Date().toISOString()}
🔄 <b>Features Tested:</b>
• Adaptive timeout handling
• Network error detection
• Enhanced retry logic
• Comprehensive error diagnostics

<i>This tests the enhanced message sending with improved reliability.</i>`;

      const result = await this.telegramService.sendMessage(testMessage);
      
      if (result && result.message_id) {
        console.log('   ✅ Enhanced sendMessage succeeded');
        console.log('   📨 Message ID:', result.message_id);
        this.testResults.basicSend = { success: true, messageId: result.message_id };
      } else {
        console.log('   ❌ Enhanced sendMessage returned invalid result');
        this.testResults.basicSend = { success: false, error: 'Invalid result' };
      }
    } catch (error) {
      console.log('   ❌ Enhanced sendMessage failed:', error.message);
      console.log('   🔍 Error code:', error.code);
      console.log('   💡 Diagnostic suggestion:', this.telegramService.getDiagnosticSuggestion(error));
      
      this.testResults.basicSend = { 
        success: false, 
        error: error.message,
        code: error.code,
        suggestion: this.telegramService.getDiagnosticSuggestion(error)
      };
    }
    console.log();
  }

  async testSafeMessageSending() {
    console.log('3️⃣ Testing Safe Message Sending (Never Fails)...');
    
    const testMessage = `🛡️ <b>Safe Message Test</b>

⏰ <b>Time:</b> ${new Date().toISOString()}
🔒 <b>Safety Features:</b>
• Never throws exceptions
• Graceful error handling
• Fallback logging
• Workflow continuation guarantee

<i>This method ensures workflow never stops due to notification failures.</i>`;

    try {
      const result = await this.telegramService.sendMessageSafe(testMessage);
      
      if (result && result.message_id) {
        console.log('   ✅ Safe message sending succeeded');
        console.log('   📨 Message ID:', result.message_id);
        this.testResults.safeSend = { success: true, messageId: result.message_id };
      } else if (result === null) {
        console.log('   ⚠️ Safe message sending failed but returned gracefully (null)');
        this.testResults.safeSend = { success: false, graceful: true };
      } else {
        console.log('   ❓ Safe message sending returned unexpected result:', result);
        this.testResults.safeSend = { success: false, unexpected: true, result };
      }
    } catch (error) {
      // This should NEVER happen with sendMessageSafe
      console.log('   ❌ CRITICAL: Safe message sending threw exception (this should not happen)');
      console.log('   🚨 Error:', error.message);
      this.testResults.safeSend = { success: false, critical: true, error: error.message };
    }
    console.log();
  }

  async testGracefulNotifications() {
    console.log('4️⃣ Testing Graceful Notification System...');
    
    const testMessage = `🌟 <b>Graceful Notification Test</b>

⏰ <b>Time:</b> ${new Date().toISOString()}
🎯 <b>Context:</b> Test Context for Workflow Continuation
🔄 <b>Graceful Features:</b>
• Context-aware notifications
• Workflow continuation guarantee
• Enhanced error diagnostics
• Fallback logging with context

<i>This ensures notifications never break the main workflow.</i>`;

    try {
      const result = await this.telegramService.sendNotificationSafe(
        testMessage,
        { parse_mode: 'HTML' },
        'Telegram Fix Test'
      );
      
      if (result && result.message_id) {
        console.log('   ✅ Graceful notification succeeded');
        console.log('   📨 Message ID:', result.message_id);
        this.testResults.gracefulNotification = { success: true, messageId: result.message_id };
      } else if (result && result.graceful_degradation) {
        console.log('   ⚠️ Graceful notification failed but degraded gracefully');
        console.log('   📊 Context:', result.context);
        console.log('   ⏰ Timestamp:', new Date(result.timestamp).toISOString());
        this.testResults.gracefulNotification = { success: false, graceful: true, context: result.context };
      } else {
        console.log('   ❓ Graceful notification returned unexpected result:', result);
        this.testResults.gracefulNotification = { success: false, unexpected: true, result };
      }
    } catch (error) {
      // This should NEVER happen with sendNotificationSafe
      console.log('   ❌ CRITICAL: Graceful notification threw exception (this should not happen)');
      console.log('   🚨 Error:', error.message);
      this.testResults.gracefulNotification = { success: false, critical: true, error: error.message };
    }
    console.log();
  }

  async testErrorDiagnostics() {
    console.log('5️⃣ Testing Error Classification and Diagnostics...');
    
    // Test network error detection
    const mockTimeoutError = { 
      code: 'ETIMEDOUT', 
      message: 'Request timeout' 
    };
    
    const mockUnauthorizedError = { 
      response: { status: 401 },
      message: 'Unauthorized' 
    };
    
    const mockRateLimitError = { 
      response: { status: 429 },
      message: 'Too Many Requests' 
    };

    console.log('   🔍 Testing timeout error detection:');
    const isTimeout = this.telegramService.isTimeoutError(mockTimeoutError);
    const isRetryableTimeout = this.telegramService.isRetryableError(mockTimeoutError);
    const timeoutSuggestion = this.telegramService.getDiagnosticSuggestion(mockTimeoutError);
    
    console.log('   📊 Timeout error detected:', isTimeout ? '✅' : '❌');
    console.log('   🔄 Timeout error retryable:', isRetryableTimeout ? '✅' : '❌');
    console.log('   💡 Timeout suggestion:', timeoutSuggestion);

    console.log('   🔍 Testing auth error detection:');
    const authSuggestion = this.telegramService.getDiagnosticSuggestion(mockUnauthorizedError);
    console.log('   💡 Auth suggestion:', authSuggestion);

    console.log('   🔍 Testing rate limit error detection:');
    const rateLimitSuggestion = this.telegramService.getDiagnosticSuggestion(mockRateLimitError);
    console.log('   💡 Rate limit suggestion:', rateLimitSuggestion);

    this.testResults.errorHandling = {
      timeoutDetection: isTimeout,
      timeoutRetryable: isRetryableTimeout,
      diagnosticsWorking: !!(timeoutSuggestion && authSuggestion && rateLimitSuggestion)
    };
    
    console.log();
  }

  async testFallbackLogging() {
    console.log('6️⃣ Testing Fallback Logging System...');
    
    const mockError = {
      code: 'ETIMEDOUT',
      message: 'Network timeout during test'
    };
    
    const testContext = 'Fallback Logging Test';
    const testMessage = 'Test message for fallback logging';
    
    try {
      // Test fallback logging (this should not throw)
      this.telegramService.logToFallback(testMessage, mockError, testContext);
      console.log('   ✅ Fallback logging completed without errors');
      
      this.testResults.retryLogic = { success: true };
    } catch (error) {
      console.log('   ❌ Fallback logging failed:', error.message);
      this.testResults.retryLogic = { success: false, error: error.message };
    }
    
    console.log();
  }

  generateTestReport() {
    console.log('📊 TELEGRAM FIXES TEST REPORT');
    console.log('==========================================\n');
    
    const overallSuccess = Object.values(this.testResults).every(result => 
      result && (result.success !== false || result.graceful === true)
    );
    
    console.log('🎯 Overall Status:', overallSuccess ? '✅ FIXES WORKING' : '❌ ISSUES DETECTED');
    console.log();
    
    console.log('📋 Detailed Test Results:');
    
    // Basic Send
    const basicResult = this.testResults.basicSend;
    if (basicResult) {
      console.log(`   Health Check: ${basicResult.success ? '✅ PASSED' : '❌ FAILED'}`);
      if (!basicResult.success) {
        console.log(`      Error: ${basicResult.error}`);
        if (basicResult.suggestion) {
          console.log(`      Suggestion: ${basicResult.suggestion}`);
        }
      }
    }
    
    // Safe Send
    const safeResult = this.testResults.safeSend;
    if (safeResult) {
      console.log(`   Safe Message Sending: ${safeResult.success ? '✅ PASSED' : (safeResult.graceful ? '⚠️ GRACEFUL' : '❌ FAILED')}`);
      if (safeResult.critical) {
        console.log(`      🚨 CRITICAL: Safe method threw exception!`);
      }
    }
    
    // Graceful Notifications
    const gracefulResult = this.testResults.gracefulNotification;
    if (gracefulResult) {
      console.log(`   Graceful Notifications: ${gracefulResult.success ? '✅ PASSED' : (gracefulResult.graceful ? '⚠️ GRACEFUL' : '❌ FAILED')}`);
      if (gracefulResult.critical) {
        console.log(`      🚨 CRITICAL: Graceful method threw exception!`);
      }
    }
    
    // Error Handling
    const errorResult = this.testResults.errorHandling;
    if (errorResult) {
      console.log(`   Error Classification: ${errorResult.diagnosticsWorking ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`      Timeout Detection: ${errorResult.timeoutDetection ? '✅' : '❌'}`);
      console.log(`      Retry Logic: ${errorResult.timeoutRetryable ? '✅' : '❌'}`);
    }
    
    // Fallback Logging
    const fallbackResult = this.testResults.retryLogic;
    if (fallbackResult) {
      console.log(`   Fallback Logging: ${fallbackResult.success ? '✅ PASSED' : '❌ FAILED'}`);
    }
    
    console.log();
    
    // Recommendations
    this.generateRecommendations();
    
    console.log('🔧 Raw Test Data:');
    console.log(JSON.stringify(this.testResults, null, 2));
  }

  generateRecommendations() {
    console.log('💡 Recommendations:');
    
    const recommendations = [];
    
    if (this.testResults.basicSend && !this.testResults.basicSend.success) {
      recommendations.push('Run diagnostic tool: node tools/diagnose-telegram-connectivity.js');
      
      if (this.testResults.basicSend.code === 'ETIMEDOUT') {
        recommendations.push('Consider increasing TELEGRAM_REQUEST_TIMEOUT beyond 60 seconds');
        recommendations.push('Check network connectivity and firewall settings');
      }
    }
    
    if (this.testResults.safeSend && this.testResults.safeSend.critical) {
      recommendations.push('CRITICAL: Fix sendMessageSafe - it should never throw exceptions');
    }
    
    if (this.testResults.gracefulNotification && this.testResults.gracefulNotification.critical) {
      recommendations.push('CRITICAL: Fix sendNotificationSafe - it should never throw exceptions');
    }
    
    if (!this.testResults.errorHandling || !this.testResults.errorHandling.diagnosticsWorking) {
      recommendations.push('Fix error classification and diagnostic suggestion methods');
    }
    
    if (recommendations.length === 0) {
      console.log('   🎉 No issues found - Telegram fixes are working correctly!');
      console.log('   ✅ Workflow will continue even during network timeouts');
      console.log('   📱 Notifications provide graceful degradation');
      console.log('   🔍 Enhanced error diagnostics help with troubleshooting');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log();
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new TelegramFixTester();
  tester.runAllTests().catch(console.error);
}

export default TelegramFixTester;