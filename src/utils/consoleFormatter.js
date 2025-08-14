/**
 * Console Formatter Utility
 * 
 * Standardizes all console output formatting across the YouTube automation project.
 * Provides consistent styling, spacing, colors, and emoji usage for better readability.
 * 
 * Features:
 * - Consistent emoji usage and spacing
 * - Proper indentation (4 spaces)
 * - Color support using winston colorize when available
 * - Configurable separator styles
 * - Progress indicators
 * - Integration with existing logger system
 * 
 * Usage:
 * import { formatHeader, formatSuccess, formatError } from '../utils/consoleFormatter.js';
 * 
 * console.log(formatHeader('Main Process Started'));
 * console.log(formatSuccess('Operation completed successfully'));
 * console.log(formatError('Something went wrong'));
 */

import winston from 'winston';

// Emoji constants for consistent usage across the project
export const EMOJIS = {
    // Status indicators
    SUCCESS: '✅',
    ERROR: '❌', 
    WARNING: '⚠️',
    INFO: '📋',
    DEBUG: '🔧',
    PROGRESS: '⏳',
    COMPLETED: '🎉',
    
    // Process indicators  
    PROCESSING: '🔄',
    GENERATING: '🔨',
    ANALYZING: '🧪',
    VALIDATING: '🔍',
    FIXING: '🔧',
    TESTING: '🧪',
    
    // Workflow stages
    START: '🚀',
    STEP: '📌',
    ARROW: '➤',
    BULLET: '•',
    
    // Media & Content
    VIDEO: '🎬',
    IMAGE: '🖼️',
    SCRIPT: '📝',
    THUMBNAIL: '🖼️',
    AUDIO: '🎵',
    
    // Services & APIs
    GOOGLE: '📊',
    TELEGRAM: '📱',
    AI: '🤖',
    LEONARDO: '🎨',
    CLAUDE: '🧠',
    
    // File operations
    SAVE: '💾',
    UPLOAD: '☁️',
    DOWNLOAD: '⬇️',
    DELETE: '🗑️',
    
    // System
    CONFIG: '⚙️',
    LOCK: '🔒',
    UNLOCK: '🔓',
    CACHE: '💾',
    NETWORK: '🌐'
};

// Color constants for consistent theming
export const COLORS = {
    PRIMARY: '\x1b[36m',    // Cyan
    SUCCESS: '\x1b[32m',    // Green  
    ERROR: '\x1b[31m',      // Red
    WARNING: '\x1b[33m',    // Yellow
    INFO: '\x1b[34m',       // Blue
    DEBUG: '\x1b[35m',      // Magenta
    BOLD: '\x1b[1m',        // Bold
    DIM: '\x1b[2m',         // Dim
    RESET: '\x1b[0m'        // Reset
};

// Base indentation unit (4 spaces as per project standards)
const INDENT = '    ';

/**
 * Creates a formatted header with consistent styling
 * @param {string} text - Header text
 * @param {Object} options - Formatting options
 * @param {string} options.emoji - Custom emoji (default: 🚀)
 * @param {boolean} options.bold - Make text bold (default: true)
 * @param {boolean} options.uppercase - Convert to uppercase (default: true)
 * @param {string} options.color - Color code (default: PRIMARY)
 * @returns {string} Formatted header
 */
export function formatHeader(text, options = {}) {
    const {
        emoji = EMOJIS.START,
        bold = true,
        uppercase = true,
        color = COLORS.PRIMARY
    } = options;
    
    const displayText = uppercase ? text.toUpperCase() : text;
    const coloredText = bold ? 
        `${color}${COLORS.BOLD}${displayText}${COLORS.RESET}` : 
        `${color}${displayText}${COLORS.RESET}`;
    
    return `\n${emoji} ${coloredText}`;
}

/**
 * Creates a formatted sub-header
 * @param {string} text - Sub-header text  
 * @param {Object} options - Formatting options
 * @returns {string} Formatted sub-header
 */
