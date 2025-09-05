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
  khoi_dtql: string;
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

interface RevenueDetailTableByKhoiProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

export default function RevenueDetailTableByKhoi({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
  selectedDonVi2
}: RevenueDetailTableByKhoiProps) {
  
  const [tableData, setTableData] = useState<RevenueDetailData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và khối");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [monthlyDetailData, setMonthlyDetailData] = useState<Map<string, any[]>>(new Map());
  const [sortKey, setSortKey] = useState<keyof RevenueDetailData>('doanh_thu_thuc_hien');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Tạo mô tả filter
      let monthSegment = "tất cả các tháng";
      let yearSegment = "mọi năm";
      let locationSegment = "tất cả các khối";
      
      if (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) {
        const monthNames = selectedMonths.map(m => `Tháng ${String(m).padStart(2, '0')}`);
        monthSegment = monthNames.join(', ');
      }
      
      if (selectedYear) {
        yearSegment = `năm ${selectedYear}`;
      }
      
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        locationSegment = selectedDepartmentsForDiadiem.join(', ');
      }
      
      const finalFilterDescription = selectedYear 
        ? `${monthSegment} của ${yearSegment} tại ${locationSegment}` 
        : (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) 
          ? `${monthSegment} (mọi năm) tại ${locationSegment}` 
          : `tất cả các kỳ tại ${locationSegment}`;
      setFilterDescription(finalFilterDescription);

      // Query 1: Lấy danh sách unique khối DTQL
      const { data: khoiData, error: khoiError } = await supabase
        .from('Doanh_thu')
        .select('"Khối DTQL"')
        .not('"Khối DTQL"', 'is', null)
        .not('"Khối DTQL"', 'eq', '');

      if (khoiError) {
        console.error('Error fetching khoi data:', khoiError);
        throw khoiError;
      }

      const uniqueKhoiDTQL = new Set<string>();
      (khoiData || []).forEach((item: any) => {
        if (item['Khối DTQL']) {
          uniqueKhoiDTQL.add(item['Khối DTQL']);
        }
      });

      console.log('Unique khoi DTQL:', Array.from(uniqueKhoiDTQL));

      // Query 2: Lấy dữ liệu chỉ tiêu của tất cả 12 tháng (không filter thời gian)
      let chiTieuQuery = supabase
         .from('Doanh_thu')
        .select('"Khối DTQL", "Chỉ tiêu", "Năm", "Tháng"')
         .not('"Khối DTQL"', 'is', null)
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
        .select('"Khối DTQL", "Chỉ tiêu", "Kỳ báo cáo", "Năm", "Tháng"')
        .not('"Khối DTQL"', 'is', null);

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
      
      // Thực hiện query doanh thu thực hiện (không cần pagination vì đã filter)
      const { data: doanhThuData, error: doanhThuError } = await doanhThuQuery;

      if (doanhThuError) {
        console.error('Error fetching doanh thu data:', doanhThuError);
        throw doanhThuError;
      }

      // Thực hiện query chỉ tiêu với pagination
      let chiTieuData: any[] = [];
      let from = 0;
      const batchSize = 1000;
      
      while (true) {
        const { data: batchData, error: batchError } = await chiTieuQuery.range(from, from + batchSize - 1);
        
        if (batchError) {
          console.error('Error fetching chi tieu batch:', batchError);
          throw batchError;
        }
        
        if (!batchData || batchData.length === 0) {
          break;
        }
        
        chiTieuData = chiTieuData.concat(batchData);
        from += batchSize;
        
        if (batchData.length < batchSize) {
          break;
        }
      }

      console.log('Chi tieu data count:', chiTieuData?.length);
      console.log('Doanh thu data count:', doanhThuData?.length);
      console.log('Sample chi tieu data:', chiTieuData?.slice(0, 3));
      console.log('Sample doanh thu data:', doanhThuData?.slice(0, 3));

      // Xử lý dữ liệu: Gộp theo Khối DTQL
      const khoiMap = new Map<string, { 
        chi_tieu: number; 
        chi_tieu_cac_thang_co_doanh_thu: number; 
        thuc_hien: number;
        so_thang_co_doanh_thu: number;
      }>();

      // Khởi tạo map với tất cả khối DTQL
      uniqueKhoiDTQL.forEach(khoi => {
        khoiMap.set(khoi, { 
          chi_tieu: 0, 
          chi_tieu_cac_thang_co_doanh_thu: 0, 
          thuc_hien: 0,
          so_thang_co_doanh_thu: 0
        });
      });

      // Tổng hợp dữ liệu chỉ tiêu (tất cả 12 tháng)
      (chiTieuData || []).forEach((item: any) => {
        const khoiDTQL = item['Khối DTQL'];
        const chiTieu = Number(item['Chỉ tiêu']) || 0;

        // Bỏ qua các khối không cần thiết
        const excludedKhoi = ['', null, undefined];
        if (excludedKhoi.includes(khoiDTQL)) {
          return;
        }

        // Luôn xử lý dữ liệu, không cần kiểm tra uniqueKhoiDTQL
        if (khoiMap.has(khoiDTQL)) {
          const existing = khoiMap.get(khoiDTQL)!;
          existing.chi_tieu += chiTieu;
        } else {
          khoiMap.set(khoiDTQL, { chi_tieu: chiTieu, chi_tieu_cac_thang_co_doanh_thu: 0, thuc_hien: 0, so_thang_co_doanh_thu: 0 });
        }
      });

      // Tổng hợp dữ liệu doanh thu thực hiện (theo filter thời gian)
      (doanhThuData || []).forEach((item: any) => {
        const khoiDTQL = item['Khối DTQL'];
        const thucHien = Number(item['Kỳ báo cáo']) || 0;

        // Bỏ qua các khối không cần thiết
        const excludedKhoi = ['', null, undefined];
        if (excludedKhoi.includes(khoiDTQL)) {
          return;
        }

        // Luôn xử lý dữ liệu, không cần kiểm tra uniqueKhoiDTQL
        if (khoiMap.has(khoiDTQL)) {
          const existing = khoiMap.get(khoiDTQL)!;
          existing.thuc_hien += thucHien;
        } else {
          khoiMap.set(khoiDTQL, { chi_tieu: 0, chi_tieu_cac_thang_co_doanh_thu: 0, thuc_hien: thucHien, so_thang_co_doanh_thu: 0 });
        }
      });

      // Tính toán chỉ tiêu các tháng có doanh thu
      // Tạo map để lưu các tháng có doanh thu > 0 cho mỗi khối DTQL
      const monthsWithRevenueMap = new Map<string, Set<string>>();
      
      (doanhThuData || []).forEach((item: any) => {
        const khoiDTQL = item['Khối DTQL'];
        const thucHien = Number(item['Kỳ báo cáo']) || 0;
        const thang = item['Tháng'];
        
        if (thucHien > 0) {
          // Bỏ qua các khối không cần thiết
          const excludedKhoi = ['', null, undefined];
          if (excludedKhoi.includes(khoiDTQL)) {
            return;
          }
          
          // Luôn xử lý dữ liệu, không cần kiểm tra uniqueKhoiDTQL
          if (!monthsWithRevenueMap.has(khoiDTQL)) {
            monthsWithRevenueMap.set(khoiDTQL, new Set());
          }
          monthsWithRevenueMap.get(khoiDTQL)!.add(thang);
        }
      });

      // Cập nhật số tháng có doanh thu cho mỗi khối DTQL
      monthsWithRevenueMap.forEach((months, khoiDTQL) => {
        if (khoiMap.has(khoiDTQL)) {
          khoiMap.get(khoiDTQL)!.so_thang_co_doanh_thu = months.size;
        }
      });

      // Tính chỉ tiêu cho các tháng có doanh thu
      (chiTieuData || []).forEach((item: any) => {
        const khoiDTQL = item['Khối DTQL'];
        const chiTieu = Number(item['Chỉ tiêu']) || 0;
        const thang = item['Tháng'];
        
        // Bỏ qua các khối không cần thiết
        const excludedKhoi = ['', null, undefined];
        if (excludedKhoi.includes(khoiDTQL)) {
          return;
        }
        
        // Luôn xử lý dữ liệu, không cần kiểm tra uniqueKhoiDTQL
        const monthsWithRevenue = monthsWithRevenueMap.get(khoiDTQL);
        if (monthsWithRevenue && monthsWithRevenue.has(thang)) {
          if (khoiMap.has(khoiDTQL)) {
            const existing = khoiMap.get(khoiDTQL)!;
            existing.chi_tieu_cac_thang_co_doanh_thu += chiTieu;
          }
        }
      });

      // Chuyển đổi thành array và sắp xếp
      const processedData = Array.from(khoiMap.entries())
        .map(([khoi_dtql, data]) => {
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
            khoi_dtql,
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
        .filter(item => item.chi_tieu_doanh_thu > 0 || item.doanh_thu_thuc_hien > 0)
        .sort((a, b) => b.doanh_thu_thuc_hien - a.doanh_thu_thuc_hien);

      setTableData(processedData);

      // Tạo dữ liệu chi tiết theo tháng cho mỗi khối DTQL
      const monthlyDetailMap = new Map<string, any[]>();
      
      // Lấy danh sách tất cả khối DTQL
      const allKhoiDTQL = Array.from(uniqueKhoiDTQL);
      
      // Tạo dữ liệu cho tất cả khối DTQL - hiển thị đầy đủ 12 tháng
      allKhoiDTQL.forEach(khoiDTQL => {
        const monthlyData: any[] = [];
        
        // Lấy dữ liệu chỉ tiêu của khối này từ tất cả 12 tháng
        const donViChiTieuData = (chiTieuData || []).filter((item: any) => 
          item['Khối DTQL'] === khoiDTQL &&
          item['Năm'] === (selectedYear || 2025)
        );
        
        // Lấy dữ liệu thực hiện của khối này từ năm được chọn (theo filter thời gian)
        const donViThucHienData = (doanhThuData || []).filter((item: any) => 
          item['Khối DTQL'] === khoiDTQL &&
          item['Năm'] === (selectedYear || 2025)
        );

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

        // Tạo dữ liệu cho 12 tháng
        for (let thang = 1; thang <= 12; thang++) {
          const thangStr = `Tháng ${String(thang).padStart(2, '0')}`;
          const chiTieu = chiTieuByMonth.get(thangStr) || 0;
          const thucHien = thucHienByMonth.get(thangStr) || 0;
          
          monthlyData.push({
            thang,
            chi_tieu: chiTieu,
            thuc_hien: thucHien
          });
        }

        monthlyDetailMap.set(khoiDTQL, monthlyData);
      });

      setMonthlyDetailData(monthlyDetailMap);

    } catch (err) {
      console.error('Error fetching revenue detail data:', err);
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleRowExpansion = (khoiDTQL: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(khoiDTQL)) {
      newExpandedRows.delete(khoiDTQL);
    } else {
      newExpandedRows.add(khoiDTQL);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleSort = (key: keyof RevenueDetailData) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Đặt chiều sort mặc định cho từng cột (số: desc, text: asc)
      if (key === 'khoi_dtql') {
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
            Chi tiết doanh thu theo khối
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {filterDescription}
          </p>
        </CardHeader>
        <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2 text-sm">Đang tải dữ liệu...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 flex-grow flex flex-col h-[500px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Chi tiết doanh thu theo khối
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {filterDescription}
          </p>
        </CardHeader>
        <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
          <div className="flex items-center justify-center h-full">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <span className="ml-2 text-sm text-red-500">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Chi tiết doanh thu theo khối
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {filterDescription}
        </p>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-grow">
          <Table className="min-w-[1400px]">
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[60px]">
                  
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-left min-w-[200px]', sortKey === 'khoi_dtql' && 'font-bold')} 
                  onClick={() => handleSort('khoi_dtql')}
                >
                  Khối DTQL {renderSortIcon('khoi_dtql')}
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
                  Doanh thu thực hiện {renderSortIcon('doanh_thu_thuc_hien')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[120px]', sortKey === 'phan_tram_hoan_thanh_chi_tieu_luy_ke' && 'font-bold')}
                  onClick={() => handleSort('phan_tram_hoan_thanh_chi_tieu_luy_ke')}
                >
                  % Hoàn thành chỉ tiêu lũy kế {renderSortIcon('phan_tram_hoan_thanh_chi_tieu_luy_ke')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[120px]', sortKey === 'phan_tram_hoan_thanh_chi_tieu_ca_nam' && 'font-bold')}
                  onClick={() => handleSort('phan_tram_hoan_thanh_chi_tieu_ca_nam')}
                >
                  % Hoàn thành chỉ tiêu cả năm {renderSortIcon('phan_tram_hoan_thanh_chi_tieu_ca_nam')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'doanh_thu_thuc_hien_trung_binh_thang' && 'font-bold')}
                  onClick={() => handleSort('doanh_thu_thuc_hien_trung_binh_thang')}
                >
                  Doanh thu thực hiện TB/tháng {renderSortIcon('doanh_thu_thuc_hien_trung_binh_thang')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'chi_tieu_doanh_thu_con_lai' && 'font-bold')}
                  onClick={() => handleSort('chi_tieu_doanh_thu_con_lai')}
                >
                  Chỉ tiêu doanh thu còn lại {renderSortIcon('chi_tieu_doanh_thu_con_lai')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[150px]', sortKey === 'doanh_thu_con_lai_trung_binh_thang' && 'font-bold')}
                  onClick={() => handleSort('doanh_thu_con_lai_trung_binh_thang')}
                >
                  Doanh thu còn lại TB/tháng {renderSortIcon('doanh_thu_con_lai_trung_binh_thang')}
                </TableHead>
                <TableHead 
                  className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right min-w-[120px]', sortKey === 'ty_le_co_gang' && 'font-bold')}
                  onClick={() => handleSort('ty_le_co_gang')}
                >
                  Tỷ lệ cố gắng {renderSortIcon('ty_le_co_gang')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getSortedData().map((item, index) => (
                <Fragment key={index}>
                  <TableRow className={index < 3 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                    <TableCell className="py-1.5 px-2 text-xs text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => toggleRowExpansion(item.khoi_dtql)}
                      >
                        {expandedRows.has(item.khoi_dtql) ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="py-1.5 px-2 text-xs font-medium">
                      {item.khoi_dtql}
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
                  {expandedRows.has(item.khoi_dtql) && (
                    <TableRow>
                      <TableCell colSpan={11} className="p-0">
                        <div className="bg-muted/30 p-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-background rounded-lg p-3">
                              <h4 className="text-sm font-semibold mb-2">Biểu đồ doanh thu theo tháng</h4>
                              <div className="h-[300px] overflow-hidden">
                                <RevenueDetailLineChart
                                  data={monthlyDetailData.get(item.khoi_dtql) || []}
                                  businessUnit={item.khoi_dtql}
                                />
                              </div>
                            </div>
                            <div className="bg-background rounded-lg p-3">
                              <h4 className="text-sm font-semibold mb-2">Chi tiết theo tháng - {item.khoi_dtql}</h4>
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
                                    {monthlyDetailData.get(item.khoi_dtql)?.map((monthData: any, monthIndex: number) => (
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
                                    {monthlyDetailData.get(item.khoi_dtql) && monthlyDetailData.get(item.khoi_dtql)!.length > 0 && (
                                      <TableRow className="border-t-2 border-primary/20 bg-primary/5">
                                        <TableCell className="text-xs py-1 px-2 text-center font-bold">
                                          TỔNG CỘNG
                                        </TableCell>
                                        <TableCell className="text-xs py-1 px-2 text-right font-bold">
                                          {formatCurrency(
                                            monthlyDetailData.get(item.khoi_dtql)!.reduce((sum: number, monthData: any) => sum + monthData.chi_tieu, 0)
                                          )}
                                        </TableCell>
                                        <TableCell className="text-xs py-1 px-2 text-right font-bold">
                                          {formatCurrency(
                                            monthlyDetailData.get(item.khoi_dtql)!.reduce((sum: number, monthData: any) => sum + monthData.thuc_hien, 0)
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
      </CardContent>
    </Card>
  );
}