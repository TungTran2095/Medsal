# 🔒 Security Guide - Hệ thống Medsal

## 📋 Tổng quan

Tài liệu này mô tả các biện pháp bảo mật đã được implement trong hệ thống Medsal và hướng dẫn sử dụng.

## 🚨 Các biện pháp bảo mật đã implement

### 1. Webhook Security
- **Signature Verification**: Sử dụng HMAC-SHA256 để verify webhook authenticity
- **Rate Limiting**: Giới hạn 10 requests/phút cho mỗi IP
- **Input Validation**: Sử dụng Zod schema để validate payload
- **CORS Protection**: Chỉ cho phép các origin được phép

### 2. API Security
- **Authentication Middleware**: Bảo vệ các API endpoints
- **Rate Limiting**: Ngăn chặn spam và DoS attacks
- **Input Sanitization**: Loại bỏ SQL injection và XSS attacks
- **CORS Configuration**: Kiểm soát cross-origin requests

### 3. Middleware Security
- **Security Headers**: X-Frame-Options, CSP, XSS Protection
- **Route Protection**: Bảo vệ các routes cần authentication
- **Content Security Policy**: Ngăn chặn XSS và injection attacks

### 4. Input Validation
- **Zod Schemas**: Validate tất cả user input
- **SQL Injection Prevention**: Sanitize SQL input
- **XSS Prevention**: Sanitize HTML input
- **File Upload Security**: Validate file type, size, và extension

## 🛠️ Cách sử dụng

### Webhook Security

```typescript
import { verifyWebhookSignature, isRateLimited } from '@/lib/webhookSecurity';

// Verify signature
const signature = request.headers.get('x-webhook-signature');
if (!verifyWebhookSignature(signature, body)) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Rate limiting
if (isRateLimited(clientIP)) {
  return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
}
```

### API Security Middleware

```typescript
import { withAPISecurity, withInputValidation } from '@/lib/apiSecurity';
import { userInputSchema } from '@/lib/security';

// Bảo vệ API với security
export const POST = withAPISecurity(async (req: NextRequest) => {
  // Your API logic here
});

// Validate input
export const POST = withInputValidation(userInputSchema, async (req, data) => {
  // data đã được validate
});
```

### Input Validation

```typescript
import { sanitizeSQLInput, sanitizeHTMLInput, validateFileUpload } from '@/lib/security';

// Sanitize SQL input
const safeInput = sanitizeSQLInput(userInput);

// Sanitize HTML input
const safeHTML = sanitizeHTMLInput(userInput);

// Validate file upload
const validation = validateFileUpload(file);
if (!validation.valid) {
  throw new Error(validation.error);
}
```

## 🔐 Environment Variables

Tạo file `.env.local` với các biến sau:

```bash
# Webhook Security
WEBHOOK_SECRET=your_secure_webhook_secret_here

# Supabase (không dùng NEXT_PUBLIC_ prefix cho sensitive data)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# Application Security
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:9002

# Rate Limiting
API_RATE_LIMIT_MAX=10
API_RATE_LIMIT_WINDOW_MS=60000
```

## 🚨 Security Checklist

### Trước khi deploy production
- [ ] Thay đổi tất cả default secrets
- [ ] Cấu hình HTTPS
- [ ] Cấu hình database RLS
- [ ] Test tất cả security features
- [ ] Review và update dependencies
- [ ] Cấu hình logging và monitoring

### Regular Security Tasks
- [ ] Update dependencies hàng tuần
- [ ] Review security logs hàng ngày
- [ ] Test penetration testing hàng tháng
- [ ] Review access logs hàng tuần
- [ ] Backup và encrypt data

## 🧪 Testing Security

### Test Webhook Security
```bash
# Test invalid signature
curl -X POST http://localhost:9002/api/webhooks/n8n \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: invalid" \
  -d '{"type":"test"}'

# Test rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:9002/api/webhooks/n8n \
    -H "Content-Type: application/json" \
    -H "x-webhook-signature: valid_signature" \
    -d '{"type":"test"}'
done
```

### Test API Security
```bash
# Test unauthorized access
curl http://localhost:9002/api/protected

# Test CORS
curl -H "Origin: http://malicious.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: X-Requested-With" \
  -X OPTIONS http://localhost:9002/api/webhooks/n8n
```

## 📊 Security Monitoring

### Logs cần monitor
- Failed authentication attempts
- Rate limit violations
- Invalid webhook signatures
- SQL injection attempts
- XSS attempts
- File upload violations

### Metrics cần track
- Request rate per IP
- Authentication success/failure rate
- Webhook processing time
- Error rates by endpoint
- File upload success/failure rate

## 🔧 Troubleshooting

### Common Issues

1. **Webhook signature verification fails**
   - Kiểm tra WEBHOOK_SECRET environment variable
   - Verify signature generation ở sender side

2. **Rate limiting too aggressive**
   - Điều chỉnh `maxRequests` và `windowMs` trong config
   - Kiểm tra IP detection logic

3. **CORS errors**
   - Kiểm tra `allowedOrigins` configuration
   - Verify preflight request handling

4. **Security headers not working**
   - Kiểm tra Next.js config
   - Verify middleware execution order

## 📚 References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Supabase Security](https://supabase.com/docs/guides/security)
- [Zod Validation](https://zod.dev/)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

## 🆘 Emergency Contacts

- **Security Team**: security@medsal.com
- **DevOps Team**: devops@medsal.com
- **Emergency Hotline**: +84-xxx-xxx-xxx

---

**⚠️ Lưu ý**: Tài liệu này chứa thông tin nhạy cảm. Chỉ chia sẻ với team members có quyền truy cập.
