
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Percent, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ComparisonSalaryRevenueRatioCardProps {
  selectedMonths?: number[];
  selectedDepartments?: string[];
}

interface FetchError {
  type: 'rpcMissing' | 'dataIssue' | 'generic';
  message: string;
  details?: string;
}

interface YearData {
  ftSalary: number | null;
  ptSalary: number | null;
  revenue: number | null;
  ratio: number | null;
  error: FetchError | null;
}

export default function ComparisonSalaryRevenueRatioCard({ selectedMonths, selectedDepartments }: ComparisonSalaryRevenueRatioCardProps) {
  const [data2024, setData2024] = useState<YearData | null>(null);
  const [data2025, setData2025] = useState<YearData | null>(null);
  const [percentagePointChange, setPercentagePointChange] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");

  const fetchSingleYearData = useCallback(async (year: number, months?: number[], departments?: string[]): Promise<YearData> => {
    const departmentNames = departments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];
    const rpcArgs = {
      filter_year: year,
      filter_months: (months && months.length > 0) ? months : null,
      filter_locations: (departmentNames.length > 0) ? departmentNames : null,
    };

    let ftSal: number | null = null;
    let ptSal: number | null = null;
    let rev: number | null = null;
    let currentYearError: FetchError | null = null;

    const results = await Promise.allSettled([
      supabase.rpc('get_total_salary_fulltime', rpcArgs),
      supabase.rpc('get_total_salary_parttime', rpcArgs),
      supabase.rpc('get_total_revenue', rpcArgs),
    ]);

    const processRpcResult = (res: PromiseSettledResult<any>, dataType: string, funcName: string): number | null => {
      if (res.status === 'fulfilled') {
        if (res.value.error) {
          const msg = res.value.error.message ? String(res.value.error.message).toLowerCase() : '';
          const errType = (res.value.error.code === '42883' || (res.value.error.code === 'PGRST202' && msg.includes(funcName))) ? 'rpcMissing' : 'generic';
          if (!currentYearError) { // Only set first error for the year
            currentYearError = { type: errType, message: `Lỗi ${dataType} (${year}): ${res.value.error.message}` };
          }
          return null;
        }
        return Number(res.value.data) || 0;
      } else { // rejected
        if (!currentYearError) {
          currentYearError = { type: 'generic', message: `Lỗi ${dataType} (${year}): ${res.reason?.message || 'Unknown rejection'}` };
        }
        return null;
      }
    };

    ftSal = processRpcResult(results[0], 'Lương FT', 'get_total_salary_fulltime');
    ptSal = processRpcResult(results[1], 'Lương PT', 'get_total_salary_parttime');
    rev = processRpcResult(results[2], 'Doanh Thu', 'get_total_revenue');

    if (currentYearError) {
      return { ftSalary: ftSal, ptSalary: ptSal, revenue: rev, ratio: null, error: currentYearError };
    }

    if (rev === null || ftSal === null || ptSal === null) {
      return { ftSalary: ftSal, ptSalary: ptSal, revenue: rev, ratio: null, error: {type: 'generic', message: `Thiếu dữ liệu để tính tỷ lệ cho năm ${year}.`} };
    }

    if (rev === 0) {
      if (ftSal > 0 || ptSal > 0) {
        return { ftSalary: ftSal, ptSalary: ptSal, revenue: rev, ratio: null, error: { type: 'dataIssue', message: `Doanh thu bằng 0 cho năm ${year}, không thể tính tỷ lệ.` } };
      }
      return { ftSalary: ftSal, ptSalary: ptSal, revenue: rev, ratio: 0, error: null }; // All zero
    }
    
    const calculatedRatio = (ftSal + ptSal) / rev;
    return { ftSalary: ftSal, ptSalary: ptSal, revenue: rev, ratio: calculatedRatio, error: null };

  }, []);


  const fetchAllComparisonData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setData2024(null);
    setData2025(null);
    setPercentagePointChange(null);

    const departmentNames = selectedDepartments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) monthSegment = "cả năm";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `${selectedMonths.length} tháng`;
    } else {
      monthSegment = "cả năm";
    }

    let locationSegment: string;
    if (departmentNames.length > 0) {
      if (departmentNames.length <= 2) locationSegment = departmentNames.join(' & ');
      else locationSegment = `${departmentNames.length} địa điểm`;
    } else {
      locationSegment = "tất cả địa điểm";
    }
    setFilterDescription(`${monthSegment} tại ${locationSegment}`);

    const res2024 = await fetchSingleYearData(2024, selectedMonths, selectedDepartments);
    const res2025 = await fetchSingleYearData(2025, selectedMonths, selectedDepartments);

    setData2024(res2024);
    setData2025(res2025);

    if (res2024.error) {
        setError(res2024.error);
    } else if (res2025.error) {
        setError(res2025.error);
    }


    if (res2024.ratio !== null && res2025.ratio !== null && !res2024.error && !res2025.error) {
        setPercentagePointChange(res2025.ratio - res2024.ratio);
    } else {
        setPercentagePointChange(null);
    }
    setIsLoading(false);
  }, [selectedMonths, selectedDepartments, fetchSingleYearData]);

  useEffect(() => {
    fetchAllComparisonData();
  }, [fetchAllComparisonData]);
  
  const formatRatio = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  };

  const renderPercentagePointChange = () => {
    if (percentagePointChange === null) return <span className="text-sm text-muted-foreground">N/A</span>;
    
    const displayPoints = (percentagePointChange * 100).toFixed(1) + ' điểm %';
    if (percentagePointChange > 0) {
      return <span className="text-sm text-green-600 dark:text-green-500 flex items-center"><TrendingUp className="mr-1 h-4 w-4" /> +{displayPoints}</span>;
    } else if (percentagePointChange < 0) {
      return <span className="text-sm text-red-600 dark:text-red-500 flex items-center"><TrendingDown className="mr-1 h-4 w-4" /> {displayPoints}</span>;
    } else {
      return <span className="text-sm text-muted-foreground flex items-center"><Minus className="mr-1 h-4 w-4" /> {displayPoints}</span>;
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tỷ Lệ QL/DT (SS)</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-destructive text-sm font-semibold">Lỗi Tỷ Lệ QL/DT (SS)</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {(error.type === 'rpcMissing' || error.message.includes("Hàm RPC")) && (
            <p className="text-xs text-muted-foreground mt-1">
              Đảm bảo các hàm RPC `get_total_salary_fulltime`, `get_total_salary_parttime`, và `get_total_revenue` đã được tạo/cập nhật trong Supabase theo README.md.
            </p>
          )}
           {error.type === 'dataIssue' && (
             <p className="text-xs text-muted-foreground mt-1">
               Kiểm tra lại dữ liệu đầu vào cho tính toán này.
             </p>
           )}
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <div className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">Tỷ Lệ Quỹ Lương/Doanh Thu</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-xs">So sánh {filterDescription} (2024 vs 2025)</CardDescription>
      </CardHeader>
      <CardContent className="pt-1 space-y-1">
        <div>
            <p className="text-xs text-muted-foreground">2024: <span className="font-medium text-foreground">{formatRatio(data2024?.ratio)}</span></p>
            <p className="text-xs text-muted-foreground">2025: <span className="font-medium text-foreground">{formatRatio(data2025?.ratio)}</span></p>
        </div>
        <div className="text-lg font-bold text-primary">
          {renderPercentagePointChange()}
        </div>
         {data2024?.error && data2024.error.type === 'dataIssue' && <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{data2024.error.message}</p>}
         {data2025?.error && data2025.error.type === 'dataIssue' && !data2024?.error && <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">{data2025.error.message}</p>}
      </CardContent>
    </Card>
  );
}

