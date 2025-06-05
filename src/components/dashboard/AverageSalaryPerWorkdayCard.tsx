
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Banknote, Briefcase } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface AverageSalaryPerWorkdayCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

interface FetchError {
  type: 'rpcMissing' | 'dataIssue' | 'generic';
  message: string;
  details?: string;
}

export default function AverageSalaryPerWorkdayCard({
  selectedMonths,
  selectedYear,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: AverageSalaryPerWorkdayCardProps) {
  const [averageSalaryPerWorkday, setAverageSalaryPerWorkday] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAverageSalaryPerWorkday(null);
    let currentDebugMessages: string[] = [];

    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthSegment: string;

    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) monthSegment = "cả năm";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
    } else if (selectedYear) {
      monthSegment = "cả năm";
    } else {
      monthSegment = "tất cả các tháng";
    }

    let locationSegment = "tất cả địa điểm";
    let appliedFilters: string[] = [];
    if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
      appliedFilters.push(selectedDepartmentsForDiadiem.length <= 2 ? selectedDepartmentsForDiadiem.join(' & ') : `${selectedDepartmentsForDiadiem.length} địa điểm (Loại/Pban)`);
    }
    if (selectedNganhDoc && selectedNganhDoc.length > 0) {
      appliedFilters.push(selectedNganhDoc.length <= 2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    setFilterDescription(`Cho ${monthSegment} của ${yearSegment} tại ${locationSegment}`);

    try {
      const rpcArgsSalaryAndWorkdays = {
        filter_year: selectedYear,
        filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
      };

      let totalSalary: number | null = null;
      let totalWorkdays: number | null = null;
      let currentError: FetchError | null = null;
      const salaryRpcName = 'get_total_salary_fulltime';
      const workdaysRpcName = 'get_total_workdays_fulltime';

      const [salaryRes, workdaysRes] = await Promise.allSettled([
        supabase.rpc(salaryRpcName, rpcArgsSalaryAndWorkdays),
        supabase.rpc(workdaysRpcName, rpcArgsSalaryAndWorkdays),
      ]);

      if (salaryRes.status === 'fulfilled') {
        if (salaryRes.value.error) {
          const e = salaryRes.value.error;
          currentError = { type: (e.code === '42883' || e.message.includes(salaryRpcName)) ? 'rpcMissing' : 'generic', message: `Lỗi tải Tổng Lương FT: ${e.message}` };
        } else {
          totalSalary = Number(salaryRes.value.data) || 0;
        }
      } else {
        currentError = { type: 'generic', message: `Lỗi mạng khi tải Tổng Lương FT: ${salaryRes.reason?.message}` };
      }
      currentDebugMessages.push(`Total Salary FT: ${totalSalary ?? 'Error'}`);

      if (!currentError) {
        if (workdaysRes.status === 'fulfilled') {
          if (workdaysRes.value.error) {
            const e = workdaysRes.value.error;
            let errorType: FetchError['type'] = 'generic';
            let specificMsg = `Lỗi tải Tổng Công FT: ${e.message}`;
            if (e.code === '42883' || e.message.includes(workdaysRpcName)) errorType = 'rpcMissing';
             if (e.message.includes("column") && e.message.includes("does not exist")) {
                 errorType = 'rpcMissing'; 
                 specificMsg = `Một hoặc nhiều cột công (ví dụ: ngay_thuong_chinh_thuc) không tồn tại trong bảng Fulltime. Vui lòng kiểm tra RPC '${workdaysRpcName}' và bảng.`;
            }
            currentError = { type: errorType, message: specificMsg };
          } else {
            totalWorkdays = Number(workdaysRes.value.data);
             if (totalWorkdays === null || isNaN(totalWorkdays)) totalWorkdays = 0;
          }
        } else {
          currentError = { type: 'generic', message: `Lỗi mạng khi tải Tổng Công FT: ${workdaysRes.reason?.message}` };
        }
      }
      currentDebugMessages.push(`Total Workdays FT: ${totalWorkdays ?? 'Error or 0'}`);

      if (currentError) {
        setError(currentError);
        setDebugMessages(currentDebugMessages);
        return;
      }

      if (totalSalary !== null && totalWorkdays !== null) {
        if (totalWorkdays === 0) {
          if (totalSalary > 0) {
            setError({ type: 'dataIssue', message: 'Không thể tính lương/công: Tổng công bằng 0 nhưng tổng lương > 0.' });
            setAverageSalaryPerWorkday(null);
          } else {
            setAverageSalaryPerWorkday(0);
          }
        } else {
          let rawAveragePerWorkdayOverPeriod = totalSalary / totalWorkdays;
          currentDebugMessages.push(`Raw Avg/Workday (Period): ${rawAveragePerWorkdayOverPeriod.toFixed(0)}`);
          setAverageSalaryPerWorkday(rawAveragePerWorkdayOverPeriod); // Directly use the raw average for the period
        }
      } else {
        setError({ type: 'generic', message: 'Không thể lấy đủ dữ liệu để tính lương / công.' });
      }

    } catch (err: any) {
      setError({ type: 'generic', message: err.message || 'Lỗi không xác định khi tải dữ liệu.' });
    } finally {
      setDebugMessages(currentDebugMessages);
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  let cardState: "default" | "error" | "warning" | "noData" = "default";
  let displayValue = isLoading ? "Đang tải..." : formatCurrency(averageSalaryPerWorkday);

  if (!isLoading && error) {
    cardState = "error";
    displayValue = "Lỗi";
  } else if (!isLoading && averageSalaryPerWorkday === null && !error) {
    cardState = "noData";
    displayValue = "N/A";
  } else if (!isLoading && error?.type === 'dataIssue') {
    cardState = "warning";
    displayValue = "N/A";
  }

  return (
    <Card className={`h-full ${cardState === 'error' ? 'border-destructive/50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className={`text-sm font-semibold ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          Lương / Công (Full-time)
        </CardTitle>
        <div className="flex items-center">
          <Banknote className={`h-3 w-3 mr-0.5 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={`text-xs ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>/</span>
          <Briefcase className={`h-3 w-3 ml-0.5 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className={`text-xl font-bold ${
              cardState === 'error' ? 'text-destructive'
              : cardState === 'warning' || cardState === 'noData' ? 'text-muted-foreground'
              : 'text-primary'
            }`}>
              {error && error.type !== 'dataIssue' ? <AlertTriangle className="h-5 w-5 inline mr-1 mb-1" /> : null}
              {displayValue}
            </div>
            <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
              {filterDescription}
            </CardDescription>
            {error && (
              <p className="text-xs text-destructive mt-0.5">{error.message}</p>
            )}
            {error?.type === 'rpcMissing' && (
                 <p className="text-xs text-muted-foreground mt-1">
                   Đảm bảo các hàm RPC `get_total_salary_fulltime` và `get_total_workdays_fulltime` tồn tại, hỗ trợ các bộ lọc và các cột công có trong bảng Fulltime.
                 </p>
            )}
            {/* <pre className="text-[10px] text-muted-foreground mt-1 max-h-12 overflow-y-auto">{debugMessages.join('\n')}</pre> */}
          </>
        )}
      </CardContent>
    </Card>
  );
}

