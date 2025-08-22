import { NextResponse } from 'next/server';
import { handleRevenueWebhook, handleSalaryWebhook, handleNotificationWebhook } from '@/ai/tools/n8n-handlers';
import { 
  verifyWebhookSignature, 
  isRateLimited, 
  validateWebhookPayload 
} from '@/lib/webhookSecurity';
import { z } from 'zod';

// Webhook payload schema validation
const webhookSchema = z.object({
  type: z.enum(['revenue', 'salary', 'notification']),
  data: z.any(),
  timestamp: z.number().optional(),
  source: z.string().optional()
});

export async function POST(request: Request) {
  try {
    // Rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { 
          error: 'Rate limited. Too many requests.',
          retryAfter: 60 
        }, 
        { 
          status: 429,
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0'
          }
        }
      );
    }

    // Verify webhook signature
    const signature = request.headers.get('x-webhook-signature');
    const body = await request.text();
    
    if (!verifyWebhookSignature(signature, body)) {
      console.warn(`Invalid webhook signature from IP: ${clientIP}`);
      return NextResponse.json(
        { error: 'Unauthorized webhook signature' },
        { status: 401 }
      );
    }

    // Parse and validate payload
    const rawData = JSON.parse(body);
    const validation = validateWebhookPayload(rawData, webhookSchema);
    
    if (!validation.success) {
      console.warn(`Invalid webhook payload from IP: ${clientIP}`, validation.error);
      return NextResponse.json(
        { error: `Invalid payload: ${validation.error}` },
        { status: 400 }
      );
    }

    const { type, data } = validation.data;

    // Log webhook request (không log sensitive data)
    console.log(`Processing webhook type: ${type} from IP: ${clientIP}`);

    let result;
    switch (type) {
      case 'revenue':
        result = await handleRevenueWebhook(data);
        break;
      case 'salary':
        result = await handleSalaryWebhook(data);
        break;
      case 'notification':
        result = await handleNotificationWebhook(data);
        break;
      default:
        console.warn(`Unsupported webhook type: ${type} from IP: ${clientIP}`);
        return NextResponse.json(
          { error: 'Loại webhook không được hỗ trợ' },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error(`Webhook processing failed for type: ${type}`, result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    console.log(`Webhook processed successfully: ${type} from IP: ${clientIP}`);
    return NextResponse.json({ 
      success: true,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Không expose internal errors ra client
    return NextResponse.json(
      { error: 'Lỗi xử lý webhook' },
      { status: 500 }
    );
  }
}

// Thêm OPTIONS method để hỗ trợ CORS preflight
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-webhook-signature',
      'Access-Control-Max-Age': '86400',
    },
  });
} 