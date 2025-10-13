/**
 * Simple logger stub for adapters
 */

export default {
  debug: (...args: any[]) => {
    // Optionally log to stderr for debugging
    // console.error('[DEBUG]', ...args);
  },
  verbose: (...args: any[]) => {
    // Optionally log to stderr for debugging
    // console.error('[VERBOSE]', ...args);
  },
  info: (...args: any[]) => {
    console.error('[INFO]', ...args);
  },
  warn: (...args: any[]) => {
    console.error('[WARN]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};

