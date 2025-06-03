
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Percent } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SalaryToRevenueRatioCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartments?: string[]; // Added
}

interface FetchError {
  type: 'rpcMissing' | 'dataIssue' | 'generic';
  message: string;
}

export default function SalaryToRevenueRatioCard({ selectedMonths, selectedYear, selectedDepartments }: SalaryToRevenueRatioCardProps) {
  const [ratio, setRatio] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const [fulltimeSalary, setFulltimeSalary] = useState<number | null>(null);
  const [parttimeSalary, setParttimeSalary] = useState<number | null>(null);
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setRatio(null);
    setFulltimeSalary(null);
    setParttimeSalary(null);
    setTotalRevenue(null);

    const departmentNames = selectedDepartments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];

    let finalFilterDescription: string;
    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) {
        monthSegment = "tất cả các tháng";
      } else if (selectedMonths.length === 1) {
        monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      } else {
        monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
      }
    } else {
      monthSegment = "tất cả các tháng";
    }

    let locationSegment: string;
    if (departmentNames.length > 0) {
      if (departmentNames.length <= 2) {
        locationSegment = departmentNames.join(' & ');
      } else {
        locationSegment = `${departmentNames.length} địa điểm`;
      }
    } else {
      locationSegment = "tất cả địa điểm";
    }

    if (selectedYear) {
      finalFilterDescription = `${monthSegment} của ${yearSegment} tại ${locationSegment}`;
    } else {
      if (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) {
        finalFilterDescription = `${monthSegment} (mọi năm) tại ${locationSegment}`;
      } else {
        finalFilterDescription = `tất cả các kỳ tại ${locationSegment}`;
      }
    }
    setFilterDescription(finalFilterDescription);

    const rpcArgs = {
      filter_year: selectedYear,
      filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
      filter_locations: (departmentNames.length > 0) ? departmentNames : null, // Added
    };

    try {
      const [ftSalaryRes, ptSalaryRes, revenueRes] = await Promise.allSettled([
        supabase.rpc('get_total_salary_fulltime', rpcArgs),
        supabase.rpc('get_total_salary_parttime', rpcArgs),
        supabase.rpc('get_total_revenue', rpcArgs),
      ]);

      let ftSal = 0;
      let ptSal = 0;
      let rev = 0;
      let currentError: FetchError | null = null;

      const processResult = (res: PromiseSettledResult<any>, name: string, funcName: string, tableName: string, columnName?: string) => {
        if (res.status === 'rejected' || (res.status === 'fulfilled' && res.value.error)) {
          const rpcError = res.status === 'fulfilled' ? res.value.error : res.reason;
          const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
           const isFunctionMissingError =
            rpcError.code === '42883' ||
            (rpcError.code === 'PGRST202' && rpcMessageText.includes(funcName.toLowerCase())) ||
            (rpcMessageText.includes(funcName.toLowerCase()) && rpcMessageText.includes('does not exist'));
          
          const isTableMissingError = rpcMessageText.includes(`relation "${tableName.toLowerCase()}" does not exist`);
          const isColumnMissingError = columnName ? rpcMessageText.includes(`column "${columnName.toLowerCase()}" does not exist`) : false;


          if (isFunctionMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Hàm RPC '${funcName}' cho ${name} bị thiếu. Kiểm tra README.md.` };
          if (isTableMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Bảng '${tableName}' cho ${name} không tồn tại.`};
          if (isColumnMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Cột '${columnName}' trong bảng '${tableName}' cho ${name} không tồn tại.`};
          
          return { type: 'generic' as 'generic', message: `Lỗi tải ${name}: ${rpcError.message}` };
        }
        const rawValue = res.status === 'fulfilled' ? res.value.data : 0;
        return typeof rawValue === 'string' ? parseFloat(rawValue.replace(/,/g, '')) : (typeof rawValue === 'number' ? rawValue : 0);
      };

      const ftSalResult = processResult(ftSalaryRes, 'Lương Fulltime', 'get_total_salary_fulltime', 'Fulltime', 'tong_thu_nhap');
      if (typeof ftSalResult === 'object') currentError = ftSalResult; else ftSal = ftSalResult;
      setFulltimeSalary(ftSal);

      const ptSalResult = processResult(ptSalaryRes, 'Lương Part-time', 'get_total_salary_parttime', 'Parttime', '"Tong tien"'); 
      if (typeof ptSalResult === 'object' && !currentError) currentError = ptSalResult; else ptSal = ptSalResult;
      setParttimeSalary(ptSal);
      
      const revResult = processResult(revenueRes, 'Doanh Thu', 'get_total_revenue', 'Doanh_thu', '"Kỳ báo cáo"');
      if (typeof revResult === 'object' && !currentError) currentError = revResult; else rev = revResult;
      setTotalRevenue(rev);

      if (currentError) {
        setError(currentError);
        return;
      }

      if (rev === 0 || rev === null) {
        if (ftSal > 0 || ptSal > 0) {
          setError({ type: 'dataIssue', message: 'Không thể tính tỷ lệ do tổng doanh thu bằng 0.' });
        } else {
          setRatio(0); // Both salary and revenue are 0
        }
      } else {
        setRatio((ftSal + ptSal) / rev);
      }

    } catch (err: any) {
      console.error("Error fetching data for ratio card:", err);
      setError({ type: 'generic', message: 'Lỗi không xác định khi tải dữ liệu tỷ lệ.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear, selectedDepartments]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  let displayValue: string;
  let cardState: "default" | "error" | "warning" | "noData" = "default";

  if (isLoading) {
    displayValue = "Đang tải...";
  } else if (error) {
    displayValue = "Lỗi";
    cardState = "error";
  } else if (ratio === null) {
     if (totalRevenue === 0 && ( (fulltimeSalary ?? 0) > 0 || (parttimeSalary ?? 0) > 0) ) {
        displayValue = "N/A"; 
        cardState = "warning";
     } else if (totalRevenue === 0 && (fulltimeSalary ?? 0) === 0 && (parttimeSalary ?? 0) === 0) {
        displayValue = "0.0%"; 
     }
     else {
        displayValue = "Không có dữ liệu";
        cardState = "noData";
     }
  } else if (totalRevenue === 0 && ratio === 0 && (fulltimeSalary ?? 0) === 0 && (parttimeSalary ?? 0) === 0) {
    displayValue = "0.0%"; 
  } else if (totalRevenue === 0) {
    displayValue = "N/A"; // Should be caught by error.type === 'dataIssue'
    cardState = "warning";
  }
  else {
    displayValue = new Intl.NumberFormat('vi-VN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(ratio);
  }

  return (
    <Card className={`h-full ${cardState === 'error' ? 'border-destructive/50' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className={`text-sm font-semibold ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          Tỷ Lệ QL / DT
        </CardTitle>
        <Percent className={`h-4 w-4 ${cardState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent className="pt-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <>
            <div className="text-xl font-bold text-destructive flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" /> Lỗi
            </div>
            <p className="text-xs text-destructive mt-0.5">{error.message}</p>
            {(error.type === 'rpcMissing' || error.message.includes('Bảng') || error.message.includes('Cột')) && (
                 <p className="text-xs text-muted-foreground mt-1">
                   Hãy đảm bảo các hàm RPC và các bảng/cột liên quan đã tồn tại và được cấu hình đúng theo README.md.
                 </p>
            )}
            {error.type === 'dataIssue' && (
                 <p className="text-xs text-muted-foreground mt-1">
                    Tổng doanh thu bằng không, không thể thực hiện phép chia.
                 </p>
            )}
          </>
        ) : (
          <>
            <div className={`text-xl font-bold ${cardState === 'warning' || cardState === 'noData' ? 'text-muted-foreground' : 'text-primary'}`}>
              {displayValue}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              Cho: {filterDescription}
            </p>
             {(cardState === 'warning' && totalRevenue === 0 && ((fulltimeSalary ?? 0) > 0 || (parttimeSalary ?? 0) > 0)) && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Doanh thu bằng 0.</p>
            )}
            {(cardState === 'noData' || (ratio === 0 && totalRevenue === 0 && (fulltimeSalary ?? 0) === 0 && (parttimeSalary ?? 0) === 0)) && (
                 <p className="text-xs text-muted-foreground mt-0.5">Không có dữ liệu lương hoặc doanh thu cho kỳ đã chọn.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

