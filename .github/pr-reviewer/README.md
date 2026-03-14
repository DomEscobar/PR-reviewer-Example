# @domesco/pr-reviewer

Multi-platform PR/MR code reviewer CLI powered by OpenCode.

## What is this?

A command-line tool that uses AI (via OpenCode) to review pull requests and merge requests. It posts:
- **Main review comment** with summary and all findings
- **Inline line comments** pinpointing exact issues in code

Works with **GitHub**, **GitLab**, and can be extended to other platforms.

## Features

- 🤖 **AI-powered reviews** using OpenCode agents
- 📍 **Line-level comments** - Pinpoint exact issues in diff
- 🎯 **Severity levels** - CRITICAL, HIGH, MEDIUM, LOW
- 🔌 **Multi-platform** - GitHub, GitLab (Bitbucket TODO)
- 🔧 **Customizable** - Custom prompts, models, config
- 🚀 **CI/CD ready** - Works in GitHub Actions, GitLab CI
- 🧪 **Test locally** - Use `--dry-run` before posting

## Installation

### As a Global CLI

```bash
npm install -g opencode-ai
npm install -g @domesco/pr-reviewer
```

### In a GitHub Repository

Copy `.github/pr-reviewer/` to your repo:

```
your-repo/
└── .github/
    ├── pr-reviewer/      # CLI tool
    │   ├── src/
    │   ├── package.json
    │   └── README.md
    └── workflows/
        └── pr-review.yml # GitHub Action
```

## Usage

### CLI Commands

```bash
# Basic usage (auto-detect platform from git remote)
pr-reviewer review

# GitHub PR
pr-reviewer review --platform github --pr 123 --repo owner/repo

# GitLab MR
pr-reviewer review --platform gitlab --mr 456 --repo group/project

# From URL (auto-detects everything)
pr-reviewer review --url https://github.com/owner/repo/pull/123

# Dry run (don't post, just output)
pr-reviewer review --pr 123 --dry-run

# Custom prompt
pr-reviewer review --pr 123 --prompt "Focus on security issues"

# Custom model
pr-reviewer review --pr 123 --model openrouter/openrouter/anthropic/claude-3.5-sonnet
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --platform` | Platform: github, gitlab, auto | auto |
| `--pr` | GitHub PR number | - |
| `--mr` | GitLab MR number | - |
| `-r, --repo` | Repository (owner/repo) | auto-detect |
| `-u, --url` | Full PR/MR URL | - |
| `-d, --diff` | Direct diff input (skip API) | - |
| `--prompt` | Custom review prompt | - |
| `-m, --model` | OpenCode model override | - |
| `-c, --config` | Path to OpenCode config | ~/.config/opencode |
| `-o, --output` | Output: comment, stdout, file | comment |
| `--dry-run` | Don't post, just output | false |

## GitHub Actions Integration

### Setup

1. Add `.github/pr-reviewer/` and `.github/workflows/pr-review.yml` to your repo

2. Add secrets:
   - `OPENCODE_API_KEY` - Your OpenRouter API key
   - `OPENCODE_MODEL` (optional) - Model to use (default: `anthropic/claude-3.5-sonnet`)

3. Comment `/review` or `/oc` on any PR

### Workflow File

```yaml
name: PR Code Review

on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: |
      github.event.issue.pull_request &&
      startsWith(github.event.comment.body, '/review')
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    env:
      OPENROUTER_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Tools
        run: |
          npm install -g opencode-ai
          npm install -g commander chalk ora typescript
          cp -r ${{ github.workspace }}/.github/pr-reviewer /tmp/pr-reviewer
          cd /tmp/pr-reviewer && npm install && npm run build && npm link
      
      - name: Run Review
        run: |
          pr-reviewer review \
            --platform github \
            --pr ${{ github.event.issue.number }} \
            --repo ${{ github.repository }} \
            --model "openrouter/openrouter/${{ secrets.OPENCODE_MODEL || 'anthropic/claude-3.5-sonnet' }}"
```

## GitLab CI Integration

