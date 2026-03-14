import type { Logger } from './types.js';

class ConsoleLogger implements Logger {
  private readonly context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.context}] ${message}`;
  }
  
  debug(message: string, data?: Record<string, unknown>): void {
    if (process.env.DEBUG === '1' || process.env.LOG_LEVEL === 'debug') {
      console.debug(this.formatMessage('DEBUG', message), data ?? '');
    }
  }
  
  info(message: string, data?: Record<string, unknown>): void {
    console.info(this.formatMessage('INFO', message), data ?? '');
  }
  
  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(this.formatMessage('WARN', message), data ?? '');
  }
  
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    const errorData = error ? { 
      error: error.message, 
      stack: error.stack,
      ...data 
    } : data;
    console.error(this.formatMessage('ERROR', message), errorData ?? '');
  }
  
  child(context: string): Logger {
    return new ConsoleLogger(`${this.context}:${context}`);
  }
}

export const logger = new ConsoleLogger('pr-reviewer');
export default logger;
