# PR Reviewer Example

Production-ready AI-powered PR code reviews using OpenCode.

## What's This?

An automated PR code review system that:

- Uses **OpenCode** for AI-powered analysis
- Works on **GitHub** and **GitLab**
- Posts **inline comments** on specific lines
- Runs via **CLI** or **GitHub Actions**
- **Production-hardened** with security controls

## Prerequisites

Before you start, you'll need:

1. **OpenRouter API Key** - Get one at [openrouter.ai](https://openrouter.ai)
   - Sign up for free
   - Add credits (minimum $5 recommended)
   - Create an API key at [openrouter.ai/keys](https://openrouter.ai/keys)

2. **GitHub Repository** - Admin access to add secrets

## Quick Start

### 1. Copy Files

```bash
# Copy CLI tool
cp -r .github/pr-reviewer your-repo/.github/

# Copy workflow
cp .github/workflows/pr-review.yml your-repo/.github/workflows/
```

### 2. Add GitHub Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value | Where to Get |
|-------------|-------|--------------|
| `OPENCODE_API_KEY` | Your OpenRouter API key | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENCODE_MODEL` *(optional)* | Model name (e.g., `anthropic/claude-3.5-sonnet`) | [OpenRouter models](https://openrouter.ai/models) |

> **Note:** The secret is named `OPENCODE_API_KEY` for historical reasons, but it's your OpenRouter API key.

### 3. Trigger a Review

Comment on any PR:
```
/review
/review focus on security issues
/oc check for SQL injection
```

## Structure

```
.github/
├── pr-reviewer/              # CLI Tool
│   ├── src/
│   │   ├── index.ts          # CLI entry (commander)
│   │   ├── opencode.ts       # OpenCode runner
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── validation.ts     # Input sanitization (zod)
│   │   ├── rate-limiter.ts   # Rate limiting
│   │   ├── logger.ts         # Structured logging
│   │   └── platforms/
│   │       ├── github.ts     # GitHub API adapter
│   │       └── gitlab.ts     # GitLab API adapter
│   ├── opencode/
│   │   └── agent/
│   │       └── code-review.md  # Default agent config
│   ├── package.json
│   ├── package-lock.json
│   └── README.md
│
└── workflows/
    └── pr-review.yml         # GitHub Action workflow
```

## Usage

### In GitHub Actions

Comment on any PR:
```
/review
/review focus on security issues
/oc check for SQL injection
```

### CLI (Local)

```bash
# Install
cd .github/pr-reviewer && npm install && npm link

# Review a PR
pr-reviewer review --platform github --pr 123 --repo owner/repo

# Dry run (no comments posted)
pr-reviewer review --pr 123 --dry-run

# Custom model
pr-reviewer review --pr 123 --model anthropic/claude-3.5-sonnet
```

## Security Features

This implementation includes production-grade security controls:

| Feature | Description |
|---------|-------------|
| **Prompt Injection Protection** | All user inputs sanitized via zod validation |
| **Rate Limiting** | 5 reviews/hour per repo by default |
| **Budget Controls** | Estimated cost check before running |
| **Permission Check** | Only users with write access can trigger |
| **Idempotency** | Skips if review already exists within 1 hour |
| **Concurrency Limits** | Prevents duplicate runs on same PR |
| **OpenCode Version Pinned** | Uses `opencode-ai@1.2.26` for stability |

## Reliability Features

| Feature | Description |
|---------|-------------|
| **Pagination** | Handles PRs with >100 files |
| **Retry Logic** | 3 retries with exponential backoff |
| **Parallel Comments** | Posts line comments concurrently |
| **CLI Caching** | Cached builds for faster CI |
| **Line Validation** | Only comments on lines in diff |
| **Graceful Degradation** | Partial failures don't stop review |

## Example Output

```markdown
## PR Review: #5

### 🔴 CRITICAL

**src/components/ItemList.vue:33-35 — No input validation in `addItem`**
Empty strings, whitespace-only, null, or undefined values can be pushed to the array. Add guard:
```ts
const addItem = (item: string) => {
  if (!item?.trim()) return
  items.value.push(item.trim())
}
```

### 🟠 HIGH

**src/components/ItemList.vue:38-40 — No bounds check in `removeItem`**
Negative or out-of-range index causes silent data corruption...

---

**Verdict: Request changes.** Missing input validation and bounds checking are exploitable.
```

## Configuration

### GitHub Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `OPENCODE_API_KEY` | Yes | OpenRouter API key |
| `OPENCODE_MODEL` | No | Model override (default: anthropic/claude-3.5-sonnet) |
| `REVIEW_BUDGET_LIMIT` | No | Max cost per review in USD (default: 1.00) |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub API token (auto-set in Actions) |
| `GITHUB_REPOSITORY` | Repository (owner/repo, auto-set in Actions) |

### Rate Limiting

Default: 5 reviews per hour per repository.

To customize, edit `src/rate-limiter.ts`:
```typescript
const DEFAULT_MAX_REVIEWS = 5;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
```

## Metrics

Each run logs to `GITHUB_STEP_SUMMARY`:

```
| Metric | Value |
|--------|-------|
| Model | anthropic/claude-3.5-sonnet |
| Duration | 19629ms |
| Diff Size | 1356 bytes |
| Estimated Cost | $0.0013 |
```

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict mode)
- **CLI**: Commander.js
- **Validation**: Zod
- **AI**: OpenCode + OpenRouter

## Cost Estimates

| Diff Size | Estimated Cost |
|-----------|----------------|
| 1 KB | $0.001 |
| 10 KB | $0.01 |
| 100 KB | $0.10 |
| 1 MB | $1.00 |

> **Note:** Actual costs depend on the model used. Claude models are more expensive than open-source alternatives.

## Troubleshooting

### "spawn opencode ENOENT"
OpenCode is not installed. The workflow should install it automatically, but if it fails:
```bash
npm install -g opencode-ai@1.2.26
```

### "401 Unauthorized"
Your API key is invalid or expired. Get a new one at [openrouter.ai/keys](https://openrouter.ai/keys).

### "422 Unprocessable Entity"
Usually means trying to comment on a line not in the diff. This is now handled automatically - invalid line comments are skipped.

### "Review already exists within the last hour"
The idempotency check kicked in. Wait an hour or delete the previous bot comment.

### Timeout
Large PRs may take longer. The default timeout is 10 minutes. Increase in the workflow:
```yaml
timeout-minutes: 15
```

## License

MIT License - See [LICENSE](LICENSE) for details.

---

**Built with security in mind.** See the [roundtable review](https://github.com/DomEscobar/PR-reviewer-Example/pull/5) for the security audit that shaped this implementation.
