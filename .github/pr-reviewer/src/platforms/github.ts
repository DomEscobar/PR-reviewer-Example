import type { PlatformAdapter, Platform, ReviewOptions, PullRequest, ReviewComment } from '../types.js';

export class GitHubAdapter implements PlatformAdapter {
  name = 'github';
  private token: string;
  private repo?: string;

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
    const prNumber = options.pr || this.extractPRFromEnv();
    const repo = options.repo || this.repo || this.extractRepoFromEnv();

    if (!prNumber || !repo) {
      throw new Error('GitHub PR number and repo (owner/repo) required');
    }

    const [owner, name] = repo.split('/');
    
    // Fetch PR details
    const prData = await this.fetchAPI(
      `GET /repos/${owner}/${name}/pulls/${prNumber}`,
      'Failed to fetch PR'
    );

    // Fetch diff
    const diffResponse = await fetch(
      `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3.diff',
        },
      }
    );
    const diff = await diffResponse.text();

    // Fetch changed files
    const files = await this.fetchAPI(
      `GET /repos/${owner}/${name}/pulls/${prNumber}/files`,
      'Failed to fetch changed files'
    );

    return {
      number: prData.number,
      title: prData.title,
      body: prData.body,
      author: prData.user.login,
      headSha: prData.head.sha,
      baseBranch: prData.base.ref,
      headBranch: prData.head.ref,
      diff,
      changedFiles: files.map((f: any) => ({
        path: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        status: f.status,
      })),
    };
  }

  async postComment(pr: number, comment: string): Promise<void> {
    const repo = this.repo;
    if (!repo) throw new Error('Repository required (pass --repo owner/name)');

    const [owner, name] = repo.split('/');
    await this.fetchAPI(
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

    const [owner, name] = repo.split('/');
    
    for (const comment of comments) {
      try {
        await this.fetchAPI(
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
      } catch (error) {
        console.error(`Failed to post line comment: ${error}`);
      }
    }
  }

  private async fetchAPI(
    endpoint: string,
    errorMsg: string,
    body?: any
  ): Promise<any> {
    const [method, path] = endpoint.split(' ');
    const url = `https://api.github.com${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`${errorMsg}: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private extractRepoFromEnv(): string | undefined {
    if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
    // Try to extract from git remote
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private extractPRFromEnv(): number | undefined {
    if (process.env.GITHUB_REF?.startsWith('refs/pull/')) {
      return parseInt(process.env.GITHUB_REF.split('/')[2], 10);
    }
    return undefined;
  }
}

import { execSync } from 'child_process';
