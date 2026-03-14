# @domesco/pr-reviewer

Multi-platform PR/MR code reviewer powered by OpenCode.

## Features

- 🤖 **AI-powered reviews** using OpenCode agents
- 🔌 **Multi-platform**: GitHub, GitLab, Bitbucket
- 📍 **Line-level comments**: Pinpoint exact issues in code
- 🎯 **Severity levels**: Critical, High, Medium, Low
- 🔧 **Customizable**: Custom prompts, models, and configs
- 🚀 **CI/CD ready**: Works in GitHub Actions, GitLab CI, etc.

## Installation

```bash
npm install -g @domesco/pr-reviewer
```

## Prerequisites

1. **OpenCode** installed: `npm install -g opencode-ai`
2. **API keys** configured (one of):
   - `OPENROUTER_API_KEY` for OpenRouter
   - `ANTHROPIC_API_KEY` for Claude
   - Or configure via `~/.config/opencode/settings.yaml`

3. **Platform tokens**:
   - GitHub: `GITHUB_TOKEN` or `GH_TOKEN`
   - GitLab: `GITLAB_TOKEN`

## Usage

### Basic Usage

```bash
# Auto-detect platform from git remote
pr-reviewer review

# GitHub PR
pr-reviewer review --platform github --pr 123 --repo owner/repo

# GitLab MR
pr-reviewer review --platform gitlab --mr 456 --repo group/project

# From URL (auto-detects everything)
pr-reviewer review --url https://github.com/owner/repo/pull/123
```

### Options

| Option | Description |
|--------|-------------|
| `-p, --platform` | Platform: github, gitlab, auto (default: auto) |
| `--pr` | GitHub PR number |
| `--mr` | GitLab MR number |
| `-r, --repo` | Repository (owner/repo for GitHub) |
| `-u, --url` | Full PR/MR URL |
| `-d, --diff` | Direct diff input (skip API fetch) |
| `--prompt` | Custom review prompt |
| `-m, --model` | Override OpenCode model |
| `--dry-run` | Output to stdout, don't post comments |

### CI/CD Integration

**GitHub Actions:**

```yaml
name: PR Review
on:
  issue_comment:
    types: [created]

jobs:
  review:
    if: startsWith(github.event.comment.body, '/review')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install tools
        run: npm install -g opencode @domesco/pr-reviewer
      
      - name: Run review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        run: |
          pr-reviewer review --pr ${{ github.event.issue.number }}
```

**GitLab CI:**

```yaml
code-review:
  stage: test
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
  script:
    - npm install -g opencode @domesco/pr-reviewer
    - pr-reviewer review --mr $CI_MERGE_REQUEST_IID
  variables:
    GITLAB_TOKEN: $GITLAB_TOKEN
    OPENROUTER_API_KEY: $OPENROUTER_API_KEY
```

## Configuration

### OpenCode Config

The CLI uses OpenCode's `code-review` agent. Configure it at:

```
~/.config/opencode/agent/code-review.md
```

Or run `pr-reviewer setup` to install the default agent.

### Custom Prompt

```bash
pr-reviewer review --prompt "Focus on security vulnerabilities and SQL injection risks"
```

### Model Override

```bash
pr-reviewer review --model anthropic/claude-3.5-sonnet
```

## Output Format

Reviews follow this structure:

```
**[SEVERITY] [PROVABILITY]** Brief description
`file.ts:42` — explanation with evidence
Scenario: <concrete input that triggers this>
Suggested fix: `code`
```

## License

MIT
