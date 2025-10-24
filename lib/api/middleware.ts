import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { z } from 'zod';

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  identifier: (request: NextRequest) => string; // Function to identify unique users
}

export function createRateLimit(config: RateLimitConfig) {
  return async function rateLimit(request: NextRequest): Promise<NextResponse | null> {
    const identifier = config.identifier(request);
    const now = Date.now();

    // Get current rate limit data for this identifier
    const current = rateLimitStore.get(identifier);

    if (!current || now > current.resetTime) {
      // New window or expired window
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return null; // Allow request
    }

    if (current.count >= config.maxRequests) {
      // Rate limit exceeded
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((current.resetTime - now) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': current.resetTime.toString(),
            'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString(),
          },
        }
      );
    }

    // Increment counter
    current.count++;
    rateLimitStore.set(identifier, current);

    // Add rate limit headers to response (this won't work directly, but shows the pattern)
    return null; // Allow request
  };
}

// Predefined rate limiters
export const standardRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  identifier: (request) => {
    // Try to get user ID from session, fallback to IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
    return ip;
  },
});

export const syncRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 sync requests per minute
  identifier: (request) => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : request.ip || 'unknown';
    return `sync:${ip}`;
  },
});

export const webhookRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 webhook requests per minute
  identifier: (request) => {
    // Use webhook URL or signature for identification
    const signature = request.headers.get('x-signature') || request.headers.get('signature');
    return `webhook:${signature || 'unknown'}`;
  },
});

// Authentication middleware
export async function requireAuth(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return session;
  } catch (error) {
    console.error('Auth middleware error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}

// Validation middleware
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return async function validate(request: NextRequest): Promise<{ data: T } | NextResponse> {
    try {
      const body = await request.json();
      const data = schema.parse(body);
      return { data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request data',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }
  };
}

// Validation middleware for query parameters
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return function validate(request: NextRequest): { data: T } | NextResponse {
    try {
      const { searchParams } = new URL(request.url);
      const queryData = Object.fromEntries(searchParams.entries());

      // Convert string values to appropriate types
      const processedData: any = {};
      for (const [key, value] of Object.entries(queryData)) {
        if (value === 'true') processedData[key] = true;
        else if (value === 'false') processedData[key] = false;
        else if (!isNaN(Number(value)) && value !== '') processedData[key] = Number(value);
        else processedData[key] = value;
      }

      const data = schema.parse(processedData);
      return { data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.errors.map(err => ({
              field: err.path.join('.'),
              message: err.message,
              code: err.code,
            })),
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid query parameters' },
        { status: 400 }
      );
    }
  };
}

// Error handling utility
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        })),
      },
      { status: 400 }
    );
  }

  // Default error response
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}

// CORS middleware
export function addCorsHeaders(response: NextResponse, origin?: string) {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://your-production-domain.com',
  ];

  const requestOrigin = origin || '*';

  if (allowedOrigins.includes(requestOrigin) || process.env.NODE_ENV === 'development') {
    response.headers.set('Access-Control-Allow-Origin', requestOrigin);
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signature');
  response.headers.set('Access-Control-Allow-Credentials', 'true');

  return response;
}

// Request logging middleware
export function logRequest(request: NextRequest, startTime: number) {
  const duration = Date.now() - startTime;
  const method = request.method;
  const url = request.url;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';

  console.log(`${method} ${url} - ${duration}ms - ${ip} - ${userAgent}`);
}

// Cleanup function for rate limit store (call this periodically)
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);