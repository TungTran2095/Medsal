const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://db.medsal.vn',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiLm1lZHNhbC52biIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM0NzI0MDAwLCJleHAiOjIwNTAyOTYwMDB9.8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8'
);

async function testKCB() {
  try {
    console.log('🔄 Đang test dữ liệu Hệ thống KCB ngoại viện...');
    
    const { data, error } = await supabase.rpc('get_simple_monthly_salary_hanoi', {
      p_month: 7,
      p_year: 2024,
      p_so_thang_da_chia: 7
    });
    
    if (error) {
      console.error('❌ Lỗi:', error);
      return;
    }
    
    const kcbData = data.find(item => 
      item.department_name && item.department_name.toLowerCase().includes('hệ thống kcb ngoại viện')
    );
    
    if (kcbData) {
      console.log('📊 Dữ liệu Hệ thống KCB ngoại viện:');
      console.log('Tên đơn vị:', kcbData.department_name);
      console.log('Lương FT tháng 7:', kcbData.ft_salary_month?.toLocaleString());
      console.log('Lương PT tháng 7:', kcbData.pt_salary_month?.toLocaleString());
      console.log('Tổng quỹ lương tháng 7:', kcbData.total_salary_month?.toLocaleString());
      console.log('Cumulative FT salary:', kcbData.cumulative_ft_salary?.toLocaleString());
      console.log('Cumulative total salary:', kcbData.cumulative_total_salary?.toLocaleString());
      console.log('Quỹ lương còn lại được chia:', kcbData.quy_luong_con_lai_duoc_chia?.toLocaleString());
      
      // Tính thủ công để kiểm tra
      const quyCung2025 = 975083333 * 12; // Ước tính từ quy_luong_chuan
      const thangConLai = 12 - 7;
      const manualCalculation = (quyCung2025 - kcbData.cumulative_ft_salary) / thangConLai;
      console.log('Tính thủ công (quy_cung_2025 - cumulative_ft_salary) / thang_con_lai:', manualCalculation?.toLocaleString());
    } else {
      console.log('Không tìm thấy dữ liệu cho Hệ thống KCB ngoại viện');
    }
    
  } catch (err) {
    console.error('❌ Lỗi:', err);
  }
}

testKCB();
