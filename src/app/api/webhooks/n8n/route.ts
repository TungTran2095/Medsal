import { NextResponse } from 'next/server';
import { handleRevenueWebhook, handleSalaryWebhook, handleNotificationWebhook } from '@/ai/tools/n8n-handlers';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { type } = data;

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
        return NextResponse.json(
          { error: 'Loại webhook không được hỗ trợ' },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Lỗi xử lý webhook' },
      { status: 500 }
    );
  }
} 