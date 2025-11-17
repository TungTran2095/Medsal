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

async function deployFunction() {
  try {
    console.log('🚀 Bắt đầu deploy function get_salary_revenue_ratio_by_location...');
    
    // Đọc file SQL function
    const sqlFilePath = path.join(__dirname, 'get_salary_revenue_ratio_by_location_function.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('📄 Đọc file SQL function thành công');
    
    // Thực thi SQL trực tiếp qua Supabase client
    const { data, error } = await supabase
      .from('_realtime_schema')
      .select('*')
      .limit(0); // Test connection
    
    if (error && !error.message.includes('relation "_realtime_schema" does not exist')) {
      console.error('❌ Lỗi kết nối Supabase:', error);
      return;
    }
    
    console.log('✅ Kết nối Supabase thành công');
    
    // Thực thi SQL function bằng cách gọi trực tiếp
    console.log('🔄 Thực thi SQL function...');
    
    // Tách SQL thành các phần
    const dropFunction = `DROP FUNCTION IF EXISTS get_salary_revenue_ratio_by_location(INTEGER, INTEGER[], TEXT[], TEXT[], TEXT[]);`;
    const createFunction = sqlContent.replace(dropFunction, '').trim();
    
    // Thực thi DROP FUNCTION trước
    try {
      const { error: dropError } = await supabase.rpc('exec_sql', { 
        sql_query: dropFunction 
      });
      if (dropError) {
        console.log('⚠️ Không thể drop function cũ (có thể chưa tồn tại):', dropError.message);
      } else {
        console.log('✅ Drop function cũ thành công');
      }
    } catch (dropErr) {
      console.log('⚠️ Không thể drop function cũ:', dropErr.message);
    }
    
    // Thực thi CREATE FUNCTION
    try {
      const { error: createError } = await supabase.rpc('exec_sql', { 
        sql_query: createFunction 
      });
      
      if (createError) {
        console.error('❌ Lỗi khi tạo function:', createError);
        console.log('📝 SQL gây lỗi:');
        console.log(createFunction.substring(0, 500) + '...');
        return;
      }
      
      console.log('✅ Tạo function thành công!');
    } catch (createErr) {
      console.error('❌ Lỗi không mong muốn khi tạo function:', createErr);
      return;
    }
    
    // Test function
    console.log('🧪 Kiểm tra function...');
    try {
    const { data: testData, error: testError } = await supabase.rpc('get_salary_revenue_ratio_by_location', {
      p_filter_year: 2024,
      p_filter_months: [1], // Array sẽ được tự động convert
      p_filter_locations: null,
      p_filter_nganh_docs: null,
      p_filter_donvi2: null
    });
      
      if (testError) {
        console.error('❌ Lỗi khi test function:', testError);
      } else {
        console.log(`✅ Test thành công! Function trả về ${testData?.length || 0} bản ghi`);
        if (testData && testData.length > 0) {
          console.log('📊 Mẫu dữ liệu:');
          console.log('   - Địa điểm:', testData[0].ten_don_vi);
          console.log('   - Tỷ lệ tổng lương/doanh thu:', (testData[0].ty_le_luong_doanh_thu * 100).toFixed(2) + '%');
          console.log('   - QL/DT được phép:', (testData[0].ty_le_ql_dt_duoc_phep * 100).toFixed(2) + '%');
        }
      }
    } catch (testErr) {
      console.error('❌ Lỗi khi test function:', testErr);
    }
    
    console.log('🎉 Deploy hoàn tất!');
    console.log('📊 Function đã được tạo với các tính năng:');
    console.log('   - Tính tỷ lệ lương/doanh thu theo địa điểm');
    console.log('   - Tính tỷ lệ lương Fulltime/doanh thu');
    console.log('   - Tính QL/DT được phép từ bảng Chi_tieu_2025');
    console.log('   - Hỗ trợ filter theo năm, tháng, địa điểm, ngành dọc, đơn vị 2');
    
  } catch (err) {
    console.error('❌ Lỗi không mong muốn:', err);
  }
}

// Chạy deploy function
deployFunction();
