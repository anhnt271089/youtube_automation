#!/usr/bin/env node

/**
 * Network Diagnostic Tool for YouTube Automation System
 * 
 * This tool diagnoses network connectivity issues, particularly
 * with Telegram API timeouts and other external service calls.
 */

import { config } from '../config/config.js';
import TelegramService from '../src/services/telegramService.js';
import logger from '../src/utils/logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class NetworkDiagnostic {
  constructor() {
    this.telegramService = new TelegramService();
    this.results = {
      timestamp: new Date().toISOString(),
      tests: {},
      summary: {
        passed: 0,
        failed: 0,
        total: 0
      }
    };
  }

  async runTest(testName, testFunction) {
    try {
      logger.info(`🔍 Running test: ${testName}`);
      const startTime = Date.now();
      
      const result = await testFunction();
      const duration = Date.now() - startTime;
      
      this.results.tests[testName] = {
        status: 'PASS',
        duration: `${duration}ms`,
        result,
        timestamp: new Date().toISOString()
      };
      
      this.results.summary.passed++;
      logger.info(`✅ ${testName}: PASS (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - Date.now();
      
      this.results.tests[testName] = {
        status: 'FAIL',
        error: error.message,
        code: error.code,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      };
      
      this.results.summary.failed++;
      logger.error(`❌ ${testName}: FAIL - ${error.message}`);
    }
    
    this.results.summary.total++;
  }

  async testDNSResolution() {
    const domains = [
      'api.telegram.org',
      'youtube.googleapis.com', 
      'sheets.googleapis.com',
      'drive.googleapis.com',
      'api.openai.com',
      'api.anthropic.com'
    ];

    const results = {};
    
    for (const domain of domains) {
      try {
        const { stdout } = await execAsync(`nslookup ${domain}`);
        const ips = stdout.match(/Address: (\d+\.\d+\.\d+\.\d+)/g);
        results[domain] = {
          status: 'resolved',
          ips: ips ? ips.map(ip => ip.replace('Address: ', '')) : []
        };
      } catch (error) {
        results[domain] = {
          status: 'failed',
          error: error.message
        };
      }
    }
    
    return results;
  }

  async testTelegramConnectivity() {
    // Test specific IPs that are known Telegram servers
    const telegramIPs = [
      '149.154.167.220',
      '149.154.167.51',
      '149.154.175.100'
    ];

    const results = {};
    
    for (const ip of telegramIPs) {
      try {
        // Test HTTPS connectivity
        const { stdout, stderr } = await execAsync(`curl -s --connect-timeout 10 --max-time 30 -I https://${ip}:443 || echo "FAILED"`);
        results[ip] = {
          status: stdout.includes('FAILED') ? 'unreachable' : 'reachable',
          response: stdout.split('\n')[0] || 'No response'
        };
      } catch (error) {
        results[ip] = {
          status: 'error',
          error: error.message
        };
      }
    }
    
    return results;
  }

  async testTelegramAPI() {
    const tests = [];
    
    // Test 1: Basic bot info (lightweight)
    tests.push(async () => {
      const botInfo = await this.telegramService.bot.getMe();
      return {
        username: botInfo.username,
        id: botInfo.id,
        can_read_all_group_messages: botInfo.can_read_all_group_messages
      };
    });
    
    // Test 2: Send test message with retry logic
    tests.push(async () => {
      const testMessage = `🔍 <b>Network Diagnostic Test</b>

📅 ${new Date().toLocaleString()}
🤖 Testing network connectivity and retry logic
⚡ This message tests Telegram API resilience

<i>If you receive this, the network fixes are working!</i>`;
      
      const response = await this.telegramService.sendMessage(testMessage);
      return {
        message_id: response.message_id,
        sent_successfully: true
      };
    });
    
    const results = {};
    for (let i = 0; i < tests.length; i++) {
      try {
        const startTime = Date.now();
        const result = await tests[i]();
        const duration = Date.now() - startTime;
        
        results[`test_${i + 1}`] = {
          status: 'success',
          duration: `${duration}ms`,
          result
        };
      } catch (error) {
        results[`test_${i + 1}`] = {
          status: 'failed',
          error: error.message,
          code: error.code,
          isNetworkError: this.telegramService.isNetworkError(error)
        };
      }
    }
    
    return results;
  }

  async testNetworkLatency() {
    const hosts = [
      'api.telegram.org',
      'youtube.googleapis.com',
      'api.openai.com'
    ];

    const results = {};
    
    for (const host of hosts) {
      try {
        const { stdout } = await execAsync(`ping -c 4 ${host}`);
        const avgTime = stdout.match(/avg = ([\d.]+)/);
        const packetLoss = stdout.match(/(\d+)% packet loss/);
        
        results[host] = {
          status: 'success',
          avg_latency: avgTime ? `${avgTime[1]}ms` : 'unknown',
          packet_loss: packetLoss ? `${packetLoss[1]}%` : '0%',
          raw_output: stdout.split('\n').slice(-2, -1)[0]
        };
      } catch (error) {
        results[host] = {
          status: 'failed',
          error: error.message
        };
      }
    }
    
    return results;
  }

  async testConfigurationValues() {
    return {
      telegram: {
        requestTimeout: config.telegram.requestTimeout,
        maxRetries: config.telegram.maxRetries,
        retryDelay: config.telegram.retryDelay,
        botTokenExists: !!config.telegram.botToken,
        chatIdExists: !!config.telegram.chatId
      },
      environment: {
        nodeEnv: config.app.nodeEnv,
        timezone: config.app.timezone
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: `${Math.floor(process.uptime())}s`
      }
    };
  }

  async runAllTests() {
    logger.info('🚀 Starting Network Diagnostic Tests...');
    logger.info('=' .repeat(60));
    
    await this.runTest('DNS Resolution', () => this.testDNSResolution());
    await this.runTest('Telegram IP Connectivity', () => this.testTelegramConnectivity());
    await this.runTest('Network Latency', () => this.testNetworkLatency());
    await this.runTest('Configuration Values', () => this.testConfigurationValues());
    await this.runTest('Telegram API', () => this.testTelegramAPI());
    
    logger.info('=' .repeat(60));
    logger.info(`📊 Test Summary: ${this.results.summary.passed}/${this.results.summary.total} passed`);
    
    if (this.results.summary.failed > 0) {
      logger.warn(`⚠️  ${this.results.summary.failed} tests failed - check results for details`);
    } else {
      logger.info('✅ All tests passed - network connectivity looks good!');
    }
    
    return this.results;
  }

  generateReport() {
    const report = {
      ...this.results,
      recommendations: this.generateRecommendations()
    };
    
    return JSON.stringify(report, null, 2);
  }

  generateRecommendations() {
    const recommendations = [];
    const tests = this.results.tests;
    
    if (tests['Telegram API']?.status === 'FAIL') {
      recommendations.push({
        priority: 'HIGH',
        issue: 'Telegram API connectivity failed',
        solution: 'Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables'
      });
    }
    
    if (tests['DNS Resolution']?.result) {
      const dnsResults = tests['DNS Resolution'].result;
      const failedDomains = Object.entries(dnsResults)
        .filter(([_, result]) => result.status === 'failed')
        .map(([domain, _]) => domain);
        
      if (failedDomains.length > 0) {
        recommendations.push({
          priority: 'MEDIUM',
          issue: `DNS resolution failed for: ${failedDomains.join(', ')}`,
          solution: 'Check internet connectivity and DNS settings'
        });
      }
    }
    
    if (tests['Network Latency']?.result) {
      const latencyResults = tests['Network Latency'].result;
      const highLatency = Object.entries(latencyResults)
        .filter(([_, result]) => {
          if (result.avg_latency) {
            const latencyMs = parseFloat(result.avg_latency);
            return latencyMs > 1000; // > 1 second
          }
          return false;
        });
        
      if (highLatency.length > 0) {
        recommendations.push({
          priority: 'MEDIUM',
          issue: 'High network latency detected',
          solution: 'Consider increasing timeout values if experiencing frequent timeouts'
        });
      }
    }
    
    return recommendations;
  }
}

// Main execution
async function main() {
  try {
    const diagnostic = new NetworkDiagnostic();
    const results = await diagnostic.runAllTests();
    
    // Save detailed report
    const report = diagnostic.generateReport();
    const fs = await import('fs');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = `./logs/network-diagnostic-${timestamp}.json`;
    
    fs.writeFileSync(reportPath, report);
    logger.info(`📄 Detailed report saved to: ${reportPath}`);
    
    // Quick summary
    if (results.summary.failed === 0) {
      logger.info('🎉 Network diagnostic completed successfully - no issues detected!');
      process.exit(0);
    } else {
      logger.error(`🚨 Network diagnostic found ${results.summary.failed} issues - check the report for details`);
      process.exit(1);
    }
    
  } catch (error) {
    logger.error('Failed to run network diagnostic:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default NetworkDiagnostic;