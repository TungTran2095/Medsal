const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://db.medsal.vn',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiLm1lZHNhbC52biIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzM0NzI0MDAwLCJleHAiOjIwNTAyOTYwMDB9.8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8QZ8'
);

async function testKPIFunction() {
  try {
    console.log('🔄 Đang test KPI function cho 4 đơn vị khám chữa bệnh...');
    
    // Test function
    const { data, error } = await supabase.rpc('get_nganhdoc_salary_kpi_2025_hanoi', {
      p_filter_year: 2025,
      p_filter_months: [7]
    });
    
    if (error) {
      console.error('❌ Lỗi khi test function:', error);
      return;
    }
    
    console.log('✅ Test function thành công');
    console.log('📊 Dữ liệu cho 4 đơn vị khám chữa bệnh:');
    
    const targetUnits = [
      'Bệnh viện đa khoa Medlatec',
      'Phòng Khám đa khoa Cầu Giấy', 
      'Phòng Khám đa khoa Tây Hồ',
      'Phòng Khám đa khoa Thanh Xuân'
    ];
    
    targetUnits.forEach(unitName => {
      const unitData = data.find(item => 
        item.department_name && item.department_name.includes(unitName)
      );
      
      if (unitData) {
        console.log(`\n🏥 ${unitData.department_name}:`);
        console.log('  Lương FT 2025:', unitData.ft_salary_2025?.toLocaleString() || '0');
        console.log('  Lương PT 2025:', unitData.pt_salary_2025?.toLocaleString() || '0');
        console.log('  Tổng lương 2025:', unitData.total_salary_2025?.toLocaleString() || '0');
        console.log('  Quỹ cứng 2025:', unitData.quy_cung_2025?.toLocaleString() || '0');
      } else {
        console.log(`\n❌ Không tìm thấy dữ liệu cho: ${unitName}`);
      }
    });
    
  } catch (err) {
    console.error('❌ Lỗi:', err);
  }
}

testKPIFunction();
