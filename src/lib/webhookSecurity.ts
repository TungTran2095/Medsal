import { NextRequest } from 'next/server';
import crypto from 'crypto';

// Rate limiting store (trong production nên dùng Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Webhook secret key (nên lưu trong environment variables)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret-key';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 phút
};

/**
 * Verify webhook signature để đảm bảo webhook đến từ nguồn đáng tin cậy
 */
export function verifyWebhookSignature(
  signature: string | null,
  body: string,
  secret: string = WEBHOOK_SECRET
): boolean {
  if (!signature) {
    console.warn('Webhook signature missing');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('hex');

    // Sử dụng timing-safe comparison để tránh timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    return false;
  }
}

/**
 * Rate limiting để ngăn chặn spam và DoS attacks
 */
export function isRateLimited(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    // Tạo record mới hoặc reset
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return false;
  }

  if (record.count >= config.maxRequests) {
    return true; // Rate limited
  }

  // Tăng counter
  record.count++;
  return false;
}

/**
 * Cleanup expired rate limit records
 */
export function cleanupExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup mỗi 5 phút
setInterval(cleanupExpiredRateLimits, 5 * 60 * 1000);

/**
 * Generate webhook signature cho testing
 */
export function generateWebhookSignature(body: string, secret: string = WEBHOOK_SECRET): string {
  return crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
}

/**
 * Validate webhook payload với Zod schema
 */
export function validateWebhookPayload<T>(
  payload: unknown,
  schema: any
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validatedData = schema.parse(payload);
    return { success: true, data: validatedData };
  } catch (error: any) {
    return {
      success: false,
      error: error.errors?.[0]?.message || 'Invalid payload format'
    };
  }
}
