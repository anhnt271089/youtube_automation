/**
 * Console Formatter Tests
 * 
 * Tests for the console formatter utility to ensure consistent
 * output formatting across the YouTube automation project.
 */

import { jest } from '@jest/globals';
import {
    formatHeader,
    formatSubHeader,
    formatStep,
    formatSuccess,
    formatError,
    formatWarning,
    formatInfo,
    formatDebug,
    formatSeparator,
    formatProgress,
    formatProcess,
    formatListItem,
    formatCompletion,
    formatWorkflowStage,
    formatTiming,
    formatTable,
    formatSummary,
    formatForLogger,
    stripColors,
    EMOJIS,
    COLORS
} from '../utils/consoleFormatter.js';

describe('Console Formatter', () => {
    describe('Basic Formatters', () => {
        test('formatHeader should format headers correctly', () => {
            const result = formatHeader('Test Header');
            expect(result).toContain('🚀');
            expect(result).toContain('TEST HEADER');
            expect(result).toContain('\n');
        });

        test('formatHeader with custom options', () => {
            const result = formatHeader('Custom Header', {
                emoji: '🎉',
                uppercase: false
            });
            expect(result).toContain('🎉');
            expect(result).toContain('Custom Header');
            expect(result).not.toContain('CUSTOM HEADER');
        });

        test('formatSuccess should format success messages', () => {
            const result = formatSuccess('Operation successful');
            expect(result).toContain('✅');
            expect(result).toContain('Operation successful');
        });

        test('formatError should format error messages', () => {
            const result = formatError('Operation failed');
            expect(result).toContain('❌');
            expect(result).toContain('Operation failed');
        });

        test('formatWarning should format warning messages', () => {
            const result = formatWarning('Rate limit reached');
            expect(result).toContain('⚠️');
            expect(result).toContain('Rate limit reached');
        });

        test('formatInfo should format info messages', () => {
            const result = formatInfo('Processing data');
            expect(result).toContain('📋');
            expect(result).toContain('Processing data');
        });

        test('formatDebug should format debug messages', () => {
            const result = formatDebug('Debug information');
            expect(result).toContain('🔧');
            expect(result).toContain('Debug information');
        });
    });

    describe('Workflow Formatters', () => {
        test('formatStep should format numbered steps', () => {
            const result = formatStep(1, 'Extract metadata');
            expect(result).toContain('📌');
            expect(result).toContain('Step 1:');
            expect(result).toContain('Extract metadata');
        });

        test('formatWorkflowStage should format stage headers', () => {
            const result = formatWorkflowStage('Processing');
            expect(result).toContain('PROCESSING');
            expect(result).toContain('➤');
            expect(result).toContain('---');
        });

        test('formatCompletion should format completion messages', () => {
            const result = formatCompletion('All tasks completed');
            expect(result).toContain('🎉');
            expect(result).toContain('All tasks completed');
            expect(result).toMatch(/^\n.*\n$/); // Should have newlines at start and end
        });
    });

    describe('Progress and Process Formatters', () => {
        test('formatProgress should format progress indicators', () => {
            const result = formatProgress(3, 10, 'Processing videos');
            expect(result).toContain('⏳');
            expect(result).toContain('Processing videos');
            expect(result).toContain('3/10');
            expect(result).toContain('30%');
        });

        test('formatProgress with custom options', () => {
            const result = formatProgress(5, 10, 'Custom task', {
                showBar: true,
                showPercentage: false
            });
            expect(result).toContain('Custom task');
            expect(result).toContain('[');
            expect(result).not.toContain('%');
        });

        test('formatProcess should format process status', () => {
            const result = formatProcess('Google Sheets', 'Connected');
            expect(result).toContain('🔄');
            expect(result).toContain('Google Sheets:');
            expect(result).toContain('Connected');
        });

        test('formatTiming should format timing information', () => {
            const resultMs = formatTiming(500);
            expect(resultMs).toContain('500ms');
            
            const resultSec = formatTiming(2500);
            expect(resultSec).toContain('2.50s');
            
            const resultMin = formatTiming(120000);
            expect(resultMin).toContain('2.00m');
        });
    });

    describe('Structure Formatters', () => {
        test('formatSeparator should create separators', () => {
            const result = formatSeparator(10, '-');
            expect(stripColors(result).trim()).toBe('----------');
            
            const longResult = formatSeparator(20, '=');
            expect(stripColors(longResult).trim()).toBe('====================');
        });

        test('formatListItem should format list items', () => {
            const result = formatListItem('List item text');
            expect(result).toContain('•');
            expect(result).toContain('List item text');
            expect(result).toContain('    '); // Should have indentation
        });

        test('formatTable should format data tables', () => {
            const data = [
                { name: 'John', age: 30, role: 'Developer' },
                { name: 'Jane', age: 25, role: 'Designer' }
            ];
            
            const result = formatTable(data);
            expect(result).toContain('name');
            expect(result).toContain('John');
            expect(result).toContain('Jane');
            expect(result).toContain('│');
        });

        test('formatSummary should create summary boxes', () => {
            const content = ['Line 1', 'Line 2', 'Line 3'];
            const result = formatSummary('Test Summary', content);
            
            expect(result).toContain('Test Summary');
            expect(result).toContain('Line 1');
            expect(result).toContain('Line 2');
            expect(result).toContain('Line 3');
            expect(result).toContain('┌');
            expect(result).toContain('└');
        });
    });

    describe('Utility Functions', () => {
        test('formatForLogger should create logger-compatible objects', () => {
            const result = formatForLogger('info', 'Test message', { extra: 'data' });
            
            expect(result).toHaveProperty('level', 'info');
            expect(result).toHaveProperty('message');
            expect(result.message).toContain('📋');
            expect(result.message).toContain('Test message');
            expect(result).toHaveProperty('extra', 'data');
        });

        test('stripColors should remove ANSI color codes', () => {
            const coloredText = '\x1b[31mRed text\x1b[0m';
            const result = stripColors(coloredText);
            expect(result).toBe('Red text');
            expect(result).not.toContain('\x1b');
        });
    });

    describe('Options and Customization', () => {
        test('indent option should add proper indentation', () => {
            const result = formatInfo('Indented message', { indent: 2 });
            expect(result).toMatch(/^        /); // 8 spaces (2 * 4)
        });

        test('custom emoji option should override defaults', () => {
            const result = formatSuccess('Custom success', { emoji: '🎊' });
            expect(result).toContain('🎊');
            expect(result).not.toContain('✅');
        });

        test('custom color option should be applied', () => {
            const result = formatInfo('Colored message', { color: COLORS.WARNING });
            expect(result).toContain(COLORS.WARNING);
        });
    });

    describe('Constants', () => {
        test('EMOJIS should contain expected emoji constants', () => {
            expect(EMOJIS.SUCCESS).toBe('✅');
            expect(EMOJIS.ERROR).toBe('❌');
            expect(EMOJIS.WARNING).toBe('⚠️');
            expect(EMOJIS.INFO).toBe('📋');
            expect(EMOJIS.PROCESSING).toBe('🔄');
        });

        test('COLORS should contain expected color constants', () => {
            expect(COLORS.SUCCESS).toBe('\x1b[32m');
            expect(COLORS.ERROR).toBe('\x1b[31m');
            expect(COLORS.WARNING).toBe('\x1b[33m');
            expect(COLORS.RESET).toBe('\x1b[0m');
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty strings gracefully', () => {
            expect(() => formatHeader('')).not.toThrow();
            expect(() => formatSuccess('')).not.toThrow();
            expect(() => formatError('')).not.toThrow();
        });

        test('should handle special characters in text', () => {
            const specialText = 'Text with "quotes" and \'apostrophes\' & symbols';
            const result = formatInfo(specialText);
            expect(result).toContain(specialText);
        });

        test('formatProgress should handle edge cases', () => {
            // Zero progress
            const zeroResult = formatProgress(0, 10, 'Starting');
            expect(zeroResult).toContain('0/10');
            expect(zeroResult).toContain('0%');

            // Complete progress  
            const completeResult = formatProgress(10, 10, 'Complete');
            expect(completeResult).toContain('10/10');
            expect(completeResult).toContain('100%');
        });

        test('formatTable should handle empty data', () => {
            const result = formatTable([]);
            expect(result).toBe('');
        });
    });

    describe('Integration Tests', () => {
        test('multiple formatters should work together', () => {
            const header = formatHeader('Test Workflow');
            const step = formatStep(1, 'Initialize');
            const success = formatSuccess('Initialization complete');
            const separator = formatSeparator(30);
            
            const combined = [header, step, success, separator].join('\n');
            
            expect(combined).toContain('TEST WORKFLOW');
            expect(combined).toContain('Step 1:');
            expect(combined).toContain('Initialization complete');
            expect(combined).toContain('==============================');
        });

        test('should maintain consistent emoji usage', () => {
            const successResult = formatSuccess('Test');
            const errorResult = formatError('Test');
            const warningResult = formatWarning('Test');
            
            expect(successResult).toContain(EMOJIS.SUCCESS);
            expect(errorResult).toContain(EMOJIS.ERROR);
            expect(warningResult).toContain(EMOJIS.WARNING);
        });
    });
});