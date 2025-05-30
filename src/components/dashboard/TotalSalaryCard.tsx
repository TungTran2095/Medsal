
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Banknote } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TotalSalaryCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function TotalSalaryCard({ selectedMonths, selectedYear }: TotalSalaryCardProps) {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ");

  const fetchTotalSalary = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let yearDesc = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthDesc = (selectedMonths && selectedMonths.length > 0)
      ? `Tháng ${selectedMonths.join(', ')}`
      : "Tất cả các tháng";

    if (selectedYear && selectedMonths && selectedMonths.length > 0) {
      description = `${monthDesc}, ${yearDesc}`;
    } else if (selectedYear) {
      description = yearDesc;
    } else if (selectedMonths && selectedMonths.length > 0) {
      description = `${monthDesc} (mọi năm)`;
    } else {
      description = "tất cả các kỳ";
    }
    setFilterDescription(description);


    try {
      const rpcArgs: { filter_year?: number; filter_months?: number[] } = {};
      if (selectedYear !== null) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonths && selectedMonths.length > 0) {
        rpcArgs.filter_months = selectedMonths;
      } else {
        rpcArgs.filter_months = undefined; // Explicitly pass undefined for "all months"
      }


      const functionName = 'get_total_salary_fulltime';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';

        const isFunctionMissingError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        if (isFunctionMissingError) {
          throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Hàm RPC '${functionName}' không tìm thấy. Vui lòng tạo nó trong SQL Editor của Supabase. Xem hướng dẫn trong README.md.`
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'Đã xảy ra lỗi RPC không xác định.'};
      }

      const rawTotal = data;
      const numericTotal = typeof rawTotal === 'string'
        ? parseFloat(rawTotal.replace(/,/g, ''))
        : (typeof rawTotal === 'number' ? rawTotal : 0);

      setTotalSalary(numericTotal || 0);

    } catch (err: any) {
      if (err.type === 'rpcMissing') {
        setError(err);
      } else {
        setError({ type: 'generic', message: err.message || 'Không thể tải dữ liệu tổng lương qua RPC.' });
      }

      console.error("Error fetching total salary via RPC. Details:", {
          type: err.type,
          message: err.message,
          name: err.name,
          code: err.code,
          stack: err.stack,
          originalErrorObject: err
      });
      setTotalSalary(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear, supabase]);

  useEffect(() => {
    fetchTotalSalary();
  }, [fetchTotalSalary]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Fulltime</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-center h-10">
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
          <CardTitle className="text-destructive text-sm font-semibold flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Dữ Liệu Lương
          </CardTitle>
           <Banknote className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Vui lòng tạo hàm `get_total_salary_fulltime` trong SQL Editor của Supabase. Tham khảo README.md để biết script SQL. Đảm bảo các cột `thang` (văn bản dạng 'Tháng XX') và `nam` (số) trong bảng `Fulltime` là đúng.
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Kiểm tra cấu trúc bảng 'Fulltime': cột 'tong_thu_nhap' (số hoặc văn bản có thể chuyển thành double precision), 'thang' (văn bản như 'Tháng 01', sẽ được phân tích thành số), và 'nam' (số). Đảm bảo hàm RPC được cập nhật để phân tích 'thang' dạng văn bản và xử lý năm chính xác.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (totalSalary === null || totalSalary === 0) {
     return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
           <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Fulltime</CardTitle>
           <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
           <div className="text-2xl font-bold text-muted-foreground">
            0 VND
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Không có dữ liệu lương cho: {filterDescription}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formattedTotalSalary = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalSalary);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Fulltime</CardTitle>
        <Banknote className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
         <div className="text-2xl font-bold text-primary">
            {formattedTotalSalary}
          </div>
          <p className="text-xs text-muted-foreground">
            Cho: {filterDescription}
          </p>
      </CardContent>
    </Card>
  );
}
