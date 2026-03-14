import { execSync } from 'child_process';
import type {
  PlatformAdapter,
  ReviewOptions,
  PullRequest,
  ReviewComment,
  GitHubPRResponse,
  GitHubFileResponse,
} from '../types.js';
import { validateRepo } from '../validation.js';
import logger from '../logger.js';

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;
const MAX_PAGE_SIZE = 100;
const MAX_DIFF_SIZE = 100000; // 100KB

export class GitHubAdapter implements PlatformAdapter {
  readonly name = 'github';
  private readonly token: string;
  private readonly repo?: string;

  constructor(token?: string, repo?: string) {
    this.token = token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    this.repo = repo;
  }

  detect(): boolean {
    return !!(
      process.env.GITHUB_ACTIONS ||
      process.env.GITHUB_REPOSITORY ||
      this.repo ||
      process.env.GH_TOKEN
    );
  }

  async getPullRequest(options: ReviewOptions): Promise<PullRequest> {
    const prNumber = options.pr ?? this.extractPRFromEnv();
    const repo = options.repo ?? this.repo ?? this.extractRepoFromEnv();

    if (!prNumber || !repo) {
      throw new Error('GitHub PR number and repo (owner/repo) required');
    }

    validateRepo(repo);
    const parts = repo.split('/');
    const owner = parts[0];
    const name = parts[1];
    if (!owner || !name) {
      throw new Error(`Invalid repo format: ${repo}`);
    }

    logger.info('Fetching PR', { repo, prNumber });

    // Fetch PR details
    const prData: GitHubPRResponse = await this.fetchWithRetry(
      `GET /repos/${owner}/${name}/pulls/${prNumber}`,
      'Failed to fetch PR'
    );

    // Fetch diff with size check
    const diff = await this.fetchDiff(owner, name, prNumber);

    if (diff.length > MAX_DIFF_SIZE) {
      logger.warn('Diff exceeds size limit, truncating', {
        size: diff.length,
        limit: MAX_DIFF_SIZE,
      });
      // Truncate with note
      const truncatedDiff = diff.slice(0, MAX_DIFF_SIZE) +
        '\n\n... [TRUNCATED - Diff too large for full review]';
      return this.buildPullRequest(prData, truncatedDiff, []);
    }

    // Fetch all changed files (with pagination)
    const files = await this.fetchAllPages<GitHubFileResponse>(
      `GET /repos/${owner}/${name}/pulls/${prNumber}/files`
    );

    logger.info('PR fetched successfully', {
      title: prData.title,
      files: files.length,
      diffSize: diff.length,
    });

    return this.buildPullRequest(prData, diff, files);
  }

  async postComment(pr: number, comment: string): Promise<void> {
    const repo = this.repo;
    if (!repo) throw new Error('Repository required (pass --repo owner/name)');

    validateRepo(repo);
    const parts = repo.split('/');
    const owner = parts[0];
    const name = parts[1];
    if (!owner || !name) {
      throw new Error(`Invalid repo format: ${repo}`);
    }

    logger.info('Posting main comment', { repo, pr });

    await this.fetchWithRetry(
      `POST /repos/${owner}/${name}/issues/${pr}/comments`,
      'Failed to post comment',
      { body: comment }
    );
  }

  async postLineComments(
    pr: number,
    comments: ReviewComment[],
    headSha: string
  ): Promise<void> {
    const repo = this.repo;
    if (!repo) throw new Error('Repository required (pass --repo owner/name)');

    validateRepo(repo);
    const parts = repo.split('/');
    const owner = parts[0];
    const name = parts[1];
    if (!owner || !name) {
      throw new Error(`Invalid repo format: ${repo}`);
    }
    
    logger.info('Posting line comments', { count: comments.length });

    // Post comments in parallel with Promise.allSettled
    const results = await Promise.allSettled(
      comments.map(comment =>
        this.postSingleLineComment(owner, name, pr, comment, headSha)
      )
    );

    // Collect failures
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length > 0) {
      logger.warn('Some line comments failed', {
        failed: failures.length,
        total: comments.length
      });

      // Don't throw - partial success is acceptable for line comments
      // Main comment already posted with all findings
    }
  }

  private async postSingleLineComment(
    owner: string,
    name: string,
    pr: number,
    comment: ReviewComment,
    headSha: string
  ): Promise<void> {
    await this.fetchWithRetry(
      `POST /repos/${owner}/${name}/pulls/${pr}/comments`,
      `Failed to post comment on ${comment.path}:${comment.line}`,
      {
        body: `🤖 **${comment.severity.toUpperCase()}**\n\n${comment.body}`,
        path: comment.path,
        line: comment.line,
        side: 'RIGHT',
        commit_id: headSha,
      }
    );
  }

  private async fetchDiff(
    owner: string,
    name: string,
    prNumber: number
  ): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3.diff',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch diff: ${response.status} ${response.statusText}`);
    }

    return response.text();
  }

  private async fetchAllPages<T>(endpoint: string): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const data = await this.fetchWithRetry<T[]>(
        `${endpoint}?page=${page}&per_page=${MAX_PAGE_SIZE}`,
        `Failed to fetch page ${page}`
      );

      if (!data || data.length === 0) break;
      results.push(...data);

      if (data.length < MAX_PAGE_SIZE) break;
      page++;
    }

    return results;
  }

  private async fetchWithRetry<T>(
    endpoint: string,
    errorMsg: string,
    body?: Record<string, unknown>,
    attempt = 1
  ): Promise<T> {
    try {
      return await this.fetchAPI<T>(endpoint, errorMsg, body);
    } catch (error) {
      if (attempt >= MAX_RETRIES) {
        throw error;
      }

      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      logger.warn(`Retry ${attempt}/${MAX_RETRIES} after ${backoffMs}ms`, {
        endpoint,
        error: (error as Error).message
      });

      await this.sleep(backoffMs);
      return this.fetchWithRetry<T>(endpoint, errorMsg, body, attempt + 1);
    }
  }

  private async fetchAPI<T>(
    endpoint: string,
    errorMsg: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const [method, path] = endpoint.split(' ');
    const url = `https://api.github.com${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'No response body');
      throw new Error(`${errorMsg}: ${response.status} ${response.statusText} - ${text}`);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  }

  private buildPullRequest(
    prData: GitHubPRResponse,
    diff: string,
    files: GitHubFileResponse[]
  ): PullRequest {
    return {
      number: prData.number,
      title: prData.title,
      body: prData.body,
      author: prData.user.login,
      headSha: prData.head.sha,
      baseBranch: prData.base.ref,
      headBranch: prData.head.ref,
      diff,
      changedFiles: files.map(f => ({
        path: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        status: f.status === 'copied' || f.status === 'changed' || f.status === 'unchanged'
          ? 'modified'
          : f.status,
      })),
    };
  }

  private extractRepoFromEnv(): string | undefined {
    if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)/);
      if (match && match.length > 1 && match[1]) {
        return match[1];
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private extractPRFromEnv(): number | undefined {
    if (process.env.GITHUB_REF?.startsWith('refs/pull/')) {
      const parts = process.env.GITHUB_REF.split('/');
      const prStr = parts[2];
      if (prStr) {
        return parseInt(prStr, 10);
      }
    }
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
