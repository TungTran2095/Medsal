"use client";

import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, BarChart3, ChevronDown, ChevronUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import RevenueDetailLineChart from '@/components/charts/RevenueDetailLineChart';

interface RevenueDetailData {
  business_unit: string;
  chi_tieu_doanh_thu: number;
  chi_tieu_doanh_thu_cac_thang_co_doanh_thu: number;
  doanh_thu_thuc_hien: number;
  phan_tram_hoan_thanh_chi_tieu_luy_ke: number;
  phan_tram_hoan_thanh_chi_tieu_ca_nam: number;
  doanh_thu_thuc_hien_trung_binh_thang: number;
  chi_tieu_doanh_thu_con_lai: number;
  doanh_thu_con_lai_trung_binh_thang: number;
  ty_le_co_gang: number;
  so_thang_co_doanh_thu: number;
}

interface RevenueDetailTableProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

export default function RevenueDetailTable({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
  selectedDonVi2
}: RevenueDetailTableProps) {
  const [tableData, setTableData] = useState<RevenueDetailData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [monthlyDetailData, setMonthlyDetailData] = useState<Map<string, any[]>>(new Map());
  const [sortKey, setSortKey] = useState<keyof RevenueDetailData>('doanh_thu_thuc_hien');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Tạo mô tả filter
    let finalFilterDescription: string;
    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) monthSegment = "tất cả các tháng";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
    } else { monthSegment = "tất cả các tháng"; }
    
    let locationSegment = "tất cả";
    let appliedFilters: string[] = [];
    if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
      appliedFilters.push(selectedDepartmentsForDiadiem.length <= 2 ? selectedDepartmentsForDiadiem.join(' & ') : `${selectedDepartmentsForDiadiem.length} địa điểm (Loại/Pban)`);
    }
    if (selectedNganhDoc && selectedNganhDoc.length > 0) { 
      appliedFilters.push(selectedNganhDoc.length <=2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (selectedDonVi2 && selectedDonVi2.length > 0) { 
      appliedFilters.push(selectedDonVi2.length <=2 ? selectedDonVi2.join(' & ') : `${selectedDonVi2.length} đơn vị 2`);
    }

    if (appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    
    finalFilterDescription = selectedYear 
      ? `${monthSegment} của ${yearSegment} tại ${locationSegment}` 
      : (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) 
        ? `${monthSegment} (mọi năm) tại ${locationSegment}` 
        : `tất cả các kỳ tại ${locationSegment}`;
    setFilterDescription(finalFilterDescription);

         try {
      // Query 1: Kiểm tra cấu trúc bảng MS_Org_Diadiem trước
      console.log('Đang kiểm tra cấu trúc bảng MS_Org_Diadiem...');
      
      // Thử query đơn giản trước để xem cấu trúc bảng
      const { data: sampleData, error: sampleError } = await supabase
        .from('MS_Org_Diadiem')
        .select('*')
        .limit(5);

      if (sampleError) {
        console.error("Supabase query error for sample data:", sampleError);
        throw sampleError;
      }

      console.log('Sample data from MS_Org_Diadiem:', sampleData);
      console.log('Available columns:', sampleData?.[0] ? Object.keys(sampleData[0]) : 'No data');

      // Lấy mapping giữa Department và Bussiness Unit từ MS_Org_Diadiem
      const { data: orgMapping, error: orgMappingError } = await supabase
        .from('MS_Org_Diadiem')
        .select('Department, "Bussiness Unit"')
        .not('"Bussiness Unit"', 'is', null)
        .not('"Bussiness Unit"', 'eq', '')
        .not('Department', 'is', null)
        .not('Department', 'eq', '')
        .eq('Division', 'Company');

      if (orgMappingError) {
        console.error("Supabase query error for org mapping:", orgMappingError);
        throw orgMappingError;
      }

      console.log('Org mapping data:', orgMapping);

      // Tạo map từ Department -> Business Unit
      const departmentToBusinessUnitMap = new Map<string, string>();
      const uniqueBusinessUnits = new Set<string>();
      
      (orgMapping || []).forEach((item: any) => {
        const department = item['Department'];
        const businessUnit = item['Bussiness Unit'];
        if (department && businessUnit) {
          departmentToBusinessUnitMap.set(department, businessUnit);
          uniqueBusinessUnits.add(businessUnit);
        }
      });

      console.log('Department to BusinessUnit map:', Array.from(departmentToBusinessUnitMap.entries()));
      console.log('Unique business units:', Array.from(uniqueBusinessUnits));

      // Query 2: Lấy dữ liệu chỉ tiêu của tất cả 12 tháng (không filter thời gian)
      let chiTieuQuery = supabase
         .from('Doanh_thu')
        .select('"Tên Đơn vị", "Chỉ tiêu", "Năm", "Tháng"')
         .not('"Tên Đơn vị"', 'is', null)
         .not('"Chỉ tiêu"', 'is', null);

      // Chỉ áp dụng filter năm cho chỉ tiêu
       if (selectedYear) {
        chiTieuQuery = chiTieuQuery.eq('"Năm"', selectedYear);
       }

      // Lấy chỉ tiêu của tất cả 12 tháng
      const monthFormats = Array.from({length: 12}, (_, i) => `Tháng ${String(i + 1).padStart(2, '0')}`);
      chiTieuQuery = chiTieuQuery.in('"Tháng"', monthFormats);

      // Query 3: Lấy dữ liệu doanh thu thực hiện (có filter thời gian)
      let doanhThuQuery = supabase
         .from('Doanh_thu')
        .select('"Tên Đơn vị", "Chỉ tiêu", "Kỳ báo cáo", "Năm", "Tháng"')
        .not('"Tên Đơn vị"', 'is', null);

      // Áp dụng filter thời gian cho doanh thu thực hiện
       if (selectedYear) {
        doanhThuQuery = doanhThuQuery.eq('"Năm"', selectedYear);
       }
       if (selectedMonths && selectedMonths.length > 0) {
        const monthFormatsThucHien = selectedMonths.map(m => `Tháng ${String(m).padStart(2, '0')}`);
        doanhThuQuery = doanhThuQuery.in('"Tháng"', monthFormatsThucHien);
       }

      // Áp dụng filter địa điểm cho doanh thu thực hiện
       if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        doanhThuQuery = doanhThuQuery.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
      }
      
      // KHÔNG áp dụng filter địa điểm cho chỉ tiêu để lấy đầy đủ dữ liệu
      // Filter địa điểm sẽ được áp dụng khi xử lý dữ liệu

      // Thực hiện query doanh thu thực hiện (không cần pagination vì đã filter)
      const { data: doanhThuData, error: doanhThuError } = await doanhThuQuery;

      if (doanhThuError) {
        console.error("Supabase query error for doanh thu:", doanhThuError);
        throw doanhThuError;
      }

      // Lấy dữ liệu chỉ tiêu bằng pagination để lấy đầy đủ
      const allChiTieuData = [];
      let from = 0;
      const batchSize = 1000;
      let hasMoreData = true;

      console.log('RevenueDetailTable - Starting pagination for chi tieu data...');
      
      while (hasMoreData) {
        const { data: batchData, error: queryError } = await chiTieuQuery.range(from, from + batchSize - 1);
        
        if (queryError) {
          console.error("Supabase query error for chi tieu:", queryError);
          throw queryError;
        }
        
        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }
        
        allChiTieuData.push(...batchData);
        console.log(`RevenueDetailTable - Fetched chi tieu batch ${Math.floor(from/batchSize) + 1}: ${batchData.length} records (total: ${allChiTieuData.length})`);
        
        from += batchSize;
        
        if (batchData.length < batchSize) {
          hasMoreData = false;
        }
      }
      
      const chiTieuData = allChiTieuData;
      console.log(`RevenueDetailTable - Total chi tieu data fetched: ${chiTieuData.length} records`);

      console.log('Chi tieu data count:', chiTieuData?.length);
      console.log('Doanh thu data count:', doanhThuData?.length);
      console.log('Sample chi tieu data:', chiTieuData?.slice(0, 3));
      console.log('Sample doanh thu data:', doanhThuData?.slice(0, 3));

      // Xử lý dữ liệu: Gộp theo Business Unit
      const businessUnitMap = new Map<string, { 
        chi_tieu: number; 
        chi_tieu_cac_thang_co_doanh_thu: number; 
        thuc_hien: number;
        so_thang_co_doanh_thu: number;
      }>();

      // Thêm các địa điểm gộp vào map
      businessUnitMap.set('Med Huda', {
        chi_tieu: 0,
        chi_tieu_cac_thang_co_doanh_thu: 0,
        thuc_hien: 0,
        so_thang_co_doanh_thu: 0
      });
      businessUnitMap.set('Med Đông Nam Bộ', {
        chi_tieu: 0,
        chi_tieu_cac_thang_co_doanh_thu: 0,
        thuc_hien: 0,
        so_thang_co_doanh_thu: 0
      });

      // Khởi tạo map với tất cả business units
      uniqueBusinessUnits.forEach(unit => {
        businessUnitMap.set(unit, { 
          chi_tieu: 0, 
          chi_tieu_cac_thang_co_doanh_thu: 0, 
          thuc_hien: 0,
          so_thang_co_doanh_thu: 0
        });
      });

                        // Tổng hợp dữ liệu chỉ tiêu (tất cả 12 tháng)
      (chiTieuData || []).forEach((item: any) => {
         const tenDonVi = item['Tên Đơn vị'];
           const chiTieu = Number(item['Chỉ tiêu']) || 0;

        // Lấy business unit tương ứng với tên đơn vị (Department)
        let businessUnit = departmentToBusinessUnitMap.get(tenDonVi) || tenDonVi;

        // Gộp các địa điểm theo yêu cầu
        if (businessUnit === 'Med Huế' || businessUnit === 'Med Đà Nẵng') {
          businessUnit = 'Med Huda';
        } else if (businessUnit === 'Med TP.HCM' || businessUnit === 'Med Đồng Nai' || 
                   businessUnit === 'Med Bình Dương' || businessUnit === 'Med Bình Phước') {
          businessUnit = 'Med Đông Nam Bộ';
        }

        // Bỏ qua các địa điểm không cần thiết
        const excludedUnits = ['Med Group', 'Medlatec', 'Medon', 'Medcom', 'Medim'];
        if (excludedUnits.includes(businessUnit)) {
          return;
        }

        // Luôn xử lý dữ liệu, không cần kiểm tra uniqueBusinessUnits
        if (businessUnitMap.has(businessUnit)) {
          const existing = businessUnitMap.get(businessUnit)!;
          existing.chi_tieu += chiTieu;
        } else {
          businessUnitMap.set(businessUnit, { chi_tieu: chiTieu, chi_tieu_cac_thang_co_doanh_thu: 0, thuc_hien: 0, so_thang_co_doanh_thu: 0 });
        }
      });

      // Tổng hợp dữ liệu doanh thu thực hiện (theo filter thời gian)
      (doanhThuData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
        const thucHien = Number(item['Kỳ báo cáo']) || 0;

        // Lấy business unit tương ứng với tên đơn vị (Department)
        let businessUnit = departmentToBusinessUnitMap.get(tenDonVi) || tenDonVi;

        // Gộp các địa điểm theo yêu cầu
        if (businessUnit === 'Med Huế' || businessUnit === 'Med Đà Nẵng') {
          businessUnit = 'Med Huda';
        } else if (businessUnit === 'Med TP.HCM' || businessUnit === 'Med Đồng Nai' || 
                   businessUnit === 'Med Bình Dương' || businessUnit === 'Med Bình Phước') {
          businessUnit = 'Med Đông Nam Bộ';
        }

        // Bỏ qua các địa điểm không cần thiết
        const excludedUnits = ['Med Group', 'Medlatec', 'Medon', 'Medcom', 'Medim'];
        if (excludedUnits.includes(businessUnit)) {
           return;
         }
         
        // Luôn xử lý dữ liệu, không cần kiểm tra uniqueBusinessUnits
        if (businessUnitMap.has(businessUnit)) {
          const existing = businessUnitMap.get(businessUnit)!;
          existing.thuc_hien += thucHien;
        } else {
          businessUnitMap.set(businessUnit, { chi_tieu: 0, chi_tieu_cac_thang_co_doanh_thu: 0, thuc_hien: thucHien, so_thang_co_doanh_thu: 0 });
        }
      });

      // Tính toán chỉ tiêu các tháng có doanh thu
      // Tạo map để lưu các tháng có doanh thu > 0 cho mỗi business unit
      const monthsWithRevenueMap = new Map<string, Set<string>>();
      
            (doanhThuData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
         const thucHien = Number(item['Kỳ báo cáo']) || 0;
         const thang = item['Tháng'];
         
         if (thucHien > 0) {
          let businessUnit = departmentToBusinessUnitMap.get(tenDonVi) || tenDonVi;

          // Gộp các địa điểm theo yêu cầu
          if (businessUnit === 'Med Huế' || businessUnit === 'Med Đà Nẵng') {
            businessUnit = 'Med Huda';
          } else if (businessUnit === 'Med TP.HCM' || businessUnit === 'Med Đồng Nai' || 
                     businessUnit === 'Med Bình Dương' || businessUnit === 'Med Bình Phước') {
            businessUnit = 'Med Đông Nam Bộ';
          }

          // Bỏ qua các địa điểm không cần thiết
          const excludedUnits = ['Med Group', 'Medlatec', 'Medon', 'Medcom', 'Medim'];
          if (excludedUnits.includes(businessUnit)) {
            return;
          }
          
          // Luôn xử lý dữ liệu, không cần kiểm tra uniqueBusinessUnits
          if (!monthsWithRevenueMap.has(businessUnit)) {
            monthsWithRevenueMap.set(businessUnit, new Set());
          }
          monthsWithRevenueMap.get(businessUnit)!.add(thang);
        }
      });

      // Cập nhật số tháng có doanh thu cho mỗi business unit
      monthsWithRevenueMap.forEach((months, businessUnit) => {
        if (businessUnitMap.has(businessUnit)) {
          businessUnitMap.get(businessUnit)!.so_thang_co_doanh_thu = months.size;
        }
      });

      // Tính chỉ tiêu cho các tháng có doanh thu
      (chiTieuData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
        const chiTieu = Number(item['Chỉ tiêu']) || 0;
        const thang = item['Tháng'];
        
        let businessUnit = departmentToBusinessUnitMap.get(tenDonVi) || tenDonVi;

        // Gộp các địa điểm theo yêu cầu
        if (businessUnit === 'Med Huế' || businessUnit === 'Med Đà Nẵng') {
          businessUnit = 'Med Huda';
        } else if (businessUnit === 'Med TP.HCM' || businessUnit === 'Med Đồng Nai' || 
                   businessUnit === 'Med Bình Dương' || businessUnit === 'Med Bình Phước') {
          businessUnit = 'Med Đông Nam Bộ';
        }

        // Bỏ qua các địa điểm không cần thiết
        const excludedUnits = ['Med Group', 'Medlatec', 'Medon', 'Medcom', 'Medim'];
        if (excludedUnits.includes(businessUnit)) {
          return;
        }
        
        // Luôn xử lý dữ liệu, không cần kiểm tra uniqueBusinessUnits
        const monthsWithRevenue = monthsWithRevenueMap.get(businessUnit);
        if (monthsWithRevenue && monthsWithRevenue.has(thang)) {
          if (businessUnitMap.has(businessUnit)) {
            const existing = businessUnitMap.get(businessUnit)!;
            existing.chi_tieu_cac_thang_co_doanh_thu += chiTieu;
          }
        }
      });

      // Chuyển đổi thành array và sắp xếp
      const processedData = Array.from(businessUnitMap.entries())
        .map(([businessUnit, data]) => {
          // Tính toán các cột mới
          const phan_tram_hoan_thanh_chi_tieu_luy_ke = data.chi_tieu_cac_thang_co_doanh_thu > 0 
            ? (data.thuc_hien / data.chi_tieu_cac_thang_co_doanh_thu) * 100 
            : 0;
          
          const phan_tram_hoan_thanh_chi_tieu_ca_nam = data.chi_tieu > 0 
            ? (data.thuc_hien / data.chi_tieu) * 100 
            : 0;
          
          const doanh_thu_thuc_hien_trung_binh_thang = data.so_thang_co_doanh_thu > 0 
            ? data.thuc_hien / data.so_thang_co_doanh_thu 
            : 0;
          
          const chi_tieu_doanh_thu_con_lai = data.chi_tieu - data.thuc_hien;
          
          const doanh_thu_con_lai_trung_binh_thang = (12 - data.so_thang_co_doanh_thu) > 0 
            ? chi_tieu_doanh_thu_con_lai / (12 - data.so_thang_co_doanh_thu) 
            : 0;
          
          const ty_le_co_gang = doanh_thu_thuc_hien_trung_binh_thang > 0 
            ? (doanh_thu_con_lai_trung_binh_thang / doanh_thu_thuc_hien_trung_binh_thang) * 100 
            : 0;
         
         return {
            business_unit: businessUnit,
            chi_tieu_doanh_thu: data.chi_tieu,
            chi_tieu_doanh_thu_cac_thang_co_doanh_thu: data.chi_tieu_cac_thang_co_doanh_thu,
            doanh_thu_thuc_hien: data.thuc_hien,
            phan_tram_hoan_thanh_chi_tieu_luy_ke,
            phan_tram_hoan_thanh_chi_tieu_ca_nam,
            doanh_thu_thuc_hien_trung_binh_thang,
            chi_tieu_doanh_thu_con_lai,
            doanh_thu_con_lai_trung_binh_thang,
            ty_le_co_gang,
            so_thang_co_doanh_thu: data.so_thang_co_doanh_thu,
          };
        })
        .filter(item => {
          // Luôn hiển thị các địa điểm gộp, ngay cả khi có dữ liệu = 0
          if (item.business_unit === 'Med Huda' || item.business_unit === 'Med Đông Nam Bộ') {
            return true;
          }
          // Các địa điểm khác chỉ hiển thị khi có dữ liệu
          return item.chi_tieu_doanh_thu > 0 || item.doanh_thu_thuc_hien > 0;
        })
        .sort((a, b) => b.doanh_thu_thuc_hien - a.doanh_thu_thuc_hien);


      setTableData(processedData);

      // Tạo dữ liệu chi tiết theo tháng cho mỗi business unit
      const monthlyDetailMap = new Map<string, any[]>();
      
      // Lấy danh sách tất cả business units (bao gồm cả các địa điểm gộp)
      const allBusinessUnits = Array.from(uniqueBusinessUnits);
      
      // Thêm các địa điểm gộp vào danh sách nếu chưa có
      if (!allBusinessUnits.includes('Med Huda')) {
        allBusinessUnits.push('Med Huda');
      }
      if (!allBusinessUnits.includes('Med Đông Nam Bộ')) {
        allBusinessUnits.push('Med Đông Nam Bộ');
      }
      
      // Tạo dữ liệu cho tất cả business units - hiển thị đầy đủ 12 tháng
      allBusinessUnits.forEach(businessUnit => {
        const monthlyData: any[] = [];
        
        // Lấy tất cả departments thuộc business unit này
        let departmentsInBusinessUnit: string[] = [];
        
        if (businessUnit === 'Med Huda') {
          // Gộp dữ liệu từ Med Huế và Med Đà Nẵng
          departmentsInBusinessUnit = ['Med Huế', 'Med Đà Nẵng'];
        } else if (businessUnit === 'Med Đông Nam Bộ') {
          // Gộp dữ liệu từ Med TP.HCM, Med Đồng Nai, Med Bình Dương, Med Bình Phước
          departmentsInBusinessUnit = ['Med TP.HCM', 'Med Đồng Nai', 'Med Bình Dương', 'Med Bình Phước'];
        } else {
          // Lấy departments từ map thông thường
          departmentsInBusinessUnit = Array.from(departmentToBusinessUnitMap.entries())
            .filter(([_, bu]) => bu === businessUnit)
            .map(([dept, _]) => dept);
        }
        
        // Lấy dữ liệu chỉ tiêu của các departments này từ tất cả 12 tháng
        const donViChiTieuData = (chiTieuData || []).filter((item: any) => 
          departmentsInBusinessUnit.includes(item['Tên Đơn vị']) &&
          item['Năm'] === (selectedYear || 2025)
        );
        
        // Lấy dữ liệu thực hiện của các departments này từ năm được chọn (theo filter thời gian)
        const donViThucHienData = (doanhThuData || []).filter((item: any) => 
          departmentsInBusinessUnit.includes(item['Tên Đơn vị']) &&
          item['Năm'] === (selectedYear || 2025)
        );

        // Nếu không có departments nào thuộc business unit này, bỏ qua
        if (departmentsInBusinessUnit.length === 0) {
          console.log(`No departments found for business unit: ${businessUnit}`);
          return;
        }


        
        // Tạo map chỉ tiêu theo tháng
        const chiTieuByMonth = new Map<string, number>();
        donViChiTieuData.forEach((item: any) => {
          const thang = item['Tháng'];
              const chiTieu = Number(item['Chỉ tiêu']) || 0;
          chiTieuByMonth.set(thang, (chiTieuByMonth.get(thang) || 0) + chiTieu);
        });
        
        // Tạo map thực hiện theo tháng
        const thucHienByMonth = new Map<string, number>();
        donViThucHienData.forEach((item: any) => {
          const thang = item['Tháng'];
              const thucHien = Number(item['Kỳ báo cáo']) || 0;
          thucHienByMonth.set(thang, (thucHienByMonth.get(thang) || 0) + thucHien);
        });
        
        // Tạo dữ liệu cho tất cả 12 tháng
        for (let month = 1; month <= 12; month++) {
          const thangStr = `Tháng ${String(month).padStart(2, '0')}`;
          const chiTieu = chiTieuByMonth.get(thangStr) || 0;
          const thucHien = thucHienByMonth.get(thangStr) || 0;
            
            monthlyData.push({
              thang: month,
              thang_str: thangStr,
            month: thangStr, // Key cho line chart
            chi_tieu: chiTieu,
            thuc_hien: thucHien
            });
          }
          
        monthlyDetailMap.set(businessUnit, monthlyData);
        });
        
        setMonthlyDetailData(monthlyDetailMap);

    } catch (err: any) {
      let errorMessage = 'Không thể tải dữ liệu chi tiết doanh thu theo địa điểm.';
      if (err && typeof err === 'object') {
          if (err.message) {
              errorMessage = err.message;
          } else if (err.details) {
              errorMessage = `Lỗi chi tiết: ${err.details}`;
          } else if (err.code) {
              errorMessage = `Lỗi query với mã: ${err.code}`;
          }
      } else if (typeof err === 'string') {
          errorMessage = err;
      }
      setError(errorMessage);
      console.error("Error fetching revenue detail data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2]); 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined || value === 0) return '-';
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(value);
  };

  const toggleRowExpansion = (businessUnit: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(businessUnit)) {
      newExpandedRows.delete(businessUnit);
    } else {
      newExpandedRows.add(businessUnit);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleSort = (key: keyof RevenueDetailData) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Đặt chiều sort mặc định cho từng cột (số: desc, text: asc)
      if (key === 'business_unit') {
        setSortDir('asc');
      } else {
        setSortDir('desc');
      }
    }
  };

  const getSortedData = () => {
    return [...tableData].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === null || aValue === undefined) {
        return sortDir === 'asc' ? -1 : 1;
      }
      if (bValue === null || bValue === undefined) {
        return sortDir === 'asc' ? 1 : -1;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDir === 'asc' ? aValue - bValue : bValue - aValue;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDir === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      return 0;
    });
  };

  const renderSortIcon = (key: keyof RevenueDetailData) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 text-primary inline-block ml-1" />;
    return <ArrowDown className="h-3 w-3 text-primary inline-block ml-1" />;
  };

  if (isLoading) {
    return (
      <Card className="mt-4 flex-grow flex flex-col h-[500px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Chi tiết doanh thu theo địa điểm
          </CardTitle>
          <p className="text-xs text-muted-foreground">Đang tải dữ liệu...</p>
        </CardHeader>
        <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 flex-grow flex flex-col h-[500px] border-destructive/50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Bảng Chi Tiết Doanh Thu
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
           <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (tableData.length === 0) {
    return (
      <Card className="mt-4 flex-grow flex flex-col h-[500px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Chi tiết doanh thu theo địa điểm
          </CardTitle>
          <p className="text-xs text-muted-foreground truncate" title={filterDescription}>
            Cho: {filterDescription}
          </p>
        </CardHeader>
        <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Không có dữ liệu cho kỳ/địa điểm đã chọn.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Chi tiết doanh thu theo địa điểm
        </CardTitle>
        <p className="text-xs text-muted-foreground truncate" title={filterDescription}>
          Cho: {filterDescription}
        </p>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <div className="overflow-x-auto">
            <Table className="min-w-[1400px]">
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[60px]">
                  
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-left min-w-[200px]', sortKey === 'business_unit' && 'font-bold')} 
                  onClick={() => handleSort('business_unit')}
                >
                  Địa điểm (Business Unit) {renderSortIcon('business_unit')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'chi_tieu_doanh_thu' && 'font-bold')}
                  onClick={() => handleSort('chi_tieu_doanh_thu')}
                >
                  Chỉ tiêu doanh thu cả năm {renderSortIcon('chi_tieu_doanh_thu')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'chi_tieu_doanh_thu_cac_thang_co_doanh_thu' && 'font-bold')}
                  onClick={() => handleSort('chi_tieu_doanh_thu_cac_thang_co_doanh_thu')}
                >
                  Chỉ tiêu doanh thu các tháng có doanh thu {renderSortIcon('chi_tieu_doanh_thu_cac_thang_co_doanh_thu')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'doanh_thu_thuc_hien' && 'font-bold')}
                  onClick={() => handleSort('doanh_thu_thuc_hien')}
                >
                  Doanh thu thực hiện
                  {renderSortIcon('doanh_thu_thuc_hien')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[120px]', sortKey === 'phan_tram_hoan_thanh_chi_tieu_luy_ke' && 'font-bold')}
                  onClick={() => handleSort('phan_tram_hoan_thanh_chi_tieu_luy_ke')}
                >
                  % Hoàn thành chỉ tiêu lũy kế
                  {renderSortIcon('phan_tram_hoan_thanh_chi_tieu_luy_ke')}
                        </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[120px]', sortKey === 'phan_tram_hoan_thanh_chi_tieu_ca_nam' && 'font-bold')}
                  onClick={() => handleSort('phan_tram_hoan_thanh_chi_tieu_ca_nam')}
                >
                  % Hoàn thành chỉ tiêu cả năm
                  {renderSortIcon('phan_tram_hoan_thanh_chi_tieu_ca_nam')}
                        </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'doanh_thu_thuc_hien_trung_binh_thang' && 'font-bold')}
                  onClick={() => handleSort('doanh_thu_thuc_hien_trung_binh_thang')}
                >
                  Doanh thu thực hiện TB/tháng
                  {renderSortIcon('doanh_thu_thuc_hien_trung_binh_thang')}
                        </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'chi_tieu_doanh_thu_con_lai' && 'font-bold')}
                  onClick={() => handleSort('chi_tieu_doanh_thu_con_lai')}
                >
                  Chỉ tiêu doanh thu còn lại
                  {renderSortIcon('chi_tieu_doanh_thu_con_lai')}
                        </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'doanh_thu_con_lai_trung_binh_thang' && 'font-bold')}
                  onClick={() => handleSort('doanh_thu_con_lai_trung_binh_thang')}
                >
                  Doanh thu còn lại TB/tháng
                  {renderSortIcon('doanh_thu_con_lai_trung_binh_thang')}
                        </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[120px]', sortKey === 'ty_le_co_gang' && 'font-bold')}
                  onClick={() => handleSort('ty_le_co_gang')}
                >
                          Tỷ lệ cố gắng
                  {renderSortIcon('ty_le_co_gang')}
                        </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getSortedData().map((item, index) => (
                <Fragment key={index}>
                  <TableRow>
                    <TableCell className="py-1.5 px-2 text-xs text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(item.business_unit)}
                        className="h-6 w-6 p-0 hover:bg-muted"
                      >
                        {expandedRows.has(item.business_unit) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-xs font-medium whitespace-nowrap min-w-[200px] text-left">
                      {item.business_unit}
                    </TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs">
                      {formatCurrency(item.chi_tieu_doanh_thu)}
                    </TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs">
                      {formatCurrency(item.chi_tieu_doanh_thu_cac_thang_co_doanh_thu)}
                    </TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
                      {formatCurrency(item.doanh_thu_thuc_hien)}
                    </TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs">
                      {item.phan_tram_hoan_thanh_chi_tieu_luy_ke.toFixed(1)}%
                     </TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs">
                      {item.phan_tram_hoan_thanh_chi_tieu_ca_nam.toFixed(1)}%
                     </TableCell>
                     <TableCell className="text-right py-1.5 px-2 text-xs">
                      {formatCurrency(item.doanh_thu_thuc_hien_trung_binh_thang)}
                     </TableCell>
                     <TableCell className="text-right py-1.5 px-2 text-xs">
                      {formatCurrency(item.chi_tieu_doanh_thu_con_lai)}
                     </TableCell>
                     <TableCell className="text-right py-1.5 px-2 text-xs">
                      {formatCurrency(item.doanh_thu_con_lai_trung_binh_thang)}
                     </TableCell>
                    <TableCell className={`text-right py-1.5 px-2 text-xs font-semibold ${
                      item.ty_le_co_gang < 100 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {item.ty_le_co_gang.toFixed(1)}%
                     </TableCell>
                   </TableRow>
                  {expandedRows.has(item.business_unit) && (
                    <TableRow>
                      <TableCell colSpan={11} className="p-0">
                                                <div className="bg-muted/30 p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-background rounded-lg p-3">
                              <h4 className="text-sm font-semibold mb-2">Biểu đồ doanh thu theo tháng</h4>
                              <div className="h-[300px] overflow-hidden">
                                <RevenueDetailLineChart
                                  data={monthlyDetailData.get(item.business_unit) || []}
                                  businessUnit={item.business_unit}
                                />
                              </div>
                            </div>
                            <div className="bg-background rounded-lg p-3">
                              <h4 className="text-sm font-semibold mb-2">Chi tiết theo tháng - {item.business_unit}</h4>
                              <div className="h-[300px] overflow-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-xs py-1 px-2 text-center">Tháng</TableHead>
                                      <TableHead className="text-xs py-1 px-2 text-right">Chỉ tiêu</TableHead>
                                      <TableHead className="text-xs py-1 px-2 text-right">Thực hiện</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {monthlyDetailData.get(item.business_unit)?.map((monthData: any, monthIndex: number) => (
                                      <TableRow key={monthIndex}>
                                        <TableCell className="text-xs py-1 px-2 text-center font-medium">
                                          T{monthData.thang.toString().padStart(2, '0')}
                                        </TableCell>
                                        <TableCell className="text-xs py-1 px-2 text-right">
                                          {formatCurrency(monthData.chi_tieu)}
                                        </TableCell>
                                        <TableCell className="text-xs py-1 px-2 text-right font-semibold">
                                          {formatCurrency(monthData.thuc_hien)}
                                        </TableCell>
                                      </TableRow>
                                    )) || (
                                      <TableRow>
                                        <TableCell colSpan={3} className="text-xs py-2 text-center text-muted-foreground">
                                          Không có dữ liệu
                                        </TableCell>
                                      </TableRow>
                                    )}
                                    {/* Dòng tổng cộng */}
                                    {monthlyDetailData.get(item.business_unit) && monthlyDetailData.get(item.business_unit)!.length > 0 && (
                                      <TableRow className="border-t-2 border-primary/20 bg-primary/5">
                                        <TableCell className="text-xs py-1 px-2 text-center font-bold">
                                          TỔNG CỘNG
                                        </TableCell>
                                        <TableCell className="text-xs py-1 px-2 text-right font-bold">
                                          {formatCurrency(
                                            monthlyDetailData.get(item.business_unit)!.reduce((sum: number, monthData: any) => sum + monthData.chi_tieu, 0)
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs py-1 px-2 text-right font-bold">
                                          {formatCurrency(
                                            monthlyDetailData.get(item.business_unit)!.reduce((sum: number, monthData: any) => sum + monthData.thuc_hien, 0)
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}