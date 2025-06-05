
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp, Briefcase } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface RevenuePerWorkdayCardProps {
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

export default function RevenuePerWorkdayCard({
  selectedMonths,
  selectedYear,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: RevenuePerWorkdayCardProps) {
  const [revenuePerWorkday, setRevenuePerWorkday] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRevenuePerWorkday(null);
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
    // Note: get_total_revenue doesn't use nganh_doc, but workdays do. Filter description reflects all active filters.
    if (selectedNganhDoc && selectedNganhDoc.length > 0) {
      appliedFilters.push(selectedNganhDoc.length <= 2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    setFilterDescription(`Cho ${monthSegment} của ${yearSegment} tại ${locationSegment}`);

    try {
      const rpcArgsRevenue = {
        filter_year: selectedYear,
        filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
      };
      const rpcArgsWorkdays = {
        filter_year: selectedYear,
        filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
      };

      let totalRevenue: number | null = null;
      let totalWorkdays: number | null = null;
      let currentError: FetchError | null = null;
      const revenueRpcName = 'get_total_revenue';
      const workdaysRpcName = 'get_total_workdays_fulltime';

      const [revenueRes, workdaysRes] = await Promise.allSettled([
        supabase.rpc(revenueRpcName, rpcArgsRevenue),
        supabase.rpc(workdaysRpcName, rpcArgsWorkdays),
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
      currentDebugMessages.push(`Total Revenue: ${totalRevenue ?? 'Error'}`);

      if (!currentError) {
        if (workdaysRes.status === 'fulfilled') {
          if (workdaysRes.value.error) {
            const e = workdaysRes.value.error;
            let errorType: FetchError['type'] = 'generic';
            let specificMsg = `Lỗi tải Tổng Công FT: ${e.message}`;
            if (e.code === '42883' || e.message.includes(workdaysRpcName)) errorType = 'rpcMissing';
             if (e.message.includes("column") && e.message.includes("does not exist")) {
                 errorType = 'rpcMissing'; 
                 specificMsg = `Một hoặc nhiều cột công không tồn tại trong bảng Fulltime. Vui lòng kiểm tra RPC '${workdaysRpcName}' và bảng.`;
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

      if (totalRevenue !== null && totalWorkdays !== null) {
        if (totalWorkdays === 0) {
          if (totalRevenue > 0) {
            setError({ type: 'dataIssue', message: 'Không thể tính DT/công: Tổng công bằng 0 nhưng doanh thu > 0.' });
            setRevenuePerWorkday(null);
          } else {
            setRevenuePerWorkday(0);
          }
        } else {
          let rawAveragePerWorkdayOverPeriod = totalRevenue / totalWorkdays;
          currentDebugMessages.push(`Raw Avg/Workday (Period): ${rawAveragePerWorkdayOverPeriod.toFixed(0)}`);
          setRevenuePerWorkday(rawAveragePerWorkdayOverPeriod); // Directly use the raw average for the period
        }
      } else {
         setError({ type: 'generic', message: 'Không thể lấy đủ dữ liệu để tính doanh thu / công.' });
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
  let displayValue = isLoading ? "Đang tải..." : formatCurrency(revenuePerWorkday);

  if (!isLoading && error) {
    cardState = "error";
    displayValue = "Lỗi";
  } else if (!isLoading && revenuePerWorkday === null && !error) {
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
          Doanh Thu / Công (Full-time)
        </CardTitle>
         <div className="flex items-center">
          <TrendingUp className={`h-3 w-3 mr-0.5 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
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
                   Đảm bảo các hàm RPC `get_total_revenue` và `get_total_workdays_fulltime` tồn tại, hỗ trợ các bộ lọc và các cột công có trong bảng Fulltime.
                 </p>
            )}
            {/* <pre className="text-[10px] text-muted-foreground mt-1 max-h-12 overflow-y-auto">{debugMessages.join('\n')}</pre> */}
          </>
        )}
      </CardContent>
    </Card>
  );
}

