
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react'; // Using TrendingUp for Revenue
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface RevenueCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function RevenueCard({ selectedMonths, selectedYear }: RevenueCardProps) {
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ");

  const fetchTotalRevenue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description;
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
      const rpcArgs: { filter_year?: number; filter_months?: number[] | null } = {};
      if (selectedYear !== null) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonths && selectedMonths.length > 0) {
        rpcArgs.filter_months = selectedMonths;
      } else {
        rpcArgs.filter_months = null;
      }

      const functionName = 'get_total_revenue';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
          rpcError.code === '42883' || // undefined_function
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        const isTableMissingError = rpcMessageText.includes('relation "doanh_thu" does not exist');
        const isColumnMissingError = rpcMessageText.includes('column "kỳ báo cáo" does not exist') || rpcMessageText.includes('column "tên đơn vị" does not exist');


        if (isFunctionMissingError) {
          throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Hàm RPC '${functionName}' bị thiếu. Vui lòng tạo nó trong SQL Editor của Supabase theo script trong README.md.`
          };
        }
        if (isTableMissingError) {
           throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Bảng 'Doanh_thu' không tồn tại trong cơ sở dữ liệu. Hàm RPC '${functionName}' cần bảng này.`
          };
        }
         if (isColumnMissingError) {
           throw {
            type: 'rpcMissing' as 'rpcMissing', // Re-using type for simplicity
            message: `Một trong các cột 'Kỳ báo cáo' hoặc 'Tên đơn vị' không tồn tại trong bảng 'Doanh_thu'. Hàm RPC '${functionName}' cần các cột này.`
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'Đã xảy ra lỗi RPC không xác định.'};
      }

      const rawTotal = data;
      const numericTotal = typeof rawTotal === 'string'
        ? parseFloat(rawTotal.replace(/,/g, ''))
        : (typeof rawTotal === 'number' ? rawTotal : 0);

      setTotalRevenue(numericTotal || 0);

    } catch (err: any) {
      if (err.type === 'rpcMissing') {
        setError(err);
      } else {
        setError({ type: 'generic', message: err.message || 'Không thể tải dữ liệu doanh thu qua RPC.' });
      }
      console.error("Error fetching total revenue via RPC. Details:", err);
      setTotalRevenue(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear]);

  useEffect(() => {
    fetchTotalRevenue();
  }, [fetchTotalRevenue]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Doanh Thu</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
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
            Lỗi Dữ Liệu Doanh Thu
          </CardTitle>
           <TrendingUp className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              {error.message.includes("Bảng 'Doanh_thu' không tồn tại") 
                ? "Vui lòng đảm bảo bảng 'Doanh_thu' tồn tại trong cơ sở dữ liệu của bạn."
                : error.message.includes("Cột") && error.message.includes("không tồn tại")
                ? `Vui lòng đảm bảo các cột cần thiết (ví dụ: 'Kỳ báo cáo', 'Tên đơn vị') tồn tại trong bảng 'Doanh_thu'.`
                : "Vui lòng tạo hàm `get_total_revenue` trong SQL Editor của Supabase. Tham khảo README.md để biết script SQL. Đảm bảo bảng 'Doanh_thu' có cột 'Kỳ báo cáo', 'Tên đơn vị', 'nam', và 'thang'."
              }
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Kiểm tra cấu trúc bảng 'Doanh_thu': cột 'Kỳ báo cáo' (số hoặc văn bản có thể chuyển thành double precision), 'Tên đơn vị' (văn bản), 'thang' (văn bản như 'Tháng 01'), và 'nam' (số).
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (totalRevenue === null || totalRevenue === 0) {
     return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
           <CardTitle className="text-sm font-semibold text-muted-foreground">Doanh Thu</CardTitle>
           <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
           <div className="text-2xl font-bold text-muted-foreground">
            0 VND
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Không có dữ liệu doanh thu cho: {filterDescription}.
          </p>
           <p className="text-xs text-muted-foreground mt-0.5">
            (Lưu ý: Một số 'Tên đơn vị' như Medcom, Medon,... bị loại trừ.)
          </p>
        </CardContent>
      </Card>
    );
  }

  const formattedTotalRevenue = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalRevenue);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Doanh Thu</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
         <div className="text-2xl font-bold text-primary">
            {formattedTotalRevenue}
          </div>
          <p className="text-xs text-muted-foreground">
            Cho: {filterDescription}
          </p>
           <p className="text-xs text-muted-foreground mt-0.5">
            (Lưu ý: Một số 'Tên đơn vị' như Medcom, Medon,... bị loại trừ.)
          </p>
      </CardContent>
    </Card>
  );
}

