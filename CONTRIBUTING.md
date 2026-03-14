# Contributing to PR Reviewer

First off, thank you for considering contributing to PR Reviewer! It's people like you that make this tool better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by basic principles of respect and inclusivity. By participating, you are expected to uphold this code. Unacceptable behavior will not be tolerated.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (code, commands, output)
- **Describe the behavior you observed** and what you expected
- **Include logs** from the GitHub Actions run or CLI output
- **Include your environment** (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a step-by-step description** of the suggested enhancement
- **Provide specific examples** to demonstrate the expected behavior
- **Explain why this enhancement would be useful** to most users
- **List any other tools** that have a similar feature

### Pull Requests

1. **Fork the repo** and create your branch from `main`
2. **Make your changes** with clear, descriptive commit messages
3. **Add tests** for any new functionality
4. **Update documentation** if you change behavior
5. **Run the test suite** (when available)
6. **Submit a pull request**

## Development Setup

### Prerequisites

- Node.js 20+
- npm or yarn
- Git

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/PR-reviewer-Example.git
cd PR-reviewer-Example

# Install dependencies
cd .github/pr-reviewer
npm install

# Build the CLI
npm run build

# Link for local development
npm link
```

### Running Tests

```bash
# (Tests coming soon)
npm test
```

### Running Locally

```bash
# Set your API key
export OPENROUTER_API_KEY=your_key_here

# Run a review
pr-reviewer review --pr 123 --repo owner/repo --dry-run
```

## Coding Standards

### TypeScript

- **Strict mode** is enabled - no `any` types without justification
- **Use interfaces** for object types
- **Document public functions** with JSDoc comments
- **Handle errors properly** - use custom error classes

### Commits

- **Use conventional commits** format:
  - `feat: add new feature`
  - `fix: resolve bug`
  - `docs: update documentation`
  - `refactor: improve code structure`
  - `test: add tests`
  - `chore: maintenance tasks`

### Code Style

- **2-space indentation**
- **Single quotes** for strings
- **Trailing commas** in multi-line structures
- **Max line length: 100 characters**

## Project Structure

```
.github/pr-reviewer/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── opencode.ts       # OpenCode runner
│   ├── types.ts          # TypeScript interfaces
│   ├── validation.ts     # Input validation
│   ├── rate-limiter.ts   # Rate limiting
│   ├── logger.ts         # Logging
│   └── platforms/
│       ├── github.ts     # GitHub API
│       └── gitlab.ts     # GitLab API
├── opencode/
│   └── agent/
│       └── code-review.md  # Prompt template
├── package.json
├── tsconfig.json
└── README.md
```

## Questions?

Feel free to open an issue with the `question` label, or start a discussion in the repository.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
