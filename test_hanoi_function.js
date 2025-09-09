// Test script để kiểm tra function get_simple_monthly_salary_hanoi
// Chạy: node test_hanoi_function.js

const { createClient } = require('@supabase/supabase-js');

// Sử dụng URL và key từ environment hoặc hardcode tạm thời
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jzsmtjybaasbcnuescnh.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6c210anliYWFzYmNudWVzY25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5NzQ4MDAsImV4cCI6MjA1MDU1MDgwMH0.8K8vK8vK8vK8vK8vK8vK8vK8vK8vK8vK8vK8vK8vK8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testHanoiFunction() {
  try {
    console.log('🧪 Testing function get_simple_monthly_salary_hanoi...');
    
    // Test với tháng 7
    const { data, error } = await supabase.rpc('get_simple_monthly_salary_hanoi', {
      p_filter_year: 2025,
      p_filter_month: 7
    });

    if (error) {
      console.error('❌ Lỗi khi gọi function:', error);
      return;
    }

    console.log('✅ Function chạy thành công!');
    console.log('📊 Số rows trả về:', data?.length || 0);
    
    if (data && data.length > 0) {
      console.log('📋 Dữ liệu mẫu (3 rows đầu):');
      data.slice(0, 3).forEach((row, index) => {
        console.log(`Row ${index + 1}:`, {
          department_name: row.department_name,
          ft_salary_month: row.ft_salary_month,
          pt_salary_month: row.pt_salary_month,
          total_salary_month: row.total_salary_month
        });
      });
      
      console.log('📋 Tất cả department names:');
      data.forEach(row => {
        console.log('-', row.department_name);
      });
    } else {
      console.log('⚠️ Không có dữ liệu trả về');
    }

  } catch (err) {
    console.error('❌ Lỗi:', err);
  }
}

testHanoiFunction();


