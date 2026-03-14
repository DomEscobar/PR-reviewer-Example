// ============================================
// Core Types - No 'any' allowed
// ============================================

export type Platform = 'github' | 'gitlab' | 'bitbucket' | 'auto';

export interface ReviewOptions {
  platform: Platform;
  pr?: number;
  mr?: number;
  repo?: string;
  url?: string;
  diff?: string;
  prompt?: string;
  model?: string;
  config?: string;
  output?: 'comment' | 'stdout' | 'file';
  dryRun?: boolean;
}

// ============================================
// Pull Request Types
// ============================================

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  author: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  diff: string;
  changedFiles: readonly ChangedFile[];
}

export interface ChangedFile {
  readonly path: string;
  readonly additions: number;
  readonly deletions: number;
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed';
}

// ============================================
// Review Result Types
// ============================================

export interface ReviewResult {
  summary: string;
  comments: readonly ReviewComment[];
  fullReview: string;
  metadata: ReviewMetadata;
}

export interface ReviewComment {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: Severity;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface ReviewMetadata {
  model: string;
  durationMs: number;
  tokensUsed?: number;
  diffSize: number;
  filesReviewed: number;
}

// ============================================
// Platform Adapter Interface
// ============================================

export interface PlatformAdapter {
  readonly name: string;
  detect(): boolean;
  getPullRequest(options: ReviewOptions): Promise<PullRequest>;
  postComment(pr: number, comment: string): Promise<void>;
  postLineComments(pr: number, comments: ReviewComment[], headSha: string): Promise<void>;
}

// ============================================
// GitHub API Types
// ============================================

export interface GitHubPRResponse {
  number: number;
  title: string;
  body: string | null;
  user: GitHubUser;
  head: GitHubBranchRef;
  base: GitHubBranchRef;
  state: 'open' | 'closed' | 'merged';
}

export interface GitHubFileResponse {
  filename: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'changed' | 'unchanged';
}

export interface GitHubUser {
  login: string;
  id: number;
  type: 'User' | 'Bot' | 'Organization';
}

export interface GitHubBranchRef {
  sha: string;
  ref: string;
  label: string;
  repo: {
    name: string;
    full_name: string;
  };
}

export interface GitHubCommentResponse {
  id: number;
  body: string;
  user: GitHubUser;
  created_at: string;
}

// ============================================
// Error Types
// ============================================

export class OpenCodeError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string
  ) {
    super(message);
    this.name = 'OpenCodeError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly currentSpend: number,
    public readonly limit: number
  ) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AggregateReviewError extends Error {
  constructor(
    message: string,
    public readonly errors: readonly Error[]
  ) {
    super(message);
    this.name = 'AggregateReviewError';
  }
}

// ============================================
// Rate Limiting Types
// ============================================

export interface RateLimitState {
  readonly reviews: readonly number[];
  readonly lastReset: number;
}

export interface RateLimitConfig {
  readonly maxReviewsPerHour: number;
  readonly windowMs: number;
}

// ============================================
// Logger Types
// ============================================

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}
