import type { PlatformAdapter, ReviewOptions, PullRequest, ReviewComment } from '../types.js';
import { execSync } from 'child_process';

export class GitLabAdapter implements PlatformAdapter {
  name = 'gitlab';
  private token: string;
  private project?: string;
  private host: string;

  constructor(token?: string, project?: string, host = 'gitlab.com') {
    this.token = token || process.env.GITLAB_TOKEN || '';
    this.project = project;
    this.host = host;
  }

  detect(): boolean {
    return !!(
      process.env.GITLAB_CI ||
      process.env.CI_MERGE_REQUEST_IID ||
      process.env.GITLAB_TOKEN ||
      this.project
    );
  }

  async getPullRequest(options: ReviewOptions): Promise<PullRequest> {
    const mrNumber = options.mr || this.extractMRFromEnv();
    const project = options.repo || this.project || this.extractProjectFromEnv();

    if (!mrNumber || !project) {
      throw new Error('GitLab MR number and project required');
    }

    const projectEncoded = encodeURIComponent(project);

    // Fetch MR details
    const mrData = await this.fetchAPI(
      `GET /projects/${projectEncoded}/merge_requests/${mrNumber}`,
      'Failed to fetch MR'
    );

    // Fetch diff
    const diffResponse = await fetch(
      `https://${this.host}/api/v4/projects/${projectEncoded}/merge_requests/${mrNumber}/diffs`,
      {
        headers: {
          'PRIVATE-TOKEN': this.token,
        },
      }
    );
    const diffs = await diffResponse.json();
    const diff = diffs.map((d: any) => d.diff).join('\n');

    // Fetch changed files
    const changesResponse = await fetch(
      `https://${this.host}/api/v4/projects/${projectEncoded}/merge_requests/${mrNumber}/changes`,
      {
        headers: {
          'PRIVATE-TOKEN': this.token,
        },
      }
    );
    const changes = await changesResponse.json();

    return {
      number: mrData.iid,
      title: mrData.title,
      body: mrData.description,
      author: mrData.author.username,
      headSha: mrData.sha,
      baseBranch: mrData.target_branch,
      headBranch: mrData.source_branch,
      diff,
      changedFiles: changes.changes.map((f: any) => ({
        path: f.new_path,
        additions: f.diff.split('\n').filter((l: string) => l.startsWith('+')).length,
        deletions: f.diff.split('\n').filter((l: string) => l.startsWith('-')).length,
        status: f.new_file ? 'added' : f.deleted_file ? 'deleted' : 'modified',
      })),
    };
  }

  async postComment(mr: number, comment: string): Promise<void> {
    const project = this.project || this.extractProjectFromEnv();
    if (!project) throw new Error('Project required');

    const projectEncoded = encodeURIComponent(project);
    await this.fetchAPI(
      `POST /projects/${projectEncoded}/merge_requests/${mr}/notes`,
      'Failed to post comment',
      { body: comment }
    );
  }

  async postLineComments(
    mr: number,
    comments: ReviewComment[],
    headSha: string
  ): Promise<void> {
    const project = this.project || this.extractProjectFromEnv();
    if (!project) throw new Error('Project required');

    const projectEncoded = encodeURIComponent(project);

    for (const comment of comments) {
      try {
        await this.fetchAPI(
          `POST /projects/${projectEncoded}/merge_requests/${mr}/discussions`,
          `Failed to post comment on ${comment.path}:${comment.line}`,
          {
            body: `🤖 **${comment.severity.toUpperCase()}**\n\n${comment.body}`,
            position: {
              base_sha: headSha,
              head_sha: headSha,
              position_type: 'text',
              new_path: comment.path,
              new_line: comment.line,
            },
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
    const url = `https://${this.host}/api/v4${path}`;

    const response = await fetch(url, {
      method,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${errorMsg}: ${response.status} ${text}`);
    }

    return response.json();
  }

  private extractProjectFromEnv(): string | undefined {
    if (process.env.CI_PROJECT_PATH) return process.env.CI_PROJECT_PATH;
    try {
      const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
      const match = remote.match(/gitlab\.com[/:](.+?)(?:\.git)?$/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private extractMRFromEnv(): number | undefined {
    if (process.env.CI_MERGE_REQUEST_IID) {
      return parseInt(process.env.CI_MERGE_REQUEST_IID, 10);
    }
    return undefined;
  }
}
