# PR Reviewer Example

Production-ready AI-powered PR code reviews using OpenCode.

## What's This?

An automated PR code review system that:

- Uses **OpenCode** for AI-powered analysis
- Works on **GitHub** and **GitLab**
- Posts **inline comments** on specific lines
- Runs via **CLI** or **GitHub Actions**
- **Production-hardened** with security controls

## Quick Start

1. Copy `.github/pr-reviewer/` to your repo
2. Copy `.github/workflows/pr-review.yml` to your repo
3. Add secret `OPENCODE_API_KEY` (OpenRouter API key)
4. (Optional) Add secret `OPENCODE_MODEL` to override model
5. Comment `/review` on any PR

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

## Testing

```bash
# Build
npm run build

# Run review locally
pr-reviewer review --pr 5 --dry-run

# Check logs
# Logs are structured JSON for easy parsing
```

## License

MIT

---

**Built with security in mind.** See the [roundtable review](https://github.com/DomEscobar/PR-reviewer-Example/pull/5) for the security audit that shaped this implementation.
