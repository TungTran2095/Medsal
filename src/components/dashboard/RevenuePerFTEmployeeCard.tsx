
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface RevenuePerFTEmployeeCardProps {
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

export default function RevenuePerFTEmployeeCard({
  selectedMonths,
  selectedYear,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: RevenuePerFTEmployeeCardProps) {
  const [revenuePerEmployee, setRevenuePerEmployee] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");
  // const [debugMessages, setDebugMessages] = useState<string[]>([]);


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRevenuePerEmployee(null);
    // setDebugMessages([]);

    let periodType = "Tổng";
    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthSegment: string;
    let numberOfMonthsForAverage = 0;

    if (selectedMonths && selectedMonths.length > 0) {
      numberOfMonthsForAverage = selectedMonths.length;
      if (selectedMonths.length === 12) monthSegment = "cả năm";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
      periodType = "TB tháng";
    } else if (selectedYear) {
      monthSegment = "cả năm";
      numberOfMonthsForAverage = 12;
      periodType = "TB tháng";
    }
     else {
      monthSegment = "tất cả các tháng";
      // numberOfMonthsForAverage remains 0 for "all time"
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
    setFilterDescription(`${periodType} cho ${monthSegment} của ${yearSegment} tại ${locationSegment}`);

    try {
      const rpcArgsBase = {
        filter_year: selectedYear,
        filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
      };
      const rpcArgsRevenue = {
        ...rpcArgsBase,
        filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
      };
      const rpcArgsEmployeeCount = {
        ...rpcArgsBase,
        filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
      };

      let totalRevenue: number | null = null;
      let employeeCount: number | null = null;
      let currentError: FetchError | null = null;
      let revenueRpcName = 'get_total_revenue';
      let empCountRpcName = 'get_employee_count_fulltime';


      const [revenueRes, empCountRes] = await Promise.allSettled([
        supabase.rpc(revenueRpcName, rpcArgsRevenue),
        supabase.rpc(empCountRpcName, rpcArgsEmployeeCount),
      ]);

      if (revenueRes.status === 'fulfilled') {
        if (revenueRes.value.error) {
          const e = revenueRes.value.error;
          currentError = { type: (e.code === '42883' || e.message.includes(revenueRpcName)) ? 'rpcMissing' : 'generic', message: `Lỗi tải Tổng Doanh Thu: ${e.message}` };
        } else {
          totalRevenue = Number(revenueRes.value.data) || 0;
        }
      } else {
        currentError = { type: 'generic', message: `Lỗi mạng khi tải Tổng Doanh Thu: ${revenueRes.reason?.message}` };
      }
      // setDebugMessages(prev => [...prev, `Total Revenue: ${totalRevenue ?? 'Error'}`]);

      if (!currentError) {
        if (empCountRes.status === 'fulfilled') {
          if (empCountRes.value.error) {
            const e = empCountRes.value.error;
            currentError = { type: (e.code === '42883' || e.message.includes(empCountRpcName)) ? 'rpcMissing' : 'generic', message: `Lỗi tải Số Lượng NV: ${e.message}` };
          } else {
            employeeCount = Number(empCountRes.value.data);
            if (employeeCount === null || isNaN(employeeCount)) employeeCount = 0;
          }
        } else {
          currentError = { type: 'generic', message: `Lỗi mạng khi tải Số Lượng NV: ${empCountRes.reason?.message}` };
        }
      }
      // setDebugMessages(prev => [...prev, `Employee Count FT: ${employeeCount ?? 'Error or 0'}`]);

      if (currentError) {
        setError(currentError);
        return;
      }

      if (totalRevenue !== null && employeeCount !== null) {
        if (employeeCount === 0) {
          if (totalRevenue > 0) {
            setError({ type: 'dataIssue', message: 'Không thể tính DT/NV: Số lượng nhân viên bằng 0 nhưng doanh thu > 0.' });
            setRevenuePerEmployee(null);
          } else {
            setRevenuePerEmployee(0); 
          }
        } else {
          let avgRev = totalRevenue / employeeCount;
          if (numberOfMonthsForAverage > 0) {
            avgRev = avgRev / numberOfMonthsForAverage;
          }
          setRevenuePerEmployee(avgRev);
        }
      } else {
         setError({ type: 'generic', message: 'Không thể lấy đủ dữ liệu để tính doanh thu / nhân viên.' });
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
  let displayValue = isLoading ? "Đang tải..." : formatCurrency(revenuePerEmployee);

  if (!isLoading && error) {
    cardState = "error";
    displayValue = "Lỗi";
  } else if (!isLoading && revenuePerEmployee === null && !error) {
    cardState = "noData";
    displayValue = "N/A";
  } else if (!isLoading && error?.type === 'dataIssue') {
    cardState = "warning";
    displayValue = "N/A";
  } else if (!isLoading && revenuePerEmployee === 0 && error === null) {
    // Displaying "0 VND" is fine.
  }

  return (
    <Card className={`h-full ${cardState === 'error' ? 'border-destructive/50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className={`text-sm font-semibold ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          Doanh Thu / NV (Full-time)
        </CardTitle>
         <div className="flex items-center">
          <TrendingUp className={`h-3 w-3 mr-0.5 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
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
              {filterDescription}
            </CardDescription>
             {error && (
              <p className="text-xs text-destructive mt-0.5">{error.message}</p>
            )}
            {error?.type === 'rpcMissing' && (
                 <p className="text-xs text-muted-foreground mt-1">
                   Đảm bảo các hàm RPC `get_total_revenue` và `get_employee_count_fulltime` tồn tại và hỗ trợ các bộ lọc.
                 </p>
            )}
            {/* <pre className="text-[10px] text-muted-foreground mt-1 max-h-12 overflow-y-auto">{debugMessages.join('\n')}</pre> */}
          </>
        )}
      </CardContent>
    </Card>
  );
}

    