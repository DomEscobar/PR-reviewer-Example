# PR Reviewer Example

Example repository demonstrating AI-powered PR code reviews using OpenCode.

## What's This?

A working implementation of automated PR code reviews that:

- Uses **OpenCode** for AI-powered analysis
- Works on **GitHub** and **GitLab**
- Posts **inline comments** on specific lines
- Runs via **CLI** or **GitHub Actions**

## Quick Start

1. Copy `.github/pr-reviewer/` to your repo
2. Copy `.github/workflows/pr-review.yml` to your repo
3. Add secret `OPENCODE_API_KEY` (OpenRouter API key)
4. Comment `/review` on any PR

## Structure

```
.github/
├── pr-reviewer/              # CLI Tool
│   ├── src/
│   │   ├── index.ts          # CLI entry (commander)
│   │   ├── opencode.ts       # OpenCode runner
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── platforms/
│   │       ├── github.ts     # GitHub API adapter
│   │       └── gitlab.ts     # GitLab API adapter
│   ├── opencode/
│   │   └── agent/
│   │       └── code-review.md  # Default agent config
│   ├── package.json
│   └── README.md             # Full documentation
│
└── workflows/
    └── pr-review.yml         # GitHub Action workflow
```

## Usage

### In GitHub Actions

Comment on any PR:
```
/review
/oc focus on security
```

### CLI (Local)

```bash
# Install
npm install -g opencode-ai @domesco/pr-reviewer

# Review a PR
pr-reviewer review --platform github --pr 123 --repo owner/repo

# Dry run
pr-reviewer review --pr 123 --dry-run
```

## Example Output

```markdown
## PR Review: #5

### src/components/ItemList.vue:33-35 — MEDIUM: No input validation

`addItem` accepts empty strings, whitespace, and arbitrarily long input.

**Fix:**
```typescript
const addItem = (item: string) => {
  const trimmed = item.trim()
  if (!trimmed || trimmed.length > 255) return
  items.value.push(trimmed)
}
```

### src/components/ItemList.vue:38-40 — HIGH: No bounds check

`removeItem` does not validate the index...
```

## Features

| Feature | Status |
|---------|--------|
| CLI Tool | ✅ |
| GitHub Actions | ✅ |
| GitLab CI | ✅ |
| Inline Comments | ✅ |
| Custom Models | ✅ |
| Custom Prompts | ✅ |

## Documentation

See [.github/pr-reviewer/README.md](.github/pr-reviewer/README.md) for full documentation.

## License

MIT
