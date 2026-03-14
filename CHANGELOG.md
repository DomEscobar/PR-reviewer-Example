# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Architecture documentation and troubleshooting guide

## [2.0.0] - 2026-03-15

### Added
- **Security Features**
  - Prompt injection sanitization via zod validation
  - Rate limiting (5 reviews/hour per repo)
  - Budget controls with cost estimation
  - Permission check for comment authors
  - Idempotency check (skip if reviewed within 1 hour)
  
- **Reliability Features**
  - Pagination for PRs with >100 files
  - Parallel API calls with Promise.allSettled
  - CLI caching via GitHub Actions cache
  - Retry logic (3 retries with exponential backoff)
  - Line validation (only comment on lines in diff)
  
- **Quality Features**
  - TypeScript strict mode enabled
  - Proper interfaces (no `any` types)
  - Structured JSON logging
  - Custom error classes (OpenCodeError, etc.)
  
- **Infrastructure**
  - OpenCode version pinned to 1.2.26
  - package-lock.json added for reproducible builds
  - MIT License added
  - Comprehensive README with setup instructions

### Fixed
- OpenCode model format (now correctly uses `openrouter/openrouter/{model}`)
- Credentials configuration (uses environment variable)
- CLI cache hit now properly installs opencode-ai
- GitHub API 422 errors from invalid line numbers

### Changed
- Minimum Node.js version: 20+
- Workflow permissions reduced to minimum required

## [1.0.0] - 2026-03-14

### Added
- Initial release
- Multi-platform support (GitHub + GitLab)
- OpenCode integration for AI-powered reviews
- Inline line-level comments
- GitHub Actions workflow
- Basic CLI tool

[Unreleased]: https://github.com/DomEscobar/PR-reviewer-Example/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/DomEscobar/PR-reviewer-Example/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/DomEscobar/PR-reviewer-Example/releases/tag/v1.0.0
