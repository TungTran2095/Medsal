"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react';
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

interface MonthlyRevenueData {
  thang: string;
  chi_tieu: number;
  thuc_hien: number;
  chi_tieu_luy_ke: number;
  thuc_hien_luy_ke: number;
}

interface RevenueMonthlyLineChartCompactProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
  isCumulative?: boolean;
  className?: string;
  khoiDTQL?: string;
}

export default function RevenueMonthlyLineChartCompact({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
  selectedDonVi2,
  isCumulative = false,
  className = "",
  khoiDTQL
}: RevenueMonthlyLineChartCompactProps) {
  const [chartData, setChartData] = useState<MonthlyRevenueData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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

      if (khoiDTQL) {
        query = query.eq('"Khối DTQL"', khoiDTQL);
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
          chi_tieu_luy_ke: 0,
          thuc_hien_luy_ke: 0,
        };
      });

      // Tạo dữ liệu đầy đủ cho cả 12 tháng
      const fullYearData = [];
      const currentYear = selectedYear || new Date().getFullYear();
      
      // Lấy tổng chỉ tiêu cả năm từ dữ liệu thực tế
      const totalChiTieuCaNam = processedData.reduce((sum, item) => sum + item.chi_tieu, 0);
      
      // Tính chỉ tiêu trung bình mỗi tháng
      const chiTieuTBThang = totalChiTieuCaNam / 12;
      
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString();
        const existingMonthData = processedData.find(item => item.thang === monthStr);
        
        if (existingMonthData) {
          fullYearData.push(existingMonthData);
        } else {
          // Tạo dữ liệu cho tháng không có báo cáo
          fullYearData.push({
            thang: monthStr,
            chi_tieu: Math.round(chiTieuTBThang), // Gán chỉ tiêu trung bình cho tháng không có báo cáo
            thuc_hien: 0,
            chi_tieu_luy_ke: 0,
            thuc_hien_luy_ke: 0,
          });
        }
      }

      // Sắp xếp theo tháng (1, 2, 3, ..., 12)
      const sortedData = fullYearData.sort((a, b) => {
        const monthA = parseInt(a.thang);
        const monthB = parseInt(b.thang);
        return monthA - monthB;
      });

      // Tính lũy kế cho chỉ tiêu (luôn tính đầy đủ 12 tháng)
      let chiTieuLuyKe = 0;
      let thucHienLuyKe = 0;
      
      sortedData.forEach((item, index) => {
        // Chỉ tiêu lũy kế: luôn tăng dần theo tháng (trung bình mỗi tháng)
        chiTieuLuyKe += item.chi_tieu;
        item.chi_tieu_luy_ke = Math.round(chiTieuLuyKe);
        
        // Thực hiện lũy kế: chỉ tăng khi có dữ liệu thực tế
        if (item.thuc_hien > 0) {
          thucHienLuyKe += item.thuc_hien;
        }
        item.thuc_hien_luy_ke = thucHienLuyKe;
      });

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
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setError(errorMessage);
      console.error("Error fetching monthly revenue data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2, khoiDTQL]);

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
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full text-destructive text-xs ${className}`}>
        <AlertTriangle className="h-4 w-4 mr-2" />
        {error}
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full text-muted-foreground text-xs ${className}`}>
        Không có dữ liệu
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="thang"
            tickLine={false}
            axisLine={false}
            tickMargin={5}
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
          <Legend verticalAlign="top" height={20} />
          <Line
            type="monotone"
            dataKey={isCumulative ? "chi_tieu_luy_ke" : "chi_tieu"}
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            name={isCumulative ? 'Chỉ tiêu lũy kế' : 'Chỉ tiêu'}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
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
              fontSize={8}
              fill="currentColor"
            />
          </Line>
          <Line
            type="monotone"
            dataKey={isCumulative ? "thuc_hien_luy_ke" : "thuc_hien"}
            stroke="hsl(var(--chart-2))"
            strokeWidth={2}
            name={isCumulative ? 'Thực hiện lũy kế' : 'Thực hiện'}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
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
              fontSize={8}
              fill="currentColor"
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
