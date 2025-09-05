"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, BarChart3, TrendingUp, Target } from 'lucide-react';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from '@/components/ui/button';

const DynamicBarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[250px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>,
});

interface TargetRevenueData {
  ten_don_vi: string;
  chi_tieu: number;
  thuc_hien: number;
  ty_le_thuc_hien: number;
}

interface TargetRevenueChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[]; 
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

// Hàm rút gọn số tiền: 5.677.571 -> 5tr6, 30000 triệu -> 30 tỷ
const compactCurrency = (value: number | null | undefined) => {
  if (!value || value < 1000) return value ? value.toString() : '';
  if (value >= 1_000_000_000) return `${Math.round(value / 1_000_000_000)} tỷ`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${Math.round(value / 100_000) / 10}tr`;
  return value.toString();
};

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const chiTieu = payload.find((p: any) => p.dataKey === 'chi_tieu')?.value;
    const thucHien = payload.find((p: any) => p.dataKey === 'thuc_hien')?.value;
    const tyLe = payload.find((p: any) => p.dataKey === 'ty_le_thuc_hien')?.payload?.ty_le_thuc_hien;
    
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-semibold mb-2">{`Đơn vị: ${label}`}</p>
        <div className="space-y-1">
          <p className="text-chart-1">
            <span className="font-medium">Chỉ tiêu:</span> {chiTieu ? (chiTieu >= 1000000 ? `${(chiTieu / 1000000).toFixed(1)}M` : chiTieu >= 1000 ? `${(chiTieu / 1000).toFixed(0)}K` : chiTieu.toLocaleString()) : 'N/A'}
          </p>
          <p className="text-chart-2">
            <span className="font-medium">Thực hiện:</span> {thucHien ? (thucHien >= 1000000 ? `${(thucHien / 1000000).toFixed(1)}M` : thucHien >= 1000 ? `${(thucHien / 1000).toFixed(0)}K` : thucHien.toLocaleString()) : 'N/A'}
          </p>
          {tyLe !== undefined && (
            <p className="text-foreground">
              <span className="font-medium">Tỷ lệ:</span> {(tyLe * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const CustomSegmentLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value === 0 || value === null || value === undefined) return null;

  const formattedValue = compactCurrency(value);
  
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">
      {formattedValue}
    </text>
  );
};

const CustomTotalLabel = (props: any) => {
  const { x, y, width, height, index, chartData } = props;

  const currentDataPoint = chartData[index];
  if (!currentDataPoint || currentDataPoint.ty_le_thuc_hien === null || currentDataPoint.ty_le_thuc_hien === undefined) return null;

  const tyLeValue = currentDataPoint.ty_le_thuc_hien;
  if (tyLeValue === 0 && currentDataPoint.chi_tieu === 0 && currentDataPoint.thuc_hien === 0) return null;

  return (
    <text x={x + width + 5} y={y + height / 2} fill="hsl(var(--foreground))" textAnchor="start" dominantBaseline="middle" fontSize={10} fontWeight="500">
      {`${(tyLeValue * 100).toFixed(0)}%`}
    </text>
  );
};

export default function TargetRevenueChart({ selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2 }: TargetRevenueChartProps) {
  const [chartData, setChartData] = useState<TargetRevenueData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");
  const [sortType, setSortType] = useState<'ty_le' | 'thuc_hien' | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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
      // Query 1: Lấy dữ liệu chỉ tiêu của tất cả 12 tháng (không filter thời gian)
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

      // Query 2: Lấy dữ liệu doanh thu thực hiện (có filter thời gian)
      let doanhThuQuery = supabase
        .from('Doanh_thu')
        .select('"Tên Đơn vị", "Kỳ báo cáo", "Năm", "Tháng"')
        .not('"Tên Đơn vị"', 'is', null)
        .not('"Kỳ báo cáo"', 'is', null);

      // Áp dụng filter thời gian cho doanh thu thực hiện
      if (selectedYear) {
        doanhThuQuery = doanhThuQuery.eq('"Năm"', selectedYear);
      }
      if (selectedMonths && selectedMonths.length > 0) {
        const monthFormatsThucHien = selectedMonths.map(m => `Tháng ${String(m).padStart(2, '0')}`);
        doanhThuQuery = doanhThuQuery.in('"Tháng"', monthFormatsThucHien);
      }

      // Áp dụng filter địa điểm cho cả hai query
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        chiTieuQuery = chiTieuQuery.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
        doanhThuQuery = doanhThuQuery.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
      }

      // Thực hiện cả hai query
      const [chiTieuResult, doanhThuResult] = await Promise.all([
        chiTieuQuery,
        doanhThuQuery
      ]);

      if (chiTieuResult.error) {
        console.error("Supabase query error for chi tieu:", chiTieuResult.error);
        throw chiTieuResult.error;
      }

      if (doanhThuResult.error) {
        console.error("Supabase query error for doanh thu:", doanhThuResult.error);
        throw doanhThuResult.error;
      }

      const chiTieuData = chiTieuResult.data;
      const doanhThuData = doanhThuResult.data;

      console.log("Chi tieu data from Supabase:", chiTieuData);
      console.log("Doanh thu data from Supabase:", doanhThuData);

      // Xử lý dữ liệu để sum theo địa điểm và tính toán tỷ lệ thực hiện
      const locationMap = new Map<string, { chi_tieu: number; thuc_hien: number }>();
      
      // Danh sách địa điểm cần loại bỏ
      const excludedLocations = ['Medon', 'Meddom', 'Medcom', 'Med Mê Linh', 'Med Group'];
      
      // Xử lý dữ liệu chỉ tiêu (tất cả 12 tháng)
      (chiTieuData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
        
        // Bỏ qua các địa điểm bị loại trừ
        if (excludedLocations.includes(tenDonVi)) {
          return;
        }
        
        const chiTieu = Number(item['Chỉ tiêu']) || 0;
        
        // Chỉ cập nhật chỉ tiêu
        if (locationMap.has(tenDonVi)) {
          const existing = locationMap.get(tenDonVi)!;
          existing.chi_tieu += chiTieu;
        } else {
          locationMap.set(tenDonVi, { chi_tieu: chiTieu, thuc_hien: 0 });
        }
      });

      // Xử lý dữ liệu doanh thu thực hiện (theo filter thời gian)
      (doanhThuData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
        
        // Bỏ qua các địa điểm bị loại trừ
        if (excludedLocations.includes(tenDonVi)) {
          return;
        }
        
        const thucHien = Number(item['Kỳ báo cáo']) || 0;
        
        // Chỉ cập nhật thực hiện
        if (locationMap.has(tenDonVi)) {
          const existing = locationMap.get(tenDonVi)!;
          existing.thuc_hien += thucHien;
        } else {
          locationMap.set(tenDonVi, { chi_tieu: 0, thuc_hien: thucHien });
        }
      });

      // Chuyển đổi Map thành array và tính tỷ lệ
      const processedData = Array.from(locationMap.entries()).map(([tenDonVi, data]) => {
        const tyLeThucHien = data.chi_tieu > 0 ? data.thuc_hien / data.chi_tieu : 0;
        
        return {
          ten_don_vi: tenDonVi,
          chi_tieu: data.chi_tieu,
          thuc_hien: data.thuc_hien,
          ty_le_thuc_hien: tyLeThucHien,
        };
      });

      console.log("Processed data (summed by location):", processedData);

      // Lọc và sắp xếp dữ liệu
      const filteredData = processedData
        .filter(item => item.chi_tieu > 0 || item.thuc_hien > 0)
        .sort((a, b) => b.ty_le_thuc_hien - a.ty_le_thuc_hien);

      console.log("Filtered data:", filteredData);
      setChartData(filteredData);

    } catch (err: any) {
      let errorMessage = 'Không thể tải dữ liệu chỉ tiêu/doanh thu theo địa điểm.';
      if (err && typeof err === 'object') {
          if (err.message) {
              errorMessage = err.message;
          } else if (err.details) {
              errorMessage = `Lỗi chi tiết: ${err.details}`;
          } else if (err.code) {
              errorMessage = `Lỗi query với mã: ${err.code}`;
          } else {
              try {
                  const stringifiedError = JSON.stringify(err);
                  if (stringifiedError !== '{}') {
                      errorMessage = `Lỗi không xác định: ${stringifiedError}`;
                  }
              } catch (e) {
                  // Ignore stringification error, keep default message
              }
          }
      } else if (typeof err === 'string') {
          errorMessage = err;
      }
      setError(errorMessage);
      console.error("Error fetching target revenue data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2]); 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sắp xếp dữ liệu theo lựa chọn
  const sortedChartData = useMemo(() => {
    if (sortType === 'ty_le') {
      return [...chartData].sort((a, b) => b.ty_le_thuc_hien - a.ty_le_thuc_hien);
    } else if (sortType === 'thuc_hien') {
      return [...chartData].sort((a, b) => b.thuc_hien - a.thuc_hien);
    }
    return chartData; // Mặc định giữ nguyên thứ tự từ API
  }, [chartData, sortType]);

  const xAxisDomainMax = useMemo(() => {
    if (!sortedChartData || sortedChartData.length === 0) {
      return 1000000;
    }
    const maxValue = Math.max(...sortedChartData.map(item => Math.max(item.chi_tieu, item.thuc_hien)));
    return Math.ceil(maxValue * 1.2 / 1000000) * 1000000;
  }, [sortedChartData]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Tình hình thực hiện chỉ tiêu/doanh thu cả năm</CardTitle>
          <CardDescription className="text-xs">Đang tải dữ liệu...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[320px] pt-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Chart Chỉ Tiêu/Doanh Thu Cả Năm
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
           <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (sortedChartData.length === 0) {
    return (
     <Card className="h-full">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Tình hình thực hiện chỉ tiêu/doanh thu cả năm</CardTitle>
          <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}.</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[320px]">
         <p className="text-sm text-muted-foreground">Không có dữ liệu cho kỳ/địa điểm đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Tình hình thực hiện chỉ tiêu/doanh thu cả năm</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Dữ liệu cả năm cho {filterDescription}. Dữ liệu đã được tổng hợp theo địa điểm.
        </CardDescription>
                 <div className="flex gap-2 mt-2">
           <Button size="sm" variant={sortType === 'ty_le' ? 'default' : 'outline'} onClick={() => setSortType('ty_le')}>
             Sắp xếp theo mức độ hoàn thành chỉ tiêu
           </Button>
           <Button size="sm" variant={sortType === 'thuc_hien' ? 'default' : 'outline'} onClick={() => setSortType('thuc_hien')}>
             Sắp xếp theo doanh thu thực hiện
           </Button>
           <Button size="sm" variant={sortType === null ? 'default' : 'outline'} onClick={() => setSortType(null)}>
             Mặc định
           </Button>
         </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="w-full overflow-x-auto">
          <ResponsiveContainer width="100%" height={360}>
            <div style={{ width: Math.max(900, sortedChartData.length * 80) }}>
              <DynamicBarChart width={Math.max(900, sortedChartData.length * 80)} height={360} data={sortedChartData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ten_don_vi" type="category" fontSize={12} interval={0} angle={-30} textAnchor="end" height={80} />
                <YAxis type="number" domain={[0, xAxisDomainMax]} tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toLocaleString()} axisLine={false} tickLine={false} tickMargin={8} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" align="center" height={30} wrapperStyle={{paddingBottom: "5px"}} />
                <Bar dataKey="chi_tieu" fill="hsl(var(--chart-1))" name="Chỉ tiêu" radius={[4, 4, 0, 0]} barSize={20} >
                    <LabelList dataKey="chi_tieu" position="top" content={<CustomSegmentLabel />} />
                </Bar>
                <Bar dataKey="thuc_hien" fill="hsl(var(--chart-2))" name="Thực hiện" radius={[4, 4, 0, 0]} barSize={20} >
                    <LabelList dataKey="thuc_hien" position="top" content={<CustomSegmentLabel />} />
                    <LabelList dataKey="ty_le_thuc_hien" content={<CustomTotalLabel chartData={sortedChartData}/>} />
                </Bar>
              </DynamicBarChart>
            </div>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
