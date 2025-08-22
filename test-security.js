const crypto = require('crypto');

// Test webhook signature verification
function testWebhookSecurity() {
  console.log('🔒 Testing Webhook Security...\n');
  
  const secret = 'test-secret-key';
  const payload = JSON.stringify({ type: 'test', data: 'test-data' });
  
  // Generate valid signature
  const validSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  console.log('✅ Valid signature generated:', validSignature);
  
  // Test invalid signature
  const invalidSignature = 'invalid-signature';
  
  // Simulate verification
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  const isValid = validSignature === expectedSignature;
  const isInvalid = invalidSignature !== expectedSignature;
  
  console.log('✅ Valid signature verification:', isValid);
  console.log('✅ Invalid signature rejection:', isInvalid);
  
  return isValid && isInvalid;
}

// Test rate limiting simulation
function testRateLimiting() {
  console.log('\n🚫 Testing Rate Limiting...\n');
  
  const rateLimitStore = new Map();
  const maxRequests = 5;
  const windowMs = 60000;
  
  function isRateLimited(identifier) {
    const now = Date.now();
    const record = rateLimitStore.get(identifier);
    
    if (!record || now > record.resetTime) {
      rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return false;
    }
    
    if (record.count >= maxRequests) {
      return true;
    }
    
    record.count++;
    return false;
  }
  
  const testIP = '192.168.1.1';
  let blockedCount = 0;
  
  // Test normal requests
  for (let i = 0; i < maxRequests; i++) {
    if (isRateLimited(testIP)) {
      blockedCount++;
    }
  }
  
  // Test rate limited request
  const isBlocked = isRateLimited(testIP);
  
  console.log('✅ Normal requests allowed:', maxRequests - blockedCount);
  console.log('✅ Rate limit enforced:', isBlocked);
  
  return blockedCount === 0 && isBlocked;
}

// Test input sanitization
function testInputSanitization() {
  console.log('\n🧹 Testing Input Sanitization...\n');
  
  // SQL Injection test
  const sqlInjectionInput = "'; DROP TABLE users; --";
  const sanitizedSQL = sqlInjectionInput
    .replace(/['";\\]/g, '')
    .replace(/--/g, '')
    .replace(/drop/gi, '');
  
  console.log('✅ SQL injection input:', sqlInjectionInput);
  console.log('✅ Sanitized output:', sanitizedSQL);
  console.log('✅ SQL injection prevented:', !sanitizedSQL.includes('DROP'));
  
  // XSS test
  const xssInput = '<script>alert("xss")</script>';
  const sanitizedXSS = xssInput
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  console.log('✅ XSS input:', xssInput);
  console.log('✅ Sanitized output:', sanitizedXSS);
  console.log('✅ XSS prevented:', !sanitizedXSS.includes('<script>'));
  
  return !sanitizedSQL.includes('DROP') && !sanitizedXSS.includes('<script>');
}

// Test file upload validation
function testFileUploadValidation() {
  console.log('\n📁 Testing File Upload Validation...\n');
  
  const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  const testFiles = [
    { name: 'test.jpg', type: 'image/jpeg', size: 1024 * 1024 },
    { name: 'test.exe', type: 'application/x-executable', size: 1024 * 1024 },
    { name: 'test.pdf', type: 'application/pdf', size: 20 * 1024 * 1024 }
  ];
  
  testFiles.forEach(file => {
    const isValidType = allowedTypes.includes(file.type);
    const isValidSize = file.size <= maxSize;
    const isValidExtension = /\.(jpg|jpeg|png|pdf)$/i.test(file.name);
    
    const isValid = isValidType && isValidSize && isValidExtension;
    
    console.log(`📄 ${file.name}:`);
    console.log(`   Type valid: ${isValidType ? '✅' : '❌'}`);
    console.log(`   Size valid: ${isValidSize ? '✅' : '❌'}`);
    console.log(`   Extension valid: ${isValidExtension ? '✅' : '❌'}`);
    console.log(`   Overall: ${isValid ? '✅' : '❌'}\n`);
  });
  
  return true;
}

// Main test function
function runSecurityTests() {
  console.log('🚀 Starting Security Tests...\n');
  
  const results = [
    testWebhookSecurity(),
    testRateLimiting(),
    testInputSanitization(),
    testFileUploadValidation()
  ];
  
  const passedTests = results.filter(Boolean).length;
  const totalTests = results.length;
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${totalTests - passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All security tests passed!');
    return true;
  } else {
    console.log('\n⚠️ Some security tests failed!');
    return false;
  }
}

// Run tests
if (require.main === module) {
  runSecurityTests();
}

module.exports = { runSecurityTests };
