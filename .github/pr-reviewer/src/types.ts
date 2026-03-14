export type Platform = 'github' | 'gitlab' | 'bitbucket' | 'auto';

export interface ReviewOptions {
  platform: Platform;
  pr?: number;      // GitHub PR number
  mr?: number;      // GitLab MR number
  repo?: string;    // owner/repo format
  url?: string;     // Full PR/MR URL (auto-detect platform)
  diff?: string;    // Direct diff input (skip API fetch)
  prompt?: string;  // Custom review prompt
  model?: string;   // Override OpenCode model
  config?: string;  // Path to OpenCode config
  output?: 'comment' | 'stdout' | 'file';
  dryRun?: boolean; // Don't post, just output
}

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  author: string;
  headSha: string;
  baseBranch: string;
  headBranch: string;
  diff: string;
  changedFiles: ChangedFile[];
}

export interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface ReviewComment {
  path: string;
  line: number;
  body: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  fullReview: string;
}

export interface PlatformAdapter {
  name: string;
  detect(): boolean;
  getPullRequest(options: ReviewOptions): Promise<PullRequest>;
  postComment(pr: number, comment: string): Promise<void>;
  postLineComments(pr: number, comments: ReviewComment[], headSha: string): Promise<void>;
}
