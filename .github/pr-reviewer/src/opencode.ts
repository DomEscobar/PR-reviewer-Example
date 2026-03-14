import { spawn } from 'child_process';
import { access, readFile, writeFile, mkdir, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PullRequest, ReviewResult, ReviewComment, ReviewMetadata, OpenCodeError } from './types.js';
import { sanitizePrompt } from './validation.js';
import logger from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_DIFF_SIZE = 50000; // 50KB for AI context
const DEFAULT_MODEL = 'openrouter/openrouter/anthropic/claude-3.5-sonnet';

export class OpenCodeRunner {
  private readonly configPath: string;
  private readonly model: string;

  constructor(options?: { config?: string; model?: string }) {
    this.configPath = options?.config ?? this.getDefaultConfigPath();
    this.model = options?.model ?? DEFAULT_MODEL;
  }

  private getDefaultConfigPath(): string {
    const xdgConfig = process.env.XDG_CONFIG_HOME ?? join(process.env.HOME!, '.config');
    return join(xdgConfig, 'opencode');
  }

  async ensureConfig(): Promise<void> {
    try {
      await access(this.configPath);
    } catch {
      await mkdir(this.configPath, { recursive: true });
    }

    const agentDir = join(this.configPath, 'agent');
    try {
      await access(agentDir);
    } catch {
      await mkdir(agentDir, { recursive: true });
    }

    const agentFile = join(agentDir, 'code-review.md');
    try {
      await access(agentFile);
    } catch {
      await writeFile(agentFile, this.getDefaultAgent());
      logger.info('Created default code-review agent');
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
    
    const startTime = Date.now();
    
    // Sanitize user input
    const sanitizedPrompt = sanitizePrompt(customPrompt);
    const message = this.buildReviewMessage(pr, sanitizedPrompt);

    // Write diff to temp file
    const diffFile = join(process.cwd(), '.pr-diff.patch');
    const truncatedDiff = pr.diff.length > MAX_DIFF_SIZE 
      ? pr.diff.slice(0, MAX_DIFF_SIZE) + '\n\n... [Truncated for AI context]'
      : pr.diff;
    
    await writeFile(diffFile, truncatedDiff);

    try {
      const args = [
        'run',
        '-m', this.model,
        '--format', 'default',
        '-f', diffFile,
        '--', message,
      ];

      logger.info('Running OpenCode review', {
        model: this.model,
        diffSize: truncatedDiff.length,
        filesCount: pr.changedFiles.length,
      });

      const result = await this.execOpenCode(args);
      const durationMs = Date.now() - startTime;

      const parsedResult = this.parseReviewResult(result);
      
      return {
        ...parsedResult,
        metadata: {
          model: this.model,
          durationMs,
          diffSize: pr.diff.length,
          filesReviewed: pr.changedFiles.length,
        },
      };
    } finally {
      try {
        await unlink(diffFile);
        logger.debug('Cleaned up diff file');
      } catch {
        // Ignore cleanup errors
      }
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
          FORCE_COLOR: '0',
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
          const error = new Error(`OpenCode failed (exit ${code}): ${stderr || 'Unknown error'}`);
          Object.assign(error, { exitCode: code, stderr });
          reject(error);
        }
      });

      child.on('error', (err) => {
        reject(new Error(`OpenCode process error: ${err.message}`));
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
      metadata: {
        model: this.model,
        durationMs: 0, // Set by caller
        diffSize: 0,
        filesReviewed: 0,
      },
    };
  }

  private extractComments(review: string): ReviewComment[] {
    const comments: ReviewComment[] = [];
    
    // Match file:line patterns with backticks
    const fileLinePattern = /`([^`]+\.(ts|tsx|js|jsx|vue|py|go|rs|java|c|cpp|h|cs|php|rb)):(\d+)`/gi;
    let match;

    while ((match = fileLinePattern.exec(review)) !== null) {
      const path = match[1];
      const line = parseInt(match[3], 10);

      // Get surrounding context
      const contextStart = match.index;
      const nextSection = review.indexOf('\n##', contextStart);
      const nextFinding = review.indexOf('**[', contextStart + 10);
      
      let contextEnd = review.length;
      if (nextSection !== -1 && nextSection < contextEnd) contextEnd = nextSection;
      if (nextFinding !== -1 && nextFinding < contextEnd) contextEnd = Math.min(contextEnd, nextFinding);

      const body = review.substring(contextStart, contextEnd).trim();

      // Determine severity
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
    const summaryMatch = review.match(/## Summary\n([\s\S]*?)(?=\n##|$)/i);
    if (summaryMatch) return summaryMatch[1].trim();

    const countMatch = review.match(/(\d+)\s+(critical|high|medium|low|issues?)/i);
    if (countMatch) return `Found ${countMatch[0]}`;

    return 'Review completed.';
  }
}
