#!/usr/bin/env node
/**
 * Comprehensive Telegram Bot API Diagnostic Tool
 * Tests connectivity, configuration, and identifies failure reasons
 */

import TelegramBot from 'node-telegram-bot-api';
import { config } from '../config/config.js';
import logger from '../src/utils/logger.js';

class TelegramDiagnostic {
  constructor() {
    this.results = {
      configCheck: null,
      connectivity: null,
      botInfo: null,
      chatAccess: null,
      messageTest: null,
      networkAnalysis: null
    };
  }

  async runFullDiagnostic() {
    console.log('🔍 Starting Comprehensive Telegram Diagnostic...\n');

    try {
      // 1. Configuration Check
      await this.checkConfiguration();
      
      // 2. Network Connectivity Test
      await this.testNetworkConnectivity();
      
      // 3. Bot Information Retrieval
      await this.getBotInfo();
      
      // 4. Chat Access Test
      await this.testChatAccess();
      
      // 5. Message Sending Test
      await this.testMessageSending();
      
      // 6. Network Analysis
      await this.performNetworkAnalysis();
      
      // 7. Generate Diagnostic Report
      this.generateReport();
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error.message);
      this.generateErrorReport(error);
    }
  }

  async checkConfiguration() {
    console.log('1️⃣ Checking Telegram Configuration...');
    
    const checks = {
      botToken: !!config.telegram.botToken,
      chatId: !!config.telegram.chatId,
      timeout: config.telegram.requestTimeout > 0,
      retries: config.telegram.maxRetries > 0,
      delay: config.telegram.retryDelay > 0
    };

    this.results.configCheck = checks;

    // Detailed validation
    if (!checks.botToken) {
      console.log('   ❌ Bot token missing');
    } else {
      console.log('   ✅ Bot token configured');
      // Basic token format validation
      if (!config.telegram.botToken.includes(':')) {
        console.log('   ⚠️  Bot token format seems invalid (should contain ":"');
      }
    }

    if (!checks.chatId) {
      console.log('   ❌ Chat ID missing');
    } else {
      console.log('   ✅ Chat ID configured:', config.telegram.chatId);
    }

    console.log('   📊 Timeout:', config.telegram.requestTimeout + 'ms');
    console.log('   🔄 Max Retries:', config.telegram.maxRetries);
    console.log('   ⏱️ Retry Delay:', config.telegram.retryDelay + 'ms');
    console.log();
  }

  async testNetworkConnectivity() {
    console.log('2️⃣ Testing Network Connectivity...');
    
    try {
      // Test basic HTTPS connectivity to Telegram API
      const https = await import('https');
      const { URL } = await import('url');
      
      const testUrl = new URL('https://api.telegram.org/bot' + config.telegram.botToken + '/getMe');
      
      const connectivityTest = new Promise((resolve, reject) => {
        const startTime = Date.now();
        const req = https.request(testUrl, {
          method: 'GET',
          timeout: 10000
        }, (res) => {
          const duration = Date.now() - startTime;
          resolve({
            success: true,
            statusCode: res.statusCode,
            duration: duration,
            headers: res.headers
          });
        });

        req.on('error', (error) => {
          reject({
            success: false,
            error: error.message,
            code: error.code,
            duration: Date.now() - startTime
          });
        });

        req.on('timeout', () => {
          req.destroy();
          reject({
            success: false,
            error: 'Request timeout',
            code: 'ETIMEDOUT',
            duration: Date.now() - startTime
          });
        });

        req.end();
      });

      const result = await connectivityTest;
      this.results.connectivity = result;
      
      if (result.success) {
        console.log('   ✅ Network connectivity OK');
        console.log('   📊 Response time:', result.duration + 'ms');
        console.log('   📋 Status code:', result.statusCode);
      }
    } catch (error) {
      this.results.connectivity = {
        success: false,
        error: error.message || error.error,
        code: error.code
      };
      console.log('   ❌ Network connectivity failed:', error.error || error.message);
      console.log('   🔍 Error code:', error.code);
    }
    console.log();
  }

  async getBotInfo() {
    console.log('3️⃣ Retrieving Bot Information...');
    
    if (!config.telegram.botToken) {
      console.log('   ❌ Skipped: No bot token configured');
      this.results.botInfo = { success: false, error: 'No bot token' };
      console.log();
      return;
    }

    try {
      const bot = new TelegramBot(config.telegram.botToken, { 
        polling: false,
        request: {
          timeout: 15000,
          forever: true,
          pool: { maxSockets: 5 }
        }
      });

      const botInfo = await bot.getMe();
      this.results.botInfo = { success: true, data: botInfo };
      
      console.log('   ✅ Bot info retrieved successfully');
      console.log('   🤖 Bot username:', '@' + botInfo.username);
      console.log('   📝 Bot name:', botInfo.first_name);
      console.log('   🆔 Bot ID:', botInfo.id);
      console.log('   🔑 Can join groups:', botInfo.can_join_groups);
      console.log('   💬 Can read messages:', botInfo.can_read_all_group_messages);
      console.log('   📎 Supports inline queries:', botInfo.supports_inline_queries);
      
    } catch (error) {
      this.results.botInfo = {
        success: false,
        error: error.message,
        code: error.code,
        response: error.response?.status
      };
      
      console.log('   ❌ Failed to get bot info:', error.message);
      if (error.code) console.log('   🔍 Error code:', error.code);
      if (error.response?.status) console.log('   📋 HTTP status:', error.response.status);
    }
    console.log();
  }

  async testChatAccess() {
    console.log('4️⃣ Testing Chat Access...');
    
    if (!config.telegram.botToken || !config.telegram.chatId) {
      console.log('   ❌ Skipped: Missing bot token or chat ID');
      this.results.chatAccess = { success: false, error: 'Missing configuration' };
      console.log();
      return;
    }

    try {
      const bot = new TelegramBot(config.telegram.botToken, { 
        polling: false,
        request: {
          timeout: 15000,
          forever: true,
          pool: { maxSockets: 5 }
        }
      });

      // Test chat access by getting chat information
      const chatInfo = await bot.getChat(config.telegram.chatId);
      this.results.chatAccess = { success: true, data: chatInfo };
      
      console.log('   ✅ Chat access verified');
      console.log('   💬 Chat type:', chatInfo.type);
      console.log('   📛 Chat title:', chatInfo.title || 'Private Chat');
      console.log('   🆔 Chat ID:', chatInfo.id);
      
      if (chatInfo.type === 'private') {
        console.log('   👤 Private chat with:', chatInfo.first_name, chatInfo.last_name || '');
        console.log('   📧 Username:', chatInfo.username ? '@' + chatInfo.username : 'No username');
      }
      
    } catch (error) {
      this.results.chatAccess = {
        success: false,
        error: error.message,
        code: error.code,
        response: error.response?.status
      };
      
      console.log('   ❌ Chat access failed:', error.message);
      if (error.code) console.log('   🔍 Error code:', error.code);
      if (error.response?.status) console.log('   📋 HTTP status:', error.response.status);
      
      // Specific error analysis
      if (error.message.includes('chat not found')) {
        console.log('   💡 Suggestion: Verify chat ID is correct and bot has been added to chat');
      } else if (error.message.includes('bot was blocked')) {
        console.log('   💡 Suggestion: Unblock the bot in your Telegram client');
      } else if (error.message.includes('Forbidden')) {
        console.log('   💡 Suggestion: Bot needs permission to access this chat');
      }
    }
    console.log();
  }

  async testMessageSending() {
    console.log('5️⃣ Testing Message Sending...');
    
    if (!config.telegram.botToken || !config.telegram.chatId) {
      console.log('   ❌ Skipped: Missing configuration');
      this.results.messageTest = { success: false, error: 'Missing configuration' };
      console.log();
      return;
    }

    try {
      const bot = new TelegramBot(config.telegram.botToken, { 
        polling: false,
        request: {
          timeout: 15000,
          forever: true,
          pool: { maxSockets: 5 }
        }
      });

      const timestamp = new Date().toISOString();
      const testMessage = `🔍 <b>Telegram Diagnostic Test</b>\n\n⏰ <b>Time:</b> ${timestamp}\n✅ <b>Status:</b> Connection test successful\n\n<i>This is an automated diagnostic message.</i>`;
      
      const messageResult = await bot.sendMessage(config.telegram.chatId, testMessage, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });

      this.results.messageTest = { 
        success: true, 
        data: {
          messageId: messageResult.message_id,
          date: messageResult.date,
          text: messageResult.text
        }
      };
      
      console.log('   ✅ Test message sent successfully');
      console.log('   📨 Message ID:', messageResult.message_id);
      console.log('   📅 Sent at:', new Date(messageResult.date * 1000).toISOString());
      
    } catch (error) {
      this.results.messageTest = {
        success: false,
        error: error.message,
        code: error.code,
        response: error.response?.status,
        responseData: error.response?.data
      };
      
      console.log('   ❌ Message sending failed:', error.message);
      if (error.code) console.log('   🔍 Error code:', error.code);
      if (error.response?.status) console.log('   📋 HTTP status:', error.response.status);
      if (error.response?.data) console.log('   📄 Response data:', JSON.stringify(error.response.data, null, 2));
    }
    console.log();
  }

  async performNetworkAnalysis() {
    console.log('6️⃣ Network Analysis...');
    
    try {
      const dns = await import('dns').then(m => m.promises);
      const net = await import('net');
      
      // DNS resolution test
      const dnsTest = await dns.lookup('api.telegram.org');
      console.log('   🌐 DNS Resolution: ✅', dnsTest.address);
      
      // Port connectivity test
      const portTest = new Promise((resolve) => {
        const socket = net.createConnection(443, 'api.telegram.org');
        const timeout = setTimeout(() => {
          socket.destroy();
          resolve({ success: false, error: 'Connection timeout' });
        }, 5000);
        
        socket.on('connect', () => {
          clearTimeout(timeout);
          socket.destroy();
          resolve({ success: true });
        });
        
        socket.on('error', (error) => {
          clearTimeout(timeout);
          resolve({ success: false, error: error.message });
        });
      });
      
      const portResult = await portTest;
      if (portResult.success) {
        console.log('   🔌 Port 443 (HTTPS): ✅ Accessible');
      } else {
        console.log('   🔌 Port 443 (HTTPS): ❌', portResult.error);
      }
      
      this.results.networkAnalysis = {
        dns: { success: true, address: dnsTest.address },
        port443: portResult
      };
      
    } catch (error) {
      console.log('   ❌ Network analysis failed:', error.message);
      this.results.networkAnalysis = {
        dns: { success: false, error: error.message },
        port443: { success: false, error: 'Test failed' }
      };
    }
    console.log();
  }

  generateReport() {
    console.log('📊 DIAGNOSTIC REPORT');
    console.log('==========================================\n');
    
    // Overall Status
    const overallSuccess = Object.values(this.results).every(result => 
      result && (result.success !== false)
    );
    
    console.log('🎯 Overall Status:', overallSuccess ? '✅ HEALTHY' : '❌ ISSUES DETECTED');
    console.log();
    
    // Detailed Results
    console.log('📋 Detailed Results:');
    
    // Configuration
    if (this.results.configCheck) {
      const configOk = Object.values(this.results.configCheck).every(Boolean);
      console.log(`   Configuration: ${configOk ? '✅' : '❌'}`);
    }
    
    // Network
    if (this.results.connectivity) {
      console.log(`   Network Connectivity: ${this.results.connectivity.success ? '✅' : '❌'}`);
    }
    
    // Bot Info
    if (this.results.botInfo) {
      console.log(`   Bot Information: ${this.results.botInfo.success ? '✅' : '❌'}`);
    }
    
    // Chat Access
    if (this.results.chatAccess) {
      console.log(`   Chat Access: ${this.results.chatAccess.success ? '✅' : '❌'}`);
    }
    
    // Message Sending
    if (this.results.messageTest) {
      console.log(`   Message Sending: ${this.results.messageTest.success ? '✅' : '❌'}`);
    }
    
    console.log();
    
    // Recommendations
    this.generateRecommendations();
    
    // Raw results for debugging
    console.log('🔧 Raw Diagnostic Data:');
    console.log(JSON.stringify(this.results, null, 2));
  }

  generateRecommendations() {
    console.log('💡 Recommendations:');
    
    const recommendations = [];
    
    // Configuration issues
    if (this.results.configCheck) {
      if (!this.results.configCheck.botToken) {
        recommendations.push('Set TELEGRAM_BOT_TOKEN in your .env file');
      }
      if (!this.results.configCheck.chatId) {
        recommendations.push('Set TELEGRAM_CHAT_ID in your .env file');
      }
    }
    
    // Network issues
    if (this.results.connectivity && !this.results.connectivity.success) {
      if (this.results.connectivity.code === 'ETIMEDOUT') {
        recommendations.push('Increase TELEGRAM_REQUEST_TIMEOUT (current: ' + config.telegram.requestTimeout + 'ms)');
        recommendations.push('Check firewall settings - Telegram may be blocked');
      } else if (this.results.connectivity.code === 'ENOTFOUND') {
        recommendations.push('Check DNS settings - cannot resolve api.telegram.org');
      } else if (this.results.connectivity.code === 'ECONNREFUSED') {
        recommendations.push('Check proxy settings or network restrictions');
      }
    }
    
    // Bot access issues
    if (this.results.botInfo && !this.results.botInfo.success) {
      if (this.results.botInfo.response === 401) {
        recommendations.push('Bot token is invalid - check TELEGRAM_BOT_TOKEN');
      } else if (this.results.botInfo.response === 404) {
        recommendations.push('Bot not found - verify bot token format');
      }
    }
    
    // Chat access issues
    if (this.results.chatAccess && !this.results.chatAccess.success) {
      if (this.results.chatAccess.error.includes('chat not found')) {
        recommendations.push('Verify TELEGRAM_CHAT_ID is correct');
        recommendations.push('Ensure bot has been added to the chat/group');
      } else if (this.results.chatAccess.error.includes('Forbidden')) {
        recommendations.push('Bot lacks permissions - check admin settings');
      }
    }
    
    // Message sending issues
    if (this.results.messageTest && !this.results.messageTest.success) {
      if (this.results.messageTest.error.includes('bot was blocked')) {
        recommendations.push('Unblock the bot in your Telegram client');
      } else if (this.results.messageTest.response === 429) {
        recommendations.push('Rate limited - reduce message frequency');
      }
    }
    
    if (recommendations.length === 0) {
      console.log('   🎉 No issues found - Telegram integration should work correctly!');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }
    
    console.log();
  }

  generateErrorReport(error) {
    console.log('❌ DIAGNOSTIC ERROR REPORT');
    console.log('==========================================');
    console.log('Error:', error.message);
    console.log('Stack:', error.stack);
    console.log('Partial Results:', JSON.stringify(this.results, null, 2));
  }
}

// Run diagnostic if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const diagnostic = new TelegramDiagnostic();
  diagnostic.runFullDiagnostic().catch(console.error);
}

export default TelegramDiagnostic;