const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Cấu hình Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Thiếu biến môi trường SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  console.log('💡 Hãy tạo file .env với:');
  console.log('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url');
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deploySalaryRevenueRatioFunction() {
  try {
    console.log('🚀 Bắt đầu deploy function get_salary_revenue_ratio_by_location...');
    
    // Đọc file SQL function
    const sqlFilePath = path.join(__dirname, 'get_salary_revenue_ratio_by_location_function.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📄 Đọc file SQL function thành công');
    console.log('📝 Nội dung SQL function:');
    console.log(sqlContent.substring(0, 200) + '...');
    
    // Tách SQL thành các câu lệnh riêng biệt
    const sqlStatements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📊 Tìm thấy ${sqlStatements.length} câu lệnh SQL`);
    
    // Thực thi từng câu lệnh SQL
    for (let i = 0; i < sqlStatements.length; i++) {
      const statement = sqlStatements[i];
      if (statement.length === 0) continue;
      
      console.log(`🔄 Thực thi câu lệnh ${i + 1}/${sqlStatements.length}...`);
      console.log(`   ${statement.substring(0, 100)}...`);
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_query: statement + ';'
        });
        
        if (error) {
          console.error(`❌ Lỗi ở câu lệnh ${i + 1}:`, error);
          console.error('📝 Câu lệnh gây lỗi:', statement);
          return;
        }
        
        console.log(`✅ Câu lệnh ${i + 1} thực thi thành công`);
      } catch (stmtError) {
        console.error(`❌ Lỗi không mong muốn ở câu lệnh ${i + 1}:`, stmtError);
        console.error('📝 Câu lệnh gây lỗi:', statement);
        return;
      }
    }
    
    console.log('✅ Deploy function get_salary_revenue_ratio_by_location thành công!');
    console.log('📊 Function đã được tạo với các tính năng:');
    console.log('   - Tính tỷ lệ lương/doanh thu theo địa điểm');
    console.log('   - Tính tỷ lệ lương Fulltime/doanh thu');
    console.log('   - Tính QL/DT được phép từ bảng Chi_tieu_2025');
    console.log('   - Hỗ trợ filter theo năm, tháng, địa điểm, ngành dọc, đơn vị 2');
    
    // Test function
    console.log('🧪 Kiểm tra function...');
    const { data: testData, error: testError } = await supabase.rpc('get_salary_revenue_ratio_by_location', {
      p_filter_year: 2024,
      p_filter_months: [1],
      p_filter_locations: null,
      p_filter_nganh_docs: null,
      p_filter_donvi2: null
    });
    
    if (testError) {
      console.error('❌ Lỗi khi test function:', testError);
    } else {
      console.log(`✅ Test thành công! Function trả về ${testData?.length || 0} bản ghi`);
    }
    
  } catch (err) {
    console.error('❌ Lỗi không mong muốn:', err);
  }
}

// Chạy deploy function
deploySalaryRevenueRatioFunction();
