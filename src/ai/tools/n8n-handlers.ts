import { createClient } from '@supabase/supabase-js';

// Khởi tạo Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Xử lý webhook từ n8n cho việc cập nhật doanh thu
export async function handleRevenueWebhook(data: any) {
  try {
    const { year, month, location, amount } = data;
    
    // Kiểm tra xem bản ghi đã tồn tại chưa
    const { data: existingData } = await supabase
      .from('Doanh_thu')
      .select('*')
      .eq('Năm', year)
      .eq('Tháng', `Tháng ${month.toString().padStart(2, '0')}`)
      .eq('Tên đơn vị', location)
      .single();

    if (existingData) {
      // Cập nhật bản ghi hiện có
      const { error } = await supabase
        .from('Doanh_thu')
        .update({ 'Kỳ báo cáo': amount })
        .eq('Năm', year)
        .eq('Tháng', `Tháng ${month.toString().padStart(2, '0')}`)
        .eq('Tên đơn vị', location);

      if (error) throw error;
    } else {
      // Tạo bản ghi mới
      const { error } = await supabase
        .from('Doanh_thu')
        .insert({
          'Năm': year,
          'Tháng': `Tháng ${month.toString().padStart(2, '0')}`,
          'Tên đơn vị': location,
          'Kỳ báo cáo': amount
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling revenue webhook:', error);
    return { success: false, error: 'Không thể cập nhật doanh thu' };
  }
}

// Xử lý webhook từ n8n cho việc cập nhật lương
export async function handleSalaryWebhook(data: any) {
  try {
    const { employeeId, employeeName, year, month, location, amount, isFulltime } = data;
    
    if (isFulltime) {
      // Cập nhật lương toàn thời gian
      const { error } = await supabase
        .from('Fulltime')
        .upsert({
          ma_nhan_vien: employeeId,
          ho_va_ten: employeeName,
          nam: year,
          thang: `Tháng ${month.toString().padStart(2, '0')}`,
          dia_diem: location,
          tong_thu_nhap: amount
        });

      if (error) throw error;
    } else {
      // Cập nhật lương bán thời gian
      const { error } = await supabase
        .from('Parttime')
        .upsert({
          'Ma nhan vien': employeeId,
          'Ho va ten': employeeName,
          'Nam': year,
          'Thoi gian': `Tháng ${month.toString().padStart(2, '0')}`,
          'Don vi': location,
          'Tong tien': amount
        });

      if (error) throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling salary webhook:', error);
    return { success: false, error: 'Không thể cập nhật lương' };
  }
}

// Xử lý webhook từ n8n cho việc thông báo
export async function handleNotificationWebhook(data: any) {
  try {
    const { type, message, recipients } = data;
    
    // Lưu thông báo vào database
    const { error } = await supabase
      .from('Notifications')
      .insert({
        type,
        message,
        recipients,
        created_at: new Date().toISOString()
      });

    if (error) throw error;

    // Gửi thông báo qua các kênh khác nhau (email, SMS, etc.)
    // TODO: Implement notification sending logic

    return { success: true };
  } catch (error) {
    console.error('Error handling notification webhook:', error);
    return { success: false, error: 'Không thể gửi thông báo' };
  }
} 