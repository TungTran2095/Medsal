import { z } from 'zod';

/**
 * Input validation schemas
 */
export const userInputSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s]+$/),
  email: z.string().email(),
  phone: z.string().regex(/^[0-9+\-\s()]+$/).optional(),
  message: z.string().max(1000).optional()
});

export const fileUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimetype: z.string().regex(/^[a-zA-Z0-9]+\/[a-zA-Z0-9]+$/),
  size: z.number().max(10 * 1024 * 1024), // 10MB max
  encoding: z.string().optional()
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\s\-_]+$/),
  page: z.number().min(1).max(1000).optional(),
  limit: z.number().min(1).max(100).optional()
});

/**
 * SQL Injection Prevention
 */
export function sanitizeSQLInput(input: string): string {
  // Remove dangerous SQL characters
  return input
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/xp_/gi, '')
    .replace(/sp_/gi, '')
    .replace(/exec/gi, '')
    .replace(/execute/gi, '')
    .replace(/insert/gi, '')
    .replace(/update/gi, '')
    .replace(/delete/gi, '')
    .replace(/drop/gi, '')
    .replace(/create/gi, '')
    .replace(/alter/gi, '')
    .replace(/union/gi, '')
    .replace(/select/gi, '');
}

/**
 * XSS Prevention
 */
export function sanitizeHTMLInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * File Upload Security
 */
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size too large' };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.txt', '.doc', '.docx'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'File extension not allowed' };
  }

  return { valid: true };
}

/**
 * Rate Limiting Helper
 */
export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const record = this.requests.get(identifier);

    if (!record || now > record.resetTime) {
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemaining(identifier: string): number {
    const record = this.requests.get(identifier);
    if (!record) return this.maxRequests;
    return Math.max(0, this.maxRequests - record.count);
  }

  getResetTime(identifier: string): number {
    const record = this.requests.get(identifier);
    return record?.resetTime || Date.now();
  }
}

/**
 * CSRF Protection
 */
export function generateCSRFToken(): string {
  return crypto.randomUUID();
}

export function validateCSRFToken(token: string, storedToken: string): boolean {
  return token === storedToken;
}

/**
 * Password Strength Validation
 */
export function validatePasswordStrength(password: string): { valid: boolean; score: number; feedback: string[] } {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 8) score += 1;
  else feedback.push('Password must be at least 8 characters long');

  // Uppercase check
  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one uppercase letter');

  // Lowercase check
  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one lowercase letter');

  // Number check
  if (/\d/.test(password)) score += 1;
  else feedback.push('Password must contain at least one number');

  // Special character check
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('Password must contain at least one special character');

  const valid = score >= 4; // Require at least 4 out of 5 criteria

  return { valid, score, feedback };
}

/**
 * Logging Security
 */
export function sanitizeLogData(data: any): any {
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = { ...data };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  
  return data;
}
