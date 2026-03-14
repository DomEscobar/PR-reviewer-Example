// Input validation schemas
export const PromptSchema = z.object({
  prompt: z.string()
    .max(1000, 'Prompt too long (max 1000 chars)')
    .refine(val => !/ignore\s+(all\s+)?(previous|above)/gi.test(val), 
      'Potential prompt injection detected')
    .refine(val => !/system\s*:/gi.test(val),
      'System instruction not allowed')
    .refine(val => !/assistant\s*:/gi.test(val),
      'Assistant instruction not allowed')
    .refine(val => !/\boutput\s*:/gi.test(val),
      'Output instruction not allowed')
    .optional(),
});

export const ModelSchema = z.string()
  .regex(/^[a-z0-9\-\/\.]+$/i, 'Invalid model name')
  .max(100, 'Model name too long');

export const RepoSchema = z.string()
  .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/, 'Invalid repo format (expected owner/repo)');

export const PRNumberSchema = z.number().int().positive();

// Sanitization functions
export function sanitizePrompt(input: string | undefined): string {
  if (!input) return '';
  
  return input
    // Remove potential injection patterns
    .replace(/ignore\s+(all\s+)?(previous|above|prior)/gi, '[REDACTED]')
    .replace(/system\s*:/gi, '[REDACTED]:')
    .replace(/assistant\s*:/gi, '[REDACTED]:')
    .replace(/\boutput\s*:/gi, '[REDACTED]:')
    .replace(/you\s+are\s+now/gi, '[REDACTED]')
    .replace(/disregard/gi, '[REDACTED]')
    // Limit length
    .slice(0, 500)
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

export function validateModel(model: string): string {
  const result = ModelSchema.safeParse(model);
  if (!result.success) {
    throw new Error(`Invalid model: ${result.error.errors[0].message}`);
  }
  return model;
}

export function validateRepo(repo: string): string {
  const result = RepoSchema.safeParse(repo);
  if (!result.success) {
    throw new Error(`Invalid repo format: ${result.error.errors[0].message}`);
  }
  return repo;
}

import { z } from 'zod';