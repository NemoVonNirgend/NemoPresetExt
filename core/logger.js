// Auto-generated from TypeScript - do not edit directly
import { CONSTANTS } from "./constants.js";
class Logger {
  prefix;
  level;
  startTime;
  constructor(prefix = "NemoPresetExt", level = CONSTANTS.LOG_LEVELS.INFO) {
    this.prefix = prefix;
    this.level = level;
    this.startTime = Date.now();
  }
  /**
   * Set the logging level
   */
  setLevel(level) {
    this.level = level;
  }
  /**
   * Enable or disable debug mode
   */
  setDebugMode(enabled) {
    this.level = enabled ? CONSTANTS.LOG_LEVELS.DEBUG : CONSTANTS.LOG_LEVELS.INFO;
  }
  /**
   * Format log message with timestamp and prefix
   */
  formatMessage(level, message, data) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().substring(11, 23);
    const prefix = `[${timestamp}] [${this.prefix}] [${level}]`;
    if (data !== void 0) {
      return [prefix, message, data];
    }
    return [prefix, message];
  }
  /**
   * Debug level logging - only shown in debug mode
   */
  debug(message, data) {
    if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
      const args = this.formatMessage("DEBUG", message, data);
      console.log(...args);
    }
  }
  /**
   * Info level logging - general information
   */
  info(message, data) {
    if (this.level <= CONSTANTS.LOG_LEVELS.INFO) {
      const args = this.formatMessage("INFO", message, data);
      console.log(...args);
    }
  }
  /**
   * Warning level logging - potential issues
   */
  warn(message, data) {
    if (this.level <= CONSTANTS.LOG_LEVELS.WARN) {
      const args = this.formatMessage("WARN", message, data);
      console.warn(...args);
    }
  }
  /**
   * Error level logging - actual errors
   */
  error(message, error) {
    if (this.level <= CONSTANTS.LOG_LEVELS.ERROR) {
      const args = this.formatMessage("ERROR", message, error);
      console.error(...args);
      if (error instanceof Error && error.stack) {
        console.error("Stack trace:", error.stack);
      }
    }
  }
  /**
   * Performance logging - measure execution time
   */
  async performance(label, fn) {
    if (!CONSTANTS.FEATURES.ENABLE_PERFORMANCE_MONITORING) {
      return await fn();
    }
    const start = performance.now();
    try {
      const result = await fn();
      const end = performance.now();
      this.debug(`Performance: ${label} took ${(end - start).toFixed(2)}ms`);
      return result;
    } catch (error) {
      const end = performance.now();
      this.error(`Performance: ${label} failed after ${(end - start).toFixed(2)}ms`, error);
      throw error;
    }
  }
  /**
   * Group related log messages
   */
  group(label, fn) {
    if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
      console.group(`[${this.prefix}] ${label}`);
      try {
        fn();
      } finally {
        console.groupEnd();
      }
    } else {
      fn();
    }
  }
  /**
   * Log table data (useful for arrays/objects)
   */
  table(data, label = "Data") {
    if (this.level <= CONSTANTS.LOG_LEVELS.DEBUG) {
      this.debug(`${label}:`);
      console.table(data);
    }
  }
  /**
   * Create a child logger with a specific module prefix
   */
  module(moduleName) {
    return new Logger(`${this.prefix}:${moduleName}`, this.level);
  }
}
const logger = new Logger();
if (CONSTANTS.FEATURES.ENABLE_DEBUG_MODE) {
  logger.setDebugMode(true);
}
var logger_default = logger;
export {
  Logger,
  logger_default as default
};
