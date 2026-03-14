import { spawn } from 'child_process';
import { access, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PullRequest, ReviewResult, ReviewComment } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class OpenCodeRunner {
  private configPath: string;
  private model?: string;

  constructor(options?: { config?: string; model?: string }) {
    this.configPath = options?.config || this.getDefaultConfigPath();
    this.model = options?.model;
  }

  private getDefaultConfigPath(): string {
    const xdgConfig = process.env.XDG_CONFIG_HOME || join(process.env.HOME!, '.config');
    return join(xdgConfig, 'opencode');
  }

  async ensureConfig(): Promise<void> {
    // Ensure config directory exists
    try {
      await access(this.configPath);
    } catch {
      await mkdir(this.configPath, { recursive: true });
    }

    // Ensure agent directory exists
    const agentDir = join(this.configPath, 'agent');
    try {
      await access(agentDir);
    } catch {
      await mkdir(agentDir, { recursive: true });
    }

    // Ensure code-review.md exists
    const agentFile = join(agentDir, 'code-review.md');
    try {
      await access(agentFile);
    } catch {
      // Create default code-review agent if it doesn't exist
      await writeFile(agentFile, this.getDefaultAgent());
    }
  }

  private getDefaultAgent(): string {
    return `---
description: Reviews code for bugs, security, and maintainability
mode: subagent
temperature: 0.1
permission:
  edit: deny
  bash: allow
  webfetch: allow
---

You are a code reviewer. Provide actionable, evidence-based feedback.

## Review Process

1. Read changed files in full to understand context
2. Run linters/type checkers if available
3. Focus on HIGH risk areas (auth, crypto, external calls)

## What to Look For

- Bugs: Logic errors, missing guards, race conditions
- Security: Input validation, auth checks, injection vectors
- Type safety: Unsafe casts, missing null checks

## Output Format

Each finding:
\`\`\`
**[SEVERITY]** Brief description
\`file.ts:42\` — explanation
Suggested fix: \`code\`
\`\`\`

Severity: CRITICAL | HIGH | MEDIUM | LOW

End with summary count. If no issues, say so.
`;
  }

  async runReview(pr: PullRequest, customPrompt?: string): Promise<ReviewResult> {
    await this.ensureConfig();

    // Build the review message
    const message = this.buildReviewMessage(pr, customPrompt);

    // Write diff to temp file for attachment
    const diffFile = join(process.cwd(), '.pr-diff.patch');
    await writeFile(diffFile, pr.diff);

    try {
      // Build opencode command
      // OpenCode expects: opencode run -m model -f file "message"
      const model = this.model || 'openrouter/anthropic/claude-3.5-sonnet';
      
      const args = [
        'run',
        '-m', model,
        '--format', 'default',
        '-f', diffFile,
      ];

      // Add separator and message
      args.push('--', message);

      // Run opencode
      const result = await this.execOpenCode(args);
      return this.parseReviewResult(result);
    } finally {
      try {
        await unlink(diffFile);
      } catch {}
    }
  }

  private buildReviewMessage(pr: PullRequest, customPrompt?: string): string {
    const changedFilesList = pr.changedFiles
      .map(f => `- ${f.path} (+${f.additions}/-${f.deletions})`)
      .join('\n');

    const basePrompt = customPrompt || `Review this pull request for bugs, security issues, and code quality.

Focus on:
1. CRITICAL: Security vulnerabilities, data loss risks
2. HIGH: Logic errors, race conditions
3. MEDIUM: Edge cases, error handling
4. LOW: Minor improvements

For each issue, provide:
- Exact file:line reference
- Severity level  
- Suggested fix`;

    return `${basePrompt}

## PR #${pr.number}: ${pr.title}

**Author:** ${pr.author}
**Branch:** ${pr.headBranch} → ${pr.baseBranch}

## Changed Files
${changedFilesList}

## Description
${pr.body || 'No description provided.'}`;
  }

  private async execOpenCode(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('opencode', args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NO_COLOR: '1',
        },
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data;
      });

      child.stderr?.on('data', (data) => {
        stderr += data;
      });

      child.on('close', (code) => {
        if (code === 0 || stdout) {
          resolve(stdout || stderr);
        } else {
          reject(new Error(`OpenCode failed (exit ${code}): ${stderr || 'Unknown error'}`));
        }
      });

      child.on('error', (err) => {
        reject(new Error(`OpenCode failed: ${err.message}`));
      });
    });
  }

  private parseReviewResult(output: string): ReviewResult {
    const comments = this.extractComments(output);
    const summary = this.extractSummary(output);

    return {
      summary,
      comments,
      fullReview: output,
    };
  }

  private extractComments(review: string): ReviewComment[] {
    const comments: ReviewComment[] = [];
    
    // Match file:line patterns with backticks
    const fileLinePattern = /`([^`]+\.(ts|tsx|js|jsx|vue|py|go|rs|java|c|cpp|h)):(\d+)`/gi;
    let match;

    while ((match = fileLinePattern.exec(review)) !== null) {
      const path = match[1];
      const line = parseInt(match[3], 10);

      // Get surrounding context as the comment body
      const contextStart = match.index;
      const nextSection = review.indexOf('\n##', contextStart);
      const nextFinding = review.indexOf('**[', contextStart + 10);
      
      let contextEnd = review.length;
      if (nextSection !== -1 && nextSection < contextEnd) contextEnd = nextSection;
      if (nextFinding !== -1 && nextFinding < contextEnd) contextEnd = Math.min(contextEnd, nextFinding);

      const body = review.substring(contextStart, contextEnd).trim();

      // Determine severity from context
      let severity: ReviewComment['severity'] = 'medium';
      const upperBody = body.toUpperCase();
      if (upperBody.includes('CRITICAL')) severity = 'critical';
      else if (upperBody.includes('HIGH')) severity = 'high';
      else if (upperBody.includes('LOW')) severity = 'low';

      comments.push({ path, line, body, severity });
    }

    // Deduplicate by path:line
    const seen = new Set<string>();
    return comments.filter(c => {
      const key = `${c.path}:${c.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private extractSummary(review: string): string {
    // Try to find summary section
    const summaryMatch = review.match(/## Summary\n([\s\S]*?)(?=\n##|$)/i);
    if (summaryMatch) return summaryMatch[1].trim();

    // Try to find a "X issues found" pattern
    const countMatch = review.match(/(\d+)\s+(critical|high|medium|low|issues?)/i);
    if (countMatch) return `Found ${countMatch[0]}`;

    return 'Review completed.';
  }
}