export function formatSubHeader(text, options = {}) {
    const {
        emoji = EMOJIS.ARROW,
        color = COLORS.INFO,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${text}${COLORS.RESET}`;
}

/**
 * Creates a formatted numbered step
 * @param {number} stepNumber - Step number
 * @param {string} description - Step description
 * @param {Object} options - Formatting options
 * @returns {string} Formatted step
 */
export function formatStep(stepNumber, description, options = {}) {
    const {
        emoji = EMOJIS.STEP,
        color = COLORS.INFO,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}Step ${stepNumber}:${COLORS.RESET} ${description}`;
}

/**
 * Creates a formatted success message
 * @param {string} message - Success message
 * @param {Object} options - Formatting options
 * @returns {string} Formatted success message
 */
export function formatSuccess(message, options = {}) {
    const {
        emoji = EMOJIS.SUCCESS,
        color = COLORS.SUCCESS,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${message}${COLORS.RESET}`;
}

/**
 * Creates a formatted error message
 * @param {string} message - Error message
 * @param {Object} options - Formatting options
 * @returns {string} Formatted error message
 */
export function formatError(message, options = {}) {
    const {
        emoji = EMOJIS.ERROR,
        color = COLORS.ERROR,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${message}${COLORS.RESET}`;
}

/**
 * Creates a formatted warning message
 * @param {string} message - Warning message
 * @param {Object} options - Formatting options
 * @returns {string} Formatted warning message
 */
export function formatWarning(message, options = {}) {
    const {
        emoji = EMOJIS.WARNING,
        color = COLORS.WARNING,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${message}${COLORS.RESET}`;
}

/**
 * Creates a formatted info message
 * @param {string} message - Info message
 * @param {Object} options - Formatting options
 * @returns {string} Formatted info message
 */
export function formatInfo(message, options = {}) {
    const {
        emoji = EMOJIS.INFO,
        color = COLORS.INFO,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${message}${COLORS.RESET}`;
}

/**
 * Creates a formatted debug message
 * @param {string} message - Debug message
 * @param {Object} options - Formatting options
 * @returns {string} Formatted debug message
 */
export function formatDebug(message, options = {}) {
    const {
        emoji = EMOJIS.DEBUG,
        color = COLORS.DEBUG,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${message}${COLORS.RESET}`;
}

/**
 * Creates a consistent separator line
 * @param {number} length - Length of separator (default: 50)
 * @param {string} character - Character to use (default: '=')
 * @param {Object} options - Formatting options
 * @returns {string} Formatted separator
 */
export function formatSeparator(length = 50, character = '=', options = {}) {
    const {
        color = COLORS.DIM,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    const separator = character.repeat(length);
    return `${indentation}${color}${separator}${COLORS.RESET}`;
}

/**
 * Creates a formatted progress indicator
 * @param {number} current - Current progress
 * @param {number} total - Total items
 * @param {string} description - Progress description
 * @param {Object} options - Formatting options
 * @returns {string} Formatted progress
 */
export function formatProgress(current, total, description, options = {}) {
    const {
        emoji = EMOJIS.PROGRESS,
        color = COLORS.INFO,
        indent = 0,
        showPercentage = true,
        showBar = true,
        barLength = 20
    } = options;
    
    const indentation = INDENT.repeat(indent);
    const percentage = Math.round((current / total) * 100);
    
    let progressText = `${emoji} ${color}${description}${COLORS.RESET}`;
    
    if (showBar) {
        const filled = Math.round((current / total) * barLength);
        const empty = barLength - filled;
        const bar = `[${'█'.repeat(filled)}${'.'.repeat(empty)}]`;
        progressText += ` ${color}${bar}${COLORS.RESET}`;
    }
    
    if (showPercentage) {
        progressText += ` ${color}${current}/${total} (${percentage}%)${COLORS.RESET}`;
    }
    
    return `${indentation}${progressText}`;
}

/**
 * Creates a formatted process status message
 * @param {string} process - Process name
 * @param {string} status - Status description
 * @param {Object} options - Formatting options
 * @returns {string} Formatted process status
 */
export function formatProcess(process, status, options = {}) {
    const {
        emoji = EMOJIS.PROCESSING,
        color = COLORS.INFO,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${emoji} ${color}${process}:${COLORS.RESET} ${status}`;
}

/**
 * Creates a formatted list item
 * @param {string} text - List item text
 * @param {Object} options - Formatting options
 * @returns {string} Formatted list item
 */
export function formatListItem(text, options = {}) {
    const {
        bullet = EMOJIS.BULLET,
        color = COLORS.RESET,
        indent = 1
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `${indentation}${bullet} ${color}${text}${COLORS.RESET}`;
}

/**
 * Creates a formatted completion message
 * @param {string} message - Completion message
 * @param {Object} options - Formatting options
 * @returns {string} Formatted completion message
 */
export function formatCompletion(message, options = {}) {
    const {
        emoji = EMOJIS.COMPLETED,
        color = COLORS.SUCCESS,
        indent = 0
    } = options;
    
    const indentation = INDENT.repeat(indent);
    return `\n${indentation}${emoji} ${color}${COLORS.BOLD}${message}${COLORS.RESET}\n`;
}

/**
 * Creates a formatted workflow stage header
 * @param {string} stage - Workflow stage name
 * @param {Object} options - Formatting options
 * @returns {string} Formatted workflow stage
 */
export function formatWorkflowStage(stage, options = {}) {
    const {
        emoji = EMOJIS.ARROW,
        color = COLORS.PRIMARY
    } = options;
    
    const separator = formatSeparator(40, '-', { color: COLORS.DIM });
    const header = `${emoji} ${color}${COLORS.BOLD}${stage.toUpperCase()}${COLORS.RESET}`;
    
    return `\n${separator}\n${header}\n${separator}`;
}

/**
 * Creates formatted timing information
 * @param {number} duration - Duration in milliseconds
 * @param {Object} options - Formatting options
 * @returns {string} Formatted timing
 */
export function formatTiming(duration, options = {}) {
    const {
        emoji = '⏱️',
        color = COLORS.DIM,
        indent = 0,
        unit = 'auto'
    } = options;
    
    const indentation = INDENT.repeat(indent);
    let timeText;
    
    if (unit === 'auto') {
        if (duration < 1000) {
            timeText = `${duration}ms`;
        } else if (duration < 60000) {
            timeText = `${(duration / 1000).toFixed(2)}s`;
        } else {
            timeText = `${(duration / 60000).toFixed(2)}m`;
        }
    } else {
        timeText = `${duration}${unit}`;
    }
    
    return `${indentation}${emoji} ${color}Completed in ${timeText}${COLORS.RESET}`;
}

/**
 * Logger integration helper - formats message for winston logger
 * @param {string} level - Log level (info, error, warn, debug)
 * @param {string} message - Message to log
 * @param {Object} meta - Additional metadata
 * @returns {Object} Formatted log object
 */
export function formatForLogger(level, message, meta = {}) {
    const levelEmojiMap = {
        error: EMOJIS.ERROR,
        warn: EMOJIS.WARNING,
        info: EMOJIS.INFO,
        debug: EMOJIS.DEBUG
    };
    
    const emoji = levelEmojiMap[level] || EMOJIS.INFO;
    const formattedMessage = `${emoji} ${message}`;
    
    return {
        level,
        message: formattedMessage,
        ...meta
    };
}

/**
 * Utility to remove color codes from text (for file logging)
 * @param {string} text - Text with color codes
 * @returns {string} Clean text without color codes
 */
export function stripColors(text) {
    // Remove ANSI color codes
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Creates a formatted table-like structure
 * @param {Array} data - Array of objects with consistent keys
 * @param {Object} options - Formatting options
 * @returns {string} Formatted table
 */
export function formatTable(data, options = {}) {
    const {
        indent = 0,
        headers = true,
        separator = '│',
        color = COLORS.RESET
    } = options;
    
    if (!data || data.length === 0) return '';
    
    const indentation = INDENT.repeat(indent);
    const keys = Object.keys(data[0]);
    const colWidths = {};
    
    // Calculate column widths
    keys.forEach(key => {
        colWidths[key] = Math.max(
            key.length,
            ...data.map(row => String(row[key] || '').length)
        );
    });
    
    let result = '';
    
    // Add headers if requested
    if (headers) {
        const headerRow = keys.map(key => 
            key.padEnd(colWidths[key])
        ).join(` ${separator} `);
        
        result += `${indentation}${color}${headerRow}${COLORS.RESET}\n`;
        
        // Add separator line
        const separatorRow = keys.map(key => 
            '-'.repeat(colWidths[key])
        ).join(`-${separator}-`);
        
        result += `${indentation}${color}${separatorRow}${COLORS.RESET}\n`;
    }
    
    // Add data rows
    data.forEach(row => {
        const dataRow = keys.map(key => 
            String(row[key] || '').padEnd(colWidths[key])
        ).join(` ${separator} `);
        
        result += `${indentation}${color}${dataRow}${COLORS.RESET}\n`;
    });
    
    return result;
}

/**
 * Creates a formatted summary box
 * @param {string} title - Summary title
 * @param {Array|Object} content - Summary content
 * @param {Object} options - Formatting options
 * @returns {string} Formatted summary box
 */
export function formatSummary(title, content, options = {}) {
    const {
        emoji = EMOJIS.INFO,
        color = COLORS.INFO,
        indent = 0,
        width = 60
    } = options;
    
    const indentation = INDENT.repeat(indent);
    const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
    const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
    
    let result = `\n${indentation}${color}${topBorder}${COLORS.RESET}\n`;
    
    // Title
    const titleText = `${emoji} ${title}`;
    const titlePadding = Math.max(0, width - titleText.length - 4);
    result += `${indentation}${color}│ ${titleText}${' '.repeat(titlePadding)} │${COLORS.RESET}\n`;
    
    // Separator
    const separator = '├' + '─'.repeat(width - 2) + '┤';
    result += `${indentation}${color}${separator}${COLORS.RESET}\n`;
    
    // Content
    const contentLines = Array.isArray(content) ? content : [content];
    contentLines.forEach(line => {
        const cleanLine = String(line);
        const linePadding = Math.max(0, width - cleanLine.length - 4);
        result += `${indentation}${color}│ ${cleanLine}${' '.repeat(linePadding)} │${COLORS.RESET}\n`;
    });
    
    result += `${indentation}${color}${bottomBorder}${COLORS.RESET}\n`;
    
    return result;
}

// Export all formatters as a single object for convenience
export const ConsoleFormatter = {
    // Basic formatters
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
    
    // Utility functions
    formatForLogger,
    stripColors,
    
    // Constants
    EMOJIS,
    COLORS
};

export default ConsoleFormatter;