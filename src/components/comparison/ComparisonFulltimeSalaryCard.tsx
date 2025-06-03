
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Banknote, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface ComparisonFulltimeSalaryCardProps {
  selectedMonths?: number[];
  selectedDepartments?: string[];
}

interface FetchError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function ComparisonFulltimeSalaryCard({ selectedMonths, selectedDepartments }: ComparisonFulltimeSalaryCardProps) {
  const [value2024, setValue2024] = useState<number | null>(null);
  const [value2025, setValue2025] = useState<number | null>(null);
  const [percentageChange, setPercentageChange] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");

  const fetchData = useCallback(async () => {
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
      monthSegment = "cả năm"; // Default to all months if none selected
    }

    let locationSegment: string;
    if (departmentNames.length > 0) {
      if (departmentNames.length <= 2) locationSegment = departmentNames.join(' & ');
      else locationSegment = `${departmentNames.length} địa điểm`;
    } else {
      locationSegment = "tất cả địa điểm";
    }
    setFilterDescription(`${monthSegment} tại ${locationSegment}`);
    
    const years = [2024, 2025];
    const results: (number | null)[] = [null, null];
    let currentError: FetchError | null = null;

    const functionName = 'get_total_salary_fulltime';

    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      try {
        const rpcArgs = {
          filter_year: year,
          filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
          filter_locations: (departmentNames.length > 0) ? departmentNames : null,
        };
        const { data, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

        if (rpcError) {
          const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
          const isFunctionMissingError = rpcError.code === '42883' || (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName));
          if (isFunctionMissingError) {
            throw { type: 'rpcMissing', message: `Hàm RPC '${functionName}' cho năm ${year} bị thiếu. Vui lòng kiểm tra README.md.` };
          }
          throw { type: 'generic', message: `Lỗi RPC (${functionName}, ${year}): ${rpcError.message}` };
        }
        results[i] = typeof data === 'string' ? parseFloat(data.replace(/,/g, '')) : (typeof data === 'number' ? data : 0);
      } catch (err: any) {
        if (!currentError) currentError = err.type ? err : { type: 'generic', message: err.message || `Lỗi không xác định khi tải dữ liệu cho ${year}` };
        console.error(`Error fetching full-time salary for ${year}:`, err);
        results[i] = null; // Ensure it's null on error
      }
    }

    if (currentError) {
      setError(currentError);
    } else {
      setValue2024(results[0]);
      setValue2025(results[1]);

      if (results[0] !== null && results[1] !== null) {
        if (results[0] === 0 && results[1] === 0) {
            setPercentageChange(0);
        } else if (results[0] === 0) {
            setPercentageChange(results[1] > 0 ? Infinity : 0); // Or handle as 'N/A' or specific large value
        } else {
            setPercentageChange(((results[1] - results[0]) / results[0]));
        }
      } else {
        setPercentageChange(null);
      }
    }
    setIsLoading(false);
  }, [selectedMonths, selectedDepartments]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const renderPercentageChange = () => {
    if (percentageChange === null) return <span className="text-sm text-muted-foreground">N/A</span>;
    if (percentageChange === Infinity) return <span className="text-sm text-red-600 dark:text-red-500 flex items-center"><TrendingUp className="mr-1 h-4 w-4" /> Tăng mạnh (từ 0)</span>;

    const displayPercent = (percentageChange * 100).toFixed(1) + '%';
    // Inverted color logic for costs: increase is red (bad), decrease is green (good)
    if (percentageChange > 0) {
      return <span className="text-sm text-red-600 dark:text-red-500 flex items-center"><TrendingUp className="mr-1 h-4 w-4" /> +{displayPercent}</span>;
    } else if (percentageChange < 0) {
      return <span className="text-sm text-green-600 dark:text-green-500 flex items-center"><TrendingDown className="mr-1 h-4 w-4" /> {displayPercent}</span>;
    } else {
      return <span className="text-sm text-muted-foreground flex items-center"><Minus className="mr-1 h-4 w-4" /> {displayPercent}</span>;
    }
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Lương FT (24 vs 25)</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle className="text-destructive text-sm font-semibold">Lỗi Lương FT (SS)</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Hãy đảm bảo hàm RPC `get_total_salary_fulltime` đã được tạo trong Supabase theo README.md.
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
            <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Full-time</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription className="text-xs truncate">So sánh {filterDescription} (2024 vs 2025)</CardDescription>
      </CardHeader>
      <CardContent className="pt-1 space-y-1">
        <div>
            <p className="text-xs text-muted-foreground">2024: <span className="font-medium text-foreground">{formatCurrency(value2024)}</span></p>
            <p className="text-xs text-muted-foreground">2025: <span className="font-medium text-foreground">{formatCurrency(value2025)}</span></p>
        </div>
        <div className="text-lg font-bold">
          {renderPercentageChange()}
        </div>
      </CardContent>
    </Card>
  );
}

