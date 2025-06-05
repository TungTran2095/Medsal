
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, UserCheck, Banknote, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface AverageFTSalaryPerEmployeeCardProps {
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

export default function AverageFTSalaryPerEmployeeCard({
  selectedMonths,
  selectedYear,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: AverageFTSalaryPerEmployeeCardProps) {
  const [averageSalary, setAverageSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setAverageSalary(null);
    setDebugMessages([]);

    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) monthSegment = "tất cả các tháng";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
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
    setFilterDescription(`${monthSegment} của ${yearSegment} tại ${locationSegment}`);

    try {
      const rpcArgsBase = {
        filter_year: selectedYear,
        filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
      };
      const rpcArgsSalary = {
        ...rpcArgsBase,
        filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
      };
      // Assuming get_employee_count_fulltime might also support these filters.
      // If not, it will use what it supports and ignore others.
      const rpcArgsEmployeeCount = { ...rpcArgsSalary };


      let totalSalary: number | null = null;
      let employeeCount: number | null = null;
      let currentError: FetchError | null = null;
      let salaryRpcName = 'get_total_salary_fulltime';
      let empCountRpcName = 'get_employee_count_fulltime';

      const [salaryRes, empCountRes] = await Promise.allSettled([
        supabase.rpc(salaryRpcName, rpcArgsSalary),
        supabase.rpc(empCountRpcName, rpcArgsEmployeeCount),
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
      setDebugMessages(prev => [...prev, `Total Salary FT: ${totalSalary ?? 'Error'}`]);


      if (!currentError) { // Only proceed if salary fetch was okay
        if (empCountRes.status === 'fulfilled') {
          if (empCountRes.value.error) {
            const e = empCountRes.value.error;
            currentError = { type: (e.code === '42883' || e.message.includes(empCountRpcName)) ? 'rpcMissing' : 'generic', message: `Lỗi tải Số Lượng NV: ${e.message}` };
          } else {
            employeeCount = Number(empCountRes.value.data);
            if (employeeCount === null || isNaN(employeeCount)) employeeCount = 0; // Treat null/NaN count as 0
          }
        } else {
          currentError = { type: 'generic', message: `Lỗi mạng khi tải Số Lượng NV: ${empCountRes.reason?.message}` };
        }
      }
      setDebugMessages(prev => [...prev, `Employee Count FT: ${employeeCount ?? 'Error or 0'}`]);


      if (currentError) {
        setError(currentError);
        return;
      }

      if (totalSalary !== null && employeeCount !== null) {
        if (employeeCount === 0) {
          if (totalSalary > 0) {
            setError({ type: 'dataIssue', message: 'Không thể tính lương TB: Số lượng nhân viên bằng 0 nhưng tổng lương > 0.' });
            setAverageSalary(null);
          } else {
            setAverageSalary(0); // No employees, no salary = 0 average
          }
        } else {
          setAverageSalary(totalSalary / employeeCount);
        }
      } else {
        setError({ type: 'generic', message: 'Không thể lấy đủ dữ liệu để tính lương trung bình.' });
      }

    } catch (err: any) {
      setError({ type: 'generic', message: err.message || 'Lỗi không xác định khi tải dữ liệu.' });
    } finally {
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
  let displayValue = isLoading ? "Đang tải..." : formatCurrency(averageSalary);

  if (!isLoading && error) {
    cardState = "error";
    displayValue = "Lỗi";
  } else if (!isLoading && averageSalary === null && !error) {
    cardState = "noData";
    displayValue = "N/A";
  } else if (!isLoading && error?.type === 'dataIssue') {
    cardState = "warning";
    displayValue = "N/A";
  } else if (!isLoading && averageSalary === 0 && error === null) {
    // This case implies either no salary and no employees, or salary is 0 with some employees.
    // Displaying "0 VND" is fine.
  }


  return (
    <Card className={`h-full ${cardState === 'error' ? 'border-destructive/50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className={`text-sm font-semibold ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          Lương TB / NV (Full-time)
        </CardTitle>
        <div className="flex items-center">
          <Banknote className={`h-3 w-3 mr-0.5 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className={`text-xs ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>/</span>
          <Users className={`h-3 w-3 ml-0.5 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
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
              Cho: {filterDescription}
            </CardDescription>
            {error && (
              <p className="text-xs text-destructive mt-0.5">{error.message}</p>
            )}
            {error?.type === 'rpcMissing' && (
                 <p className="text-xs text-muted-foreground mt-1">
                   Đảm bảo các hàm RPC `get_total_salary_fulltime` và `get_employee_count_fulltime` tồn tại và hỗ trợ các bộ lọc cần thiết.
                 </p>
            )}
            {/* <pre className="text-[10px] text-muted-foreground mt-1 max-h-12 overflow-y-auto">{debugMessages.join('\n')}</pre> */}

          </>
        )}
      </CardContent>
    </Card>
  );
}

