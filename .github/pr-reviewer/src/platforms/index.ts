import type { Platform, PlatformAdapter, ReviewOptions } from '../types.js';
import { GitHubAdapter } from './github.js';
import { GitLabAdapter } from './gitlab.js';

export * from './github.js';
export * from './gitlab.js';

export function createAdapter(platform: Platform, options?: ReviewOptions): PlatformAdapter {
  if (platform === 'auto') {
    return detectPlatform(options?.repo);
  }

  switch (platform) {
    case 'github':
      return new GitHubAdapter(undefined, options?.repo);
    case 'gitlab':
      return new GitLabAdapter(undefined, options?.repo);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function detectPlatform(repo?: string): PlatformAdapter {
  const github = new GitHubAdapter(undefined, repo);
  const gitlab = new GitLabAdapter(undefined, repo);

  // Check environment hints
  if (github.detect()) return github;
  if (gitlab.detect()) return gitlab;

  // Check git remote
  try {
    const remote = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    if (remote.includes('github.com')) return github;
    if (remote.includes('gitlab.com')) return gitlab;
  } catch {}

  // Default to GitHub
  console.warn('Could not detect platform, defaulting to GitHub');
  return github;
}

import { execSync } from 'child_process';