```yaml
code-review:
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npm install -g opencode-ai @domesco/pr-reviewer
    - pr-reviewer review --mr $CI_MERGE_REQUEST_IID --repo $CI_PROJECT_PATH
  variables:
    GITLAB_TOKEN: $GITLAB_TOKEN
    OPENROUTER_API_KEY: $OPENROUTER_API_KEY
```

## Configuration

### OpenCode Setup

The CLI uses OpenCode's configuration for LLM providers. Set up OpenRouter:

```bash
# Interactive login
opencode auth login openrouter

# Or set environment variable
export OPENROUTER_API_KEY=sk-or-...
```

### Available Models

```bash
# List all models
opencode models

# List OpenRouter models
opencode models openrouter
```

Popular models:
- `openrouter/openrouter/anthropic/claude-3.5-sonnet`
- `openrouter/openrouter/anthropic/claude-3.5-haiku`
- `openrouter/openrouter/hunter-alpha` (fast, cheap)
- `openrouter/openrouter/openai/gpt-4o`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token |
| `GITLAB_TOKEN` | GitLab personal access token |
| `OPENROUTER_API_KEY` | OpenRouter API key |

## How It Works

1. **Fetch PR/MR** - Gets diff and metadata via platform API
2. **Write diff file** - Saves to `.pr-diff.patch`
3. **Run OpenCode** - Executes `opencode run -m model -f .pr-diff.patch "message"`
4. **Parse output** - Extracts file:line references for inline comments
5. **Post comments** - Main comment + line-level comments via API

## Output Format

The AI generates reviews in this format:

```
### `file.ts:42` — SEVERITY: Issue description

Explanation of the issue...

**Fix:**
```typescript
// Suggested code fix
```
```

Severities:
- **CRITICAL** - Security vulnerabilities, data loss, crashes
- **HIGH** - Logic errors, race conditions, missing guards
- **MEDIUM** - Edge cases, error handling gaps
- **LOW** - Code quality, style, minor improvements

## Extending

### Add a New Platform

Create `src/platforms/newplatform.ts`:

```typescript
import type { PlatformAdapter, ReviewOptions, PullRequest, ReviewComment } from '../types.js';

export class NewPlatformAdapter implements PlatformAdapter {
  name = 'newplatform';
  
  detect(): boolean {
    return !!process.env.NEWPLATFORM_TOKEN;
  }
  
  async getPullRequest(options: ReviewOptions): Promise<PullRequest> {
    // Fetch PR/MR data
  }
  
  async postComment(pr: number, comment: string): Promise<void> {
    // Post main comment
  }
  
  async postLineComments(pr: number, comments: ReviewComment[], headSha: string): Promise<void> {
    // Post inline comments
  }
}
```

Then register in `src/platforms/index.ts`.

### Custom Review Agent

The default agent is at `opencode/agent/code-review.md`. Customize it:

```markdown
---
description: Your custom code reviewer
mode: subagent
temperature: 0.1
---

Your custom instructions here...
```

## Development

```bash
# Clone
git clone https://github.com/DomEscobar/PR-reviewer-Example

# Install dependencies
cd .github/pr-reviewer && npm install

# Build
npm run build

# Test locally
GITHUB_TOKEN=$(gh auth token) node dist/index.js review --pr 5 --dry-run
```

## Troubleshooting

### "Model not found" error

Make sure the model has the correct prefix:
- ✅ `openrouter/openrouter/anthropic/claude-3.5-sonnet`
- ❌ `openrouter/anthropic/claude-3.5-sonnet`
- ❌ `anthropic/claude-3.5-sonnet`

Check available models with `opencode models openrouter`.

### "No access to model" error

Your OpenRouter account may not have access to that model. Check your OpenRouter dashboard.

### Comments not posting

Ensure your token has the right permissions:
- GitHub: `repo` scope or `pull_requests: write`
- GitLab: `api` scope

### Empty reviews

The diff might be too large (>50KB gets truncated). Try reviewing specific files or use a smaller model.

## License

MIT

## Credits

- Inspired by [elithrar/dotfiles](https://github.com/elithrar/dotfiles/blob/main/.config/opencode/agent/code-review.md)
- Powered by [OpenCode](https://opencode.ai)
- Models via [OpenRouter](https://openrouter.ai)
