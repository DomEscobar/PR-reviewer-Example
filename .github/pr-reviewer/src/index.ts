#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createAdapter } from './platforms/index.js';
import { OpenCodeRunner } from './opencode.js';
import { rateLimiter } from './rate-limiter.js';
import { sanitizePrompt, validateRepo, validateModel } from './validation.js';
import logger from './logger.js';
import type { ReviewOptions } from './types.js';

const program = new Command();

program
  .name('pr-reviewer')
  .description('Multi-platform PR/MR code reviewer powered by OpenCode')
  .version('2.0.0');

program
  .command('review')
  .description('Review a pull request or merge request')
  .option('-p, --platform <platform>', 'Platform (github, gitlab, auto)', 'auto')
  .option('--pr <number>', 'GitHub PR number', parseInt)
  .option('--mr <number>', 'GitLab MR number', parseInt)
  .option('-r, --repo <repo>', 'Repository (owner/repo for GitHub, project path for GitLab)')
  .option('-u, --url <url>', 'Full PR/MR URL (auto-detects platform)')
  .option('-d, --diff <diff>', 'Direct diff input (skip API fetch)')
  .option('--prompt <prompt>', 'Custom review prompt')
  .option('-m, --model <model>', 'Override OpenCode model')
  .option('-c, --config <path>', 'Path to OpenCode config')
  .option('-o, --output <format>', 'Output format (comment, stdout, file)', 'comment')
  .option('--dry-run', 'Don\'t post comments, just output', false)
  .option('--skip-rate-limit', 'Skip rate limiting check', false)
  .action(async (options) => {
    const spinner = ora('Initializing...').start();

    try {
      // Parse and validate options
      const reviewOptions: ReviewOptions = {
        platform: options.platform as any,
        pr: options.pr,
        mr: options.mr,
        repo: options.repo,
        url: options.url,
        diff: options.diff,
        prompt: sanitizePrompt(options.prompt),
        model: options.model ? validateModel(options.model) : undefined,
        config: options.config,
        output: options.output as any,
        dryRun: options.dryRun,
      };

      // Auto-detect platform from URL
      if (options.url) {
        const urlResult = parseReviewUrl(options.url);
        if (urlResult) {
          reviewOptions.platform = urlResult.platform;
          reviewOptions.repo = urlResult.repo;
          reviewOptions.pr = urlResult.pr;
          reviewOptions.mr = urlResult.mr;
        }
      }

      // Validate repo if provided
      if (reviewOptions.repo) {
        try {
          validateRepo(reviewOptions.repo);
        } catch (error) {
          spinner.fail('Invalid repository format');
          console.error(chalk.red(`\n❌ ${(error as Error).message}`));
          process.exit(1);
        }
      }

      // Create platform adapter
      spinner.text = 'Connecting to platform...';
      const adapter = createAdapter(reviewOptions.platform, reviewOptions);

      // Fetch PR/MR data
      spinner.text = 'Fetching pull request...';
      const pr = await adapter.getPullRequest(reviewOptions);

      // Check rate limiting
      if (!options.skipRateLimit && !reviewOptions.dryRun) {
        const canProceed = await rateLimiter.canProceed(reviewOptions.repo || 'unknown');
        if (!canProceed) {
          spinner.fail('Rate limit exceeded');
          console.error(chalk.yellow('\n⚠️ Rate limit exceeded. Please wait before requesting another review.'));
          process.exit(1);
        }
      }

      spinner.text = `Reviewing PR #${pr.number}: ${pr.title.substring(0, 50)}...`;

      // Run OpenCode review
      const runner = new OpenCodeRunner({
        config: reviewOptions.config,
        model: reviewOptions.model,
      });

      const result = await runner.runReview(pr, reviewOptions.prompt);
      
      // Record for rate limiting
      if (!options.skipRateLimit && !reviewOptions.dryRun) {
        await rateLimiter.recordReview();
      }

      spinner.succeed('Review complete!');

      // Output results
      if (reviewOptions.dryRun || reviewOptions.output === 'stdout') {
        console.log('\n' + chalk.bold('## 🤖 Code Review\n'));
        console.log(result.fullReview);
        console.log(chalk.gray('\n---'));
        console.log(chalk.gray(`Model: ${result.metadata.model}`));
        console.log(chalk.gray(`Duration: ${result.metadata.durationMs}ms`));
      }

      if (!reviewOptions.dryRun && reviewOptions.output === 'comment') {
        const postSpinner = ora('Posting review comment...').start();

        // Check for existing review (idempotency)
        const existingReview = await checkExistingReview(adapter, pr.number);
        if (existingReview) {
          postSpinner.warn('Review already exists, skipping duplicate post');
        } else {
          // Post main comment
          const fullComment = formatReviewComment(result);
          await adapter.postComment(pr.number, fullComment);
          
          // Post line-level comments
          if (result.comments.length > 0) {
            postSpinner.text = `Posting ${result.comments.length} line comments...`;
            await adapter.postLineComments(pr.number, result.comments, pr.headSha);
          }

          postSpinner.succeed(`Posted review with ${result.comments.length} line comments`);
        }
      }

      // Summary
      console.log('\n' + chalk.gray('─'.repeat(50)));
      console.log(chalk.bold('Summary: ') + result.summary);
      console.log(chalk.gray('─'.repeat(50)));

      if (result.comments.length > 0) {
        console.log(chalk.bold(`\n${result.comments.length} issue(s) found:`));
        printSeveritySummary(result.comments);
      }

      // Log metrics
      logger.info('Review completed', {
        prNumber: pr.number,
        durationMs: result.metadata.durationMs,
        issuesFound: result.comments.length,
        model: result.metadata.model,
      });

    } catch (error: any) {
      spinner.fail('Review failed');
      logger.error('Review failed', error);
      console.error(chalk.red('\n❌ Error: ') + error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Setup OpenCode configuration for code reviews')
  .option('-c, --config <path>', 'Path to OpenCode config directory')
  .action(async (options) => {
    const spinner = ora('Setting up OpenCode...').start();
    
    try {
      const runner = new OpenCodeRunner({ config: options.config });
      await runner.ensureConfig();
      
      spinner.succeed('OpenCode configuration created!');
      console.log(chalk.gray('\nConfiguration written to ~/.config/opencode/'));
    } catch (error: any) {
      spinner.fail('Setup failed');
      console.error(chalk.red('\n❌ Error: ') + error.message);
      process.exit(1);
    }
  });

program.parse();

// Helper functions

interface ParsedUrl {
  platform: 'github' | 'gitlab';
  repo: string;
  pr?: number;
  mr?: number;
}

function parseReviewUrl(url: string): ParsedUrl | null {
  // GitHub: https://github.com/owner/repo/pull/123
  const githubMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (githubMatch) {
    return { platform: 'github', repo: githubMatch[1], pr: parseInt(githubMatch[2], 10) };
  }

  // GitLab: https://gitlab.com/group/project/-/merge_requests/456
  const gitlabMatch = url.match(/gitlab\.com\/(.+)\/-\/merge_requests\/(\d+)/);
  if (gitlabMatch) {
    return { platform: 'gitlab', repo: gitlabMatch[1], mr: parseInt(gitlabMatch[2], 10) };
  }

  return null;
}

async function checkExistingReview(adapter: any, prNumber: number): Promise<boolean> {
  // This would check if a review was already posted
  // For now, return false - could implement by checking for bot's previous comments
  return false;
}

function formatReviewComment(result: any): string {
  const metadata = result.metadata;
  return `${result.fullReview}

---
_Model: \`${metadata.model}\` • Duration: ${metadata.durationMs}ms • Files: ${metadata.filesReviewed}`;
}

function printSeveritySummary(comments: any[]): void {
  const counts = {
    critical: comments.filter(c => c.severity === 'critical').length,
    high: comments.filter(c => c.severity === 'high').length,
    medium: comments.filter(c => c.severity === 'medium').length,
    low: comments.filter(c => c.severity === 'low').length,
  };
  
  if (counts.critical) {
    console.log(chalk.red(`  🔴 Critical: ${counts.critical}`));
  }
  if (counts.high) {
    console.log(chalk.yellow(`  🟠 High: ${counts.high}`));
  }
  if (counts.medium) {
    console.log(chalk.blue(`  🟡 Medium: ${counts.medium}`));
  }
  if (counts.low) {
    console.log(chalk.gray(`  ⚪ Low: ${counts.low}`));
  }
}
