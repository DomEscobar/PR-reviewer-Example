import { access, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { RateLimitState, RateLimitConfig } from './types.js';
import logger from './logger.js';

const DEFAULT_CONFIG: RateLimitConfig = {
  maxReviewsPerHour: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
};

export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly stateFile: string;
  private state: RateLimitState;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateFile = join(process.env.XDG_CACHE_HOME || '/tmp', 'pr-reviewer-rate-limit.json');
    this.state = { reviews: [], lastReset: Date.now() };
  }

  async initialize(): Promise<void> {
    try {
      const data = await readFile(this.stateFile, 'utf-8');
      this.state = JSON.parse(data);
    } catch {
      // No existing state, use defaults
      await this.saveState();
    }
  }

  async canProceed(repo: string): Promise<boolean> {
    await this.initialize();
    
    const now = Date.now();
    this.state = {
      reviews: this.state.reviews.filter(t => now - t < this.config.windowMs),
      lastReset: this.state.lastReset,
    };

    if (this.state.reviews.length >= this.config.maxReviewsPerHour) {
      const oldestReview = Math.min(...this.state.reviews);
      const retryAfterMs = this.config.windowMs - (now - oldestReview);
      
      logger.warn('Rate limit exceeded', {
        repo,
        reviewsInWindow: this.state.reviews.length,
        maxAllowed: this.config.maxReviewsPerHour,
        retryAfterMs,
      });
      
      return false;
    }

    return true;
  }

  async recordReview(): Promise<void> {
    this.state = {
      ...this.state,
      reviews: [...this.state.reviews, Date.now()],
    };
    await this.saveState();
    
    logger.info('Review recorded for rate limiting', {
      totalReviews: this.state.reviews.length,
      remaining: this.config.maxReviewsPerHour - this.state.reviews.length,
    });
  }

  private async saveState(): Promise<void> {
    try {
      const dir = join(this.stateFile, '..');
      await mkdir(dir, { recursive: true });
      await writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (error) {
      logger.error('Failed to save rate limit state', error as Error);
    }
  }
}

export const rateLimiter = new RateLimiter();
