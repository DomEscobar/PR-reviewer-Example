#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createAdapter } from './platforms/index.js';
import { OpenCodeRunner } from './opencode.js';
import type { ReviewOptions } from './types.js';

const program = new Command();

program
  .name('pr-reviewer')
  .description('Multi-platform PR/MR code reviewer powered by OpenCode')
  .version('1.0.0');

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
  .action(async (options) => {
    const spinner = ora('Initializing...').start();

    try {
      // Parse options
      const reviewOptions: ReviewOptions = {
        platform: options.platform as any,
        pr: options.pr,
        mr: options.mr,
        repo: options.repo,
        url: options.url,
        diff: options.diff,
        prompt: options.prompt,
        model: options.model,
        config: options.config,
        output: options.output as any,
        dryRun: options.dryRun,
      };

      // Auto-detect platform from URL
      if (options.url) {
        if (options.url.includes('github.com')) {
          reviewOptions.platform = 'github';
          // Extract PR number and repo from URL
          const match = options.url.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
          if (match) {
            reviewOptions.repo = match[1];
            reviewOptions.pr = parseInt(match[2], 10);
          }
        } else if (options.url.includes('gitlab.com')) {
          reviewOptions.platform = 'gitlab';
          // GitLab MR URLs are trickier, try to parse
          const match = options.url.match(/gitlab\.com\/(.+)\/-\/merge_requests\/(\d+)/);
          if (match) {
            reviewOptions.repo = match[1];
            reviewOptions.mr = parseInt(match[2], 10);
          }
        }
      }

      // Create platform adapter
      spinner.text = 'Connecting to platform...';
      const adapter = createAdapter(reviewOptions.platform, reviewOptions);

      // Fetch PR/MR data
      spinner.text = 'Fetching pull request...';
      const pr = await adapter.getPullRequest(reviewOptions);

      spinner.text = `Reviewing PR #${pr.number}: ${pr.title}...`;

      // Run OpenCode review
      const runner = new OpenCodeRunner({
        config: reviewOptions.config,
        model: reviewOptions.model,
      });

      const result = await runner.runReview(pr, reviewOptions.prompt);

      spinner.succeed('Review complete!');

      // Output results
      if (reviewOptions.dryRun || reviewOptions.output === 'stdout') {
        console.log('\n' + chalk.bold('## 🤖 Code Review\n'));
        console.log(result.fullReview);
      }

      if (!reviewOptions.dryRun && reviewOptions.output === 'comment') {
        const postSpinner = ora('Posting review comment...').start();

        // Post main comment
        await adapter.postComment(pr.number, result.fullReview);
        
        // Post line-level comments
        if (result.comments.length > 0) {
          postSpinner.text = `Posting ${result.comments.length} line comments...`;
          await adapter.postLineComments(pr.number, result.comments, pr.headSha);
        }

        postSpinner.succeed(`Posted review with ${result.comments.length} line comments`);
      }

      // Summary
      console.log('\n' + chalk.gray('─'.repeat(50)));
      console.log(chalk.bold('Summary: ') + result.summary);
      console.log(chalk.gray('─'.repeat(50)));

      if (result.comments.length > 0) {
        console.log(chalk.bold(`\n${result.comments.length} issue(s) found:`));
        const bySeverity = {
          critical: result.comments.filter(c => c.severity === 'critical'),
          high: result.comments.filter(c => c.severity === 'high'),
          medium: result.comments.filter(c => c.severity === 'medium'),
          low: result.comments.filter(c => c.severity === 'low'),
        };
        
        if (bySeverity.critical.length) {
          console.log(chalk.red(`  🔴 Critical: ${bySeverity.critical.length}`));
        }
        if (bySeverity.high.length) {
          console.log(chalk.yellow(`  🟠 High: ${bySeverity.high.length}`));
        }
        if (bySeverity.medium.length) {
          console.log(chalk.blue(`  🟡 Medium: ${bySeverity.medium.length}`));
        }
        if (bySeverity.low.length) {
          console.log(chalk.gray(`  ⚪ Low: ${bySeverity.low.length}`));
        }
      }

    } catch (error: any) {
      spinner.fail('Review failed');
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
