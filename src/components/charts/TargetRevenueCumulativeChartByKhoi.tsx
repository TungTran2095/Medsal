"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';

interface RevenueDataByKhoi {
  khoi_dtql: string;
  chi_tieu: number;
  thuc_hien: number;
  ty_le_thuc_hien: number;
}

interface TargetRevenueCumulativeChartByKhoiProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

export default function TargetRevenueCumulativeChartByKhoi({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
  selectedDonVi2
}: TargetRevenueCumulativeChartByKhoiProps) {
  const [chartData, setChartData] = useState<RevenueDataByKhoi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('Doanh_thu')
        .select('"Khối DTQL", "Chỉ tiêu", "Kỳ báo cáo", "Tháng", "Năm"')
        .not('"Khối DTQL"', 'is', null)
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

      const khoiMap = new Map<string, { chi_tieu: number; thuc_hien: number }>();
      
      const excludedKhoi = ['', null, undefined];
      
      (rawData || []).forEach((item: any) => {
        const khoiDTQL = item['Khối DTQL'];
        
        if (excludedKhoi.includes(khoiDTQL)) {
          return;
        }
        
        const chiTieu = Number(item['Chỉ tiêu']) || 0;
        const thucHien = Number(item['Kỳ báo cáo']) || 0;
        
        // Chỉ sum các tháng có kỳ báo cáo > 0
        if (thucHien > 0) {
          if (khoiMap.has(khoiDTQL)) {
            const existing = khoiMap.get(khoiDTQL)!;
            existing.chi_tieu += chiTieu;
            existing.thuc_hien += thucHien;
          } else {
            khoiMap.set(khoiDTQL, { chi_tieu: chiTieu, thuc_hien: thucHien });
          }
        }
      });

      const processedData = Array.from(khoiMap.entries()).map(([khoiDTQL, data]) => {
        const tyLeThucHien = data.chi_tieu > 0 ? data.thuc_hien / data.chi_tieu : 0;
        
        return {
          khoi_dtql: khoiDTQL,
          chi_tieu: data.chi_tieu,
          thuc_hien: data.thuc_hien,
          ty_le_thuc_hien: tyLeThucHien,
        };
      });

      const filteredData = processedData
        .filter(item => item.chi_tieu > 0 || item.thuc_hien > 0)
        .sort((a, b) => b.thuc_hien - a.thuc_hien);

      setChartData(filteredData);

    } catch (err: any) {
      let errorMessage = 'Không thể tải dữ liệu doanh thu theo khối.';
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
      console.error("Error fetching revenue data by khoi:", err);
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
      <Card className="flex-grow flex flex-col h-[400px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Tình hình thực hiện chỉ tiêu/doanh thu lũy kế
          </CardTitle>
          <CardDescription>Đang tải dữ liệu...</CardDescription>
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
      <Card className="flex-grow flex flex-col h-[400px] border-destructive/50">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Chart Doanh Thu Theo Khối
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
      <Card className="flex-grow flex flex-col h-[400px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Tình hình thực hiện chỉ tiêu/doanh thu lũy kế
          </CardTitle>
          <CardDescription>Dữ liệu lũy kế</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">Không có dữ liệu cho kỳ/khối đã chọn.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-grow flex flex-col h-[400px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4" />
          Tình hình thực hiện chỉ tiêu/doanh thu lũy kế
        </CardTitle>
        <CardDescription>Dữ liệu lũy kế</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="khoi_dtql"
              tickLine={false}
              axisLine={false}
              tickMargin={5}
              className="text-xs"
              angle={-45}
              textAnchor="end"
              height={80}
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
                name === 'chi_tieu' ? 'Chỉ tiêu' : 'Thực hiện'
              ]}
              labelFormatter={(label) => `Khối: ${label}`}
            />
            <Legend verticalAlign="top" height={20} />
            <Bar
              dataKey="chi_tieu"
              fill="hsl(var(--chart-1))"
              name="Chỉ tiêu"
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="chi_tieu"
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
            </Bar>
            <Bar
              dataKey="thuc_hien"
              fill="hsl(var(--chart-2))"
              name="Thực hiện"
              radius={[4, 4, 0, 0]}
            >
              <LabelList
                dataKey="thuc_hien"
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
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

