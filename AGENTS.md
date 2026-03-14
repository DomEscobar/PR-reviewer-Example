# PR Reviewer Example

A simple Vue TypeScript project demonstrating automated PR code reviews using OpenRouter API.

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **CI/CD**: GitHub Actions
- **AI Review**: OpenRouter API (Claude, GPT, etc.)

## Project Structure

```
src/
├── App.vue          # Main app component
├── main.ts          # Entry point
└── components/      # Vue components
```

## Code Style

- Use TypeScript strict mode
- Prefer Composition API (`<script setup>`)
- Scoped styles in Vue components
- Keep components small and focused

## Review Guidelines

When reviewing PRs for this project:
- Check TypeScript type safety
- Verify Vue best practices
- Ensure proper error handling
- Look for potential XSS vulnerabilities in templates