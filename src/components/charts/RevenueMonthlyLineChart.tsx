"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle, TrendingUp, LineChart as LineChartIcon } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface MonthlyRevenueData {
  thang: string;
  chi_tieu: number;
  thuc_hien: number;
  chi_tieu_luy_ke: number;
  thuc_hien_luy_ke: number;
}

interface RevenueMonthlyLineChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
  isCumulative?: boolean; // Thêm prop để phân biệt chart lũy kế
}

export default function RevenueMonthlyLineChart({ 
  selectedYear, 
  selectedMonths, 
  selectedDepartmentsForDiadiem, 
  selectedNganhDoc, 
  selectedDonVi2,
  isCumulative = false
}: RevenueMonthlyLineChartProps) {
  const [chartData, setChartData] = useState<MonthlyRevenueData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const chartConfig = {
    chi_tieu: {
      label: isCumulative ? 'Chỉ tiêu lũy kế' : 'Chỉ tiêu',
      color: 'hsl(var(--chart-1))',
      icon: TrendingUp,
    },
    thuc_hien: {
      label: isCumulative ? 'Thực hiện lũy kế' : 'Thực hiện',
      color: 'hsl(var(--chart-2))',
      icon: TrendingUp,
    },
  } satisfies ChartConfig;

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
      let query = supabase
        .from('Doanh_thu')
        .select('"Tên Đơn vị", "Chỉ tiêu", "Kỳ báo cáo", "Tháng", "Năm"')
        .not('"Tên Đơn vị"', 'is', null)
        .not('"Chỉ tiêu"', 'is', null)
        .not('"Kỳ báo cáo"', 'is', null);

      if (selectedYear) {
        query = query.eq('"Năm"', selectedYear);
      }
      if (selectedMonths && selectedMonths.length > 0) {
        const monthFormats = selectedMonths.map(m => `Tháng ${String(m).padStart(2, '0')}`);
        query = query.in('"Tháng"', monthFormats);
      }

      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        query = query.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
      }

      const { data: rawData, error: queryError } = await query;

      if (queryError) {
        console.error("Supabase query error:", queryError);
        throw queryError;
      }

      const monthMap = new Map<string, { chi_tieu: number; thuc_hien: number }>();
      
      const excludedLocations = ['Medon', 'Meddom', 'Medcom', 'Med Mê Linh', 'Med Group'];
      
      (rawData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
        
        if (excludedLocations.includes(tenDonVi)) {
          return;
        }
        
        const thang = item['Tháng'];
        const chiTieu = Number(item['Chỉ tiêu']) || 0;
        const thucHien = Number(item['Kỳ báo cáo']) || 0;
        
        if (monthMap.has(thang)) {
          const existing = monthMap.get(thang)!;
          existing.chi_tieu += chiTieu;
          existing.thuc_hien += thucHien;
        } else {
          monthMap.set(thang, { chi_tieu: chiTieu, thuc_hien: thucHien });
        }
      });

      // Chuyển đổi Map thành array và sắp xếp theo tháng
      const processedData = Array.from(monthMap.entries()).map(([thang, data]) => {
        return {
          thang: thang.replace('Tháng ', ''),
          chi_tieu: data.chi_tieu,
          thuc_hien: data.thuc_hien,
          chi_tieu_luy_ke: 0, // Sẽ tính sau
          thuc_hien_luy_ke: 0, // Sẽ tính sau
        };
      });

      // Sắp xếp theo tháng (1, 2, 3, ..., 12)
      const sortedData = processedData.sort((a, b) => {
        const monthA = parseInt(a.thang);
        const monthB = parseInt(b.thang);
        return monthA - monthB;
      });

      // Tính lũy kế
      let chiTieuLuyKe = 0;
      let thucHienLuyKe = 0;
      sortedData.forEach((item) => {
        chiTieuLuyKe += item.chi_tieu;
        thucHienLuyKe += item.thuc_hien;
        item.chi_tieu_luy_ke = chiTieuLuyKe;
        item.thuc_hien_luy_ke = thucHienLuyKe;
      });

      console.log('Chart data:', sortedData); // Debug log
      setChartData(sortedData);

    } catch (err: any) {
      let errorMessage = 'Không thể tải dữ liệu doanh thu theo tháng.';
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
      console.error("Error fetching monthly revenue data:", err);
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

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <LineChartIcon className="h-4 w-4" />
            {isCumulative ? 'Doanh thu chỉ tiêu và thực hiện theo tháng lũy kế' : 'Doanh thu chỉ tiêu và thực hiện theo tháng'}
          </CardTitle>
          <p className="text-xs text-muted-foreground">Đang tải dữ liệu...</p>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] pt-2">
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
            Lỗi Chart Doanh Thu Theo Tháng
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
           <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card className="h-full">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5">
            <LineChartIcon className="h-4 w-4" />
            {isCumulative ? 'Doanh thu chỉ tiêu và thực hiện theo tháng lũy kế' : 'Doanh thu chỉ tiêu và thực hiện theo tháng'}
          </CardTitle>
          <CardDescription className="text-xs truncate" title={filterDescription}>
            Cho: {filterDescription}
          </CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[280px]">
         <p className="text-sm text-muted-foreground">Không có dữ liệu cho kỳ/địa điểm đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <LineChartIcon className="h-4 w-4" />
          {isCumulative ? 'Doanh thu chỉ tiêu và thực hiện theo tháng lũy kế' : 'Doanh thu chỉ tiêu và thực hiện theo tháng'}
        </CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          {isCumulative 
            ? `Doanh thu chỉ tiêu và thực hiện lũy kế qua từng tháng cho ${filterDescription}.`
            : `Doanh thu chỉ tiêu và thực hiện theo từng tháng cho ${filterDescription}.`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="thang" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8} 
                className="text-xs"
                tickFormatter={(value) => `T${value}`}
              />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={() => ''} 
                className="text-xs"
              />
              <Tooltip 
                formatter={(value: any, name: string) => [
                  formatCurrency(value), 
                  name
                ]}
                labelFormatter={(label) => `Tháng ${label}`}
              />
              <Legend verticalAlign="top" height={36} />
              <Line 
                type="monotone" 
                dataKey={isCumulative ? "chi_tieu_luy_ke" : "chi_tieu"}
                stroke={chartConfig.chi_tieu.color} 
                strokeWidth={2}
                name={chartConfig.chi_tieu.label}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              >
                <LabelList 
                  dataKey={isCumulative ? "chi_tieu_luy_ke" : "chi_tieu"} 
                  position="top" 
                  formatter={(value: number) => {
                    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}T`;
                    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
                    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
                    return value.toString();
                  }}
                  fontSize={10}
                  fill="currentColor"
                />
              </Line>
              <Line 
                type="monotone" 
                dataKey={isCumulative ? "thuc_hien_luy_ke" : "thuc_hien"}
                stroke={chartConfig.thuc_hien.color} 
                strokeWidth={2}
                name={chartConfig.thuc_hien.label}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              >
                <LabelList 
                  dataKey={isCumulative ? "thuc_hien_luy_ke" : "thuc_hien"} 
                  position="top" 
                  formatter={(value: number) => {
                    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}T`;
                    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
                    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
                    return value.toString();
                  }}
                  fontSize={10}
                  fill="currentColor"
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
