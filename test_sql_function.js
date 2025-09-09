const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Đọc file SQL
const sqlContent = fs.readFileSync('run_hanoi_function.sql', 'utf8');

// Tạo Supabase client
const supabase = createClient(
  'https://db.medsal.vn',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiLm1lZHNhbC52biIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM0NzI0MDAwLCJleHAiOjIwNTAyOTYwMDB9.8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8'
);

async function testFunction() {
  try {
    console.log('🔄 Đang cập nhật SQL function...');
    
    // Chạy SQL function
    const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
    
    if (error) {
      console.error('❌ Lỗi khi cập nhật function:', error);
      return;
    }
    
    console.log('✅ Đã cập nhật SQL function thành công');
    
    // Test function
    console.log('🔄 Đang test function...');
    const { data: testData, error: testError } = await supabase.rpc('get_simple_monthly_salary_hanoi', {
      p_month: 7,
      p_year: 2024,
      p_so_thang_da_chia: 7
    });
    
    if (testError) {
      console.error('❌ Lỗi khi test function:', testError);
      return;
    }
    
    console.log('✅ Test function thành công');
    console.log('📊 Dữ liệu cho Hệ thống KCB ngoại viện:');
    
    const kcbData = testData.find(item => 
      item.department_name && item.department_name.toLowerCase().includes('hệ thống kcb ngoại viện')
    );
    
    if (kcbData) {
      console.log('Tên đơn vị:', kcbData.department_name);
      console.log('Lương FT tháng 7:', kcbData.ft_salary_month);
      console.log('Lương PT tháng 7:', kcbData.pt_salary_month);
      console.log('Tổng quỹ lương tháng 7:', kcbData.total_salary_month);
      console.log('Quỹ lương còn lại được chia:', kcbData.quy_luong_con_lai_duoc_chia);
    } else {
      console.log('Không tìm thấy dữ liệu cho Hệ thống KCB ngoại viện');
    }
    
  } catch (err) {
    console.error('❌ Lỗi:', err);
  }
}

testFunction();
