import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { 
  searchClinicSchema,
  checkDuplicateClinicSchema,
  getClinicDetailsSchema,
  updateClinicSchema,
  deleteClinicSchema,
  searchRevenueSchema,
  searchSalarySchema,
  compareRevenueSalarySchema
} from './chatbot-functions';

// Khởi tạo Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Handler cho việc tìm kiếm phòng khám
export async function handleSearchClinic(params: z.infer<typeof searchClinicSchema>) {
  try {
    let query = supabase.from('clinics').select('*');
    
    if (params.name) {
      query = query.ilike('name', `%${params.name}%`);
    }
    if (params.location) {
      query = query.ilike('address', `%${params.location}%`);
    }
    if (params.specialty) {
      query = query.ilike('specialty', `%${params.specialty}%`);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error searching clinics:', error);
    return { success: false, error: 'Không thể tìm kiếm phòng khám' };
  }
}

// Handler cho việc kiểm tra trùng lặp phòng khám
export async function handleCheckDuplicateClinic(params: z.infer<typeof checkDuplicateClinicSchema>) {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .or(`name.ilike.%${params.name}%,address.ilike.%${params.address}%`)
      .limit(1);

    if (error) throw error;
    
    return {
      success: true,
      isDuplicate: data && data.length > 0,
      duplicateData: data?.[0] || null
    };
  } catch (error) {
    console.error('Error checking duplicate clinic:', error);
    return { success: false, error: 'Không thể kiểm tra trùng lặp phòng khám' };
  }
}

// Handler cho việc lấy thông tin chi tiết phòng khám
export async function handleGetClinicDetails(params: z.infer<typeof getClinicDetailsSchema>) {
  try {
    const { data, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', params.clinicId)
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error getting clinic details:', error);
    return { success: false, error: 'Không thể lấy thông tin phòng khám' };
  }
}

// Handler cho việc cập nhật thông tin phòng khám
export async function handleUpdateClinic(params: z.infer<typeof updateClinicSchema>) {
  try {
    const updateData: any = {};
    if (params.name) updateData.name = params.name;
    if (params.address) updateData.address = params.address;
    if (params.phone) updateData.phone = params.phone;
    if (params.specialty) updateData.specialty = params.specialty;

    const { data, error } = await supabase
      .from('clinics')
      .update(updateData)
      .eq('id', params.clinicId)
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error updating clinic:', error);
    return { success: false, error: 'Không thể cập nhật thông tin phòng khám' };
  }
}

// Handler cho việc xóa phòng khám
export async function handleDeleteClinic(params: z.infer<typeof deleteClinicSchema>) {
  try {
    const { error } = await supabase
      .from('clinics')
      .delete()
      .eq('id', params.clinicId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting clinic:', error);
    return { success: false, error: 'Không thể xóa phòng khám' };
  }
}

// Handler cho việc tìm kiếm doanh thu
export async function handleSearchRevenue(params: z.infer<typeof searchRevenueSchema>) {
  try {
    let query = supabase
      .from('Doanh_thu')
      .select('*');

    if (params.year) {
      query = query.eq('Năm', params.year);
    }
    if (params.month) {
      query = query.eq('Tháng', `Tháng ${params.month.toString().padStart(2, '0')}`);
    }
    if (params.location) {
      query = query.ilike('Tên đơn vị', `%${params.location}%`);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error searching revenue:', error);
    return { success: false, error: 'Không thể tìm kiếm thông tin doanh thu' };
  }
}

// Handler cho việc tìm kiếm lương nhân viên
export async function handleSearchSalary(params: z.infer<typeof searchSalarySchema>) {
  try {
    let query;
    
    if (params.isFulltime) {
      query = supabase
        .from('Fulltime')
        .select('*');
      
      if (params.employeeId) {
        query = query.eq('ma_nhan_vien', params.employeeId);
      }
      if (params.employeeName) {
        query = query.ilike('ho_va_ten', `%${params.employeeName}%`);
      }
      if (params.year) {
        query = query.eq('nam', params.year);
      }
      if (params.month) {
        query = query.eq('thang', `Tháng ${params.month.toString().padStart(2, '0')}`);
      }
      if (params.location) {
        query = query.ilike('dia_diem', `%${params.location}%`);
      }
    } else {
      query = supabase
        .from('Parttime')
        .select('*');
      
      if (params.employeeId) {
        query = query.eq('Ma nhan vien', params.employeeId);
      }
      if (params.employeeName) {
        query = query.ilike('Ho va ten', `%${params.employeeName}%`);
      }
      if (params.year) {
        query = query.eq('Nam', params.year);
      }
      if (params.month) {
        query = query.eq('Thoi gian', `Tháng ${params.month.toString().padStart(2, '0')}`);
      }
      if (params.location) {
        query = query.ilike('Don vi', `%${params.location}%`);
      }
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error searching salary:', error);
    return { success: false, error: 'Không thể tìm kiếm thông tin lương' };
  }
}

// Handler cho việc so sánh doanh thu và lương
export async function handleCompareRevenueSalary(params: z.infer<typeof compareRevenueSalarySchema>) {
  try {
    // Lấy doanh thu
    let revenueQuery = supabase
      .from('Doanh_thu')
      .select('*');

    if (params.year) {
      revenueQuery = revenueQuery.eq('Năm', params.year);
    }
    if (params.month) {
      revenueQuery = revenueQuery.eq('Tháng', `Tháng ${params.month.toString().padStart(2, '0')}`);
    }
    if (params.location) {
      revenueQuery = revenueQuery.ilike('Tên đơn vị', `%${params.location}%`);
    }

    const { data: revenueData, error: revenueError } = await revenueQuery;
    if (revenueError) throw revenueError;

    // Lấy lương toàn thời gian
    let fulltimeQuery = supabase
      .from('Fulltime')
      .select('*');

    if (params.year) {
      fulltimeQuery = fulltimeQuery.eq('nam', params.year);
    }
    if (params.month) {
      fulltimeQuery = fulltimeQuery.eq('thang', `Tháng ${params.month.toString().padStart(2, '0')}`);
    }
    if (params.location) {
      fulltimeQuery = fulltimeQuery.ilike('dia_diem', `%${params.location}%`);
    }

    const { data: fulltimeData, error: fulltimeError } = await fulltimeQuery;
    if (fulltimeError) throw fulltimeError;

    // Lấy lương bán thời gian
    let parttimeQuery = supabase
      .from('Parttime')
      .select('*');

    if (params.year) {
      parttimeQuery = parttimeQuery.eq('Nam', params.year);
    }
    if (params.month) {
      parttimeQuery = parttimeQuery.eq('Thoi gian', `Tháng ${params.month.toString().padStart(2, '0')}`);
    }
    if (params.location) {
      parttimeQuery = parttimeQuery.ilike('Don vi', `%${params.location}%`);
    }

    const { data: parttimeData, error: parttimeError } = await parttimeQuery;
    if (parttimeError) throw parttimeError;

    return {
      success: true,
      data: {
        revenue: revenueData,
        fulltimeSalary: fulltimeData,
        parttimeSalary: parttimeData
      }
    };
  } catch (error) {
    console.error('Error comparing revenue and salary:', error);
    return { success: false, error: 'Không thể so sánh doanh thu và lương' };
  }
} 