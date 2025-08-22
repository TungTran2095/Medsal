import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter } from './security';

/**
 * API Security Middleware Wrapper
 */
export interface APISecurityConfig {
  requireAuth?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
  allowedMethods?: string[];
  validateInput?: boolean;
  cors?: {
    allowedOrigins?: string[];
    allowedMethods?: string[];
    allowedHeaders?: string[];
  };
}

const defaultConfig: APISecurityConfig = {
  requireAuth: true,
  rateLimit: {
    maxRequests: 10,
    windowMs: 60000
  },
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  validateInput: true,
  cors: {
    allowedOrigins: ['http://localhost:9002'],
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }
};

/**
 * CORS Headers
 */
function getCORSHeaders(origin: string, config: APISecurityConfig): Record<string, string> {
  const corsConfig = config.cors || defaultConfig.cors!;
  const allowedOrigins = corsConfig.allowedOrigins || ['*'];
  
  const isAllowedOrigin = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': (corsConfig.allowedMethods || ['GET', 'POST', 'PUT', 'DELETE']).join(', '),
    'Access-Control-Allow-Headers': (corsConfig.allowedHeaders || ['Content-Type', 'Authorization']).join(', '),
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true'
  };
}

/**
 * Rate Limiting
 */
const rateLimiters = new Map<string, RateLimiter>();

function getRateLimiter(identifier: string, config: APISecurityConfig): RateLimiter {
  const key = `${identifier}_${config.rateLimit?.maxRequests}_${config.rateLimit?.windowMs}`;
  
  if (!rateLimiters.has(key)) {
    const limiter = new RateLimiter(
      config.rateLimit?.maxRequests || 10,
      config.rateLimit?.windowMs || 60000
    );
    rateLimiters.set(key, limiter);
  }
  
  return rateLimiters.get(key)!;
}

/**
 * API Security Middleware
 */
export function withAPISecurity(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: APISecurityConfig = {}
) {
  return async (request: NextRequest) => {
    const finalConfig = { ...defaultConfig, ...config };
    
    // CORS Preflight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('origin') || '';
      return new NextResponse(null, {
        status: 200,
        headers: getCORSHeaders(origin, finalConfig)
      });
    }

    // Method Validation
    if (!finalConfig.allowedMethods?.includes(request.method)) {
      return NextResponse.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { 'Allow': finalConfig.allowedMethods?.join(', ') || '' } }
      );
    }

    // Rate Limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    const rateLimiter = getRateLimiter(clientIP, finalConfig);
    if (!rateLimiter.isAllowed(clientIP)) {
      const resetTime = rateLimiter.getResetTime(clientIP);
      return NextResponse.json(
        { 
          error: 'Rate limited',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': (finalConfig.rateLimit?.maxRequests || 10).toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString()
          }
        }
      );
    }

    // CORS Headers
    const origin = request.headers.get('origin') || '';
    const corsHeaders = getCORSHeaders(origin, finalConfig);

    try {
      // Call the actual handler
      const response = await handler(request);
      
      // Add CORS headers to response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', (finalConfig.rateLimit?.maxRequests || 10).toString());
      response.headers.set('X-RateLimit-Remaining', rateLimiter.getRemaining(clientIP).toString());
      response.headers.set('X-RateLimit-Reset', rateLimiter.getResetTime(clientIP).toString());
      
      return response;
      
    } catch (error) {
      console.error('API Error:', error);
      
      return NextResponse.json(
        { error: 'Internal server error' },
        { 
          status: 500,
          headers: corsHeaders
        }
      );
    }
  };
}

/**
 * Input Validation Middleware
 */
export function withInputValidation<T>(
  schema: any,
  handler: (req: NextRequest, data: T) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    try {
      let data: T;
      
      if (request.method === 'GET') {
        // Parse query parameters
        const url = new URL(request.url);
        const queryData: any = {};
        url.searchParams.forEach((value, key) => {
          queryData[key] = value;
        });
        data = schema.parse(queryData);
      } else {
        // Parse request body
        const body = await request.json();
        data = schema.parse(body);
      }
      
      return await handler(request, data);
      
    } catch (error: any) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: error.errors?.[0]?.message || 'Validation failed'
        },
        { status: 400 }
      );
    }
  };
}

/**
 * Authentication Middleware
 */
export function withAuth(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    // Check for authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }
    
    const token = authHeader.substring(7);
    
    // TODO: Implement proper token validation
    // For now, just check if token exists
    if (!token) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }
    
    return await handler(request);
  };
}
