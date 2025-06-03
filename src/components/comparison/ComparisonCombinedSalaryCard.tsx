
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ComparisonCombinedSalaryCardProps {
  selectedMonths?: number[];
  selectedDepartments?: string[];
}

interface FetchError {
  type: 'rpcMissing' | 'generic';
  message: string;
  details?: string;
}

export default function ComparisonCombinedSalaryCard({ selectedMonths, selectedDepartments }: ComparisonCombinedSalaryCardProps) {
  const [value2024, setValue2024] = useState<number | null>(null);
  const [value2025, setValue2025] = useState<number | null>(null);
  const [percentageChange, setPercentageChange] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");

  const fetchYearData = useCallback(async (year: number, months?: number[], departments?: string[]) => {
    const departmentNames = departments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];
    const rpcArgs = {
      filter_year: year,
      filter_months: (months && months.length > 0) ? months : null,
      filter_locations: (departmentNames.length > 0) ? departmentNames : null,
    };

    let ftSalary = 0;
    let ptSalary = 0;
    let ftError: FetchError | null = null;
    let ptError: FetchError | null = null;

    try {
      const { data: ftData, error: ftRpcError } = await supabase.rpc('get_total_salary_fulltime', rpcArgs);
      if (ftRpcError) {
        const msg = ftRpcError.message ? String(ftRpcError.message).toLowerCase() : '';
        ftError = {type: (ftRpcError.code === '42883' || (ftRpcError.code === 'PGRST202' && msg.includes('get_total_salary_fulltime'))) ? 'rpcMissing' : 'generic', message: `Lỗi FT (${year}): ${ftRpcError.message}`};
      } else {
        ftSalary = Number(ftData) || 0;
      }
    } catch (e: any) {
      ftError = {type: 'generic', message: `Lỗi FT (${year}): ${e.message}`};
    }

    try {
      const { data: ptData, error: ptRpcError } = await supabase.rpc('get_total_salary_parttime', rpcArgs);
      if (ptRpcError) {
        const msg = ptRpcError.message ? String(ptRpcError.message).toLowerCase() : '';
        ptError = {type: (ptRpcError.code === '42883' || (ptRpcError.code === 'PGRST202' && msg.includes('get_total_salary_parttime'))) ? 'rpcMissing' : 'generic', message: `Lỗi PT (${year}): ${ptRpcError.message}`};
      } else {
        ptSalary = Number(ptData) || 0;
      }
    } catch (e: any) {
      ptError = {type: 'generic', message: `Lỗi PT (${year}): ${e.message}`};
    }
    
    if (ftError || ptError) {
        const combinedMessage = [ftError?.message, ptError?.message].filter(Boolean).join('; ');
        return { value: null, error: {type: 'generic', message: combinedMessage } as FetchError};
    }

    return { value: ftSalary + ptSalary, error: null };
  }, []);


  constfetchAllData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setValue2024(null);
    setValue2025(null);
    setPercentageChange(null);

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

    const res2024 = await fetchYearData(2024, selectedMonths, selectedDepartments);
    const res2025 = await fetchYearData(2025, selectedMonths, selectedDepartments);

    if (res2024.error || res2025.error) {
        const combinedErrorMessage = [res2024.error?.message, res2025.error?.message].filter(Boolean).join('; ');
        setError({type: 'generic', message: combinedErrorMessage || "Lỗi không xác định khi tải dữ liệu tổng lương."});
    } else {
        setValue2024(res2024.value);
        setValue2025(res2025.value);

        if (res2024.value !== null && res2025.value !== null) {
            if (res2024.value === 0 && res2025.value === 0) {
                setPercentageChange(0);
            } else if (res2024.value === 0) {
                setPercentageChange(res2025.value > 0 ? Infinity : 0);
            } else {
                setPercentageChange(((res2025.value - res2024.value) / res2024.value));
            }
        } else {
            setPercentageChange(null);
        }
    }
    setIsLoading(false);
  }, [selectedMonths, selectedDepartments, fetchYearData]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);
  
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const renderPercentageChange = () => {
    if (percentageChange === null) return <span className="text-sm text-muted-foreground">N/A</span>;
    if (percentageChange === Infinity) return <span className="text-sm text-green-600 dark:text-green-500 flex items-center"><TrendingUp className="mr-1 h-4 w-4" /> Tăng mạnh (từ 0)</span>;

    const displayPercent = (percentageChange * 100).toFixed(1) + '%';
    if (percentageChange > 0) {
      return <span className="text-sm text-green-600 dark:text-green-500 flex items-center"><TrendingUp className="mr-1 h-4 w-4" /> +{displayPercent}</span>;
    } else if (percentageChange < 0) {
      return <span className="text-sm text-red-600 dark:text-red-500 flex items-center"><TrendingDown className="mr-1 h-4 w-4" /> {displayPercent}</span>;
    } else {
      return <span className="text-sm text-muted-foreground flex items-center"><Minus className="mr-1 h-4 w-4" /> {displayPercent}</span>;
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương (24 vs 25)</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle className="text-destructive text-sm font-semibold">Lỗi Tổng Lương (SS)</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Hãy đảm bảo các hàm RPC `get_total_salary_fulltime` và `get_total_salary_parttime` đã được tạo trong Supabase theo README.md.
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
            <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Quỹ Lương (FT+PT)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-xs">So sánh {filterDescription} (2024 vs 2025)</CardDescription>
      </CardHeader>
      <CardContent className="pt-1 space-y-1">
        <div>
            <p className="text-xs text-muted-foreground">2024: <span className="font-medium text-foreground">{formatCurrency(value2024)}</span></p>
            <p className="text-xs text-muted-foreground">2025: <span className="font-medium text-foreground">{formatCurrency(value2025)}</span></p>
        </div>
        <div className="text-lg font-bold text-primary">
          {renderPercentageChange()}
        </div>
      </CardContent>
    </Card>
  );
}
