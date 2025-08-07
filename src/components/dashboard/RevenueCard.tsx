
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription, 
} from "@/components/ui/card";

interface RevenueCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartments?: string[]; // Added
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function RevenueCard({ selectedMonths, selectedYear, selectedDepartments }: RevenueCardProps) {
  const [totalRevenue, setTotalRevenue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchTotalRevenue = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Debug: Log authentication status
    const { data: { session } } = await supabase.auth.getSession();
    console.log('RevenueCard - Auth session:', session ? 'Authenticated' : 'Not authenticated');
    console.log('RevenueCard - User:', session?.user?.email);

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


    try {
      const rpcArgs: { filter_year?: number; filter_months?: number[] | null; filter_locations?: string[] | null } = {}; // Added filter_locations
      if (selectedYear !== null) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonths && selectedMonths.length > 0) {
        rpcArgs.filter_months = selectedMonths;
      } else {
        rpcArgs.filter_months = null;
      }
      if (departmentNames.length > 0) {
        rpcArgs.filter_locations = departmentNames;
      } else {
        rpcArgs.filter_locations = null;
      }

      console.log('RevenueCard - RPC args:', rpcArgs);

      // Test: Try to access basic data first
      console.log('RevenueCard - Testing basic data access...');
      const { data: testData, error: testError } = await supabase
        .from('Doanh_thu')
        .select('*')
        .limit(1);
      console.log('RevenueCard - Test data access:', { testData, testError });

      const functionName = 'get_total_revenue';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      console.log('RevenueCard - RPC response:', { data, error: rpcError });

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
          rpcError.code === '42883' || 
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        const isTableMissingError = rpcMessageText.includes('relation "doanh_thu" does not exist');
        const isColumnMissingError = rpcMessageText.includes('column "kỳ báo cáo" does not exist') || rpcMessageText.includes('column "tên đơn vị" does not exist');

        if (isFunctionMissingError) {
          throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Hàm RPC '${functionName}' bị thiếu. Vui lòng tạo hoặc cập nhật nó trong SQL Editor của Supabase theo README.md.`
          };
        }
        if (isTableMissingError) {
           throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Bảng 'Doanh_thu' không tồn tại. Hàm RPC '${functionName}' cần bảng này.`
          };
        }
         if (isColumnMissingError) {
           throw {
            type: 'rpcMissing' as 'rpcMissing', 
            message: `Một trong các cột 'Kỳ báo cáo' hoặc 'Tên đơn vị' không tồn tại trong bảng 'Doanh_thu'. Hàm RPC '${functionName}' cần các cột này.`
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'Đã xảy ra lỗi RPC không xác định.'};
      }

      const rawTotal = data;
      const numericTotal = typeof rawTotal === 'string'
        ? parseFloat(rawTotal.replace(/,/g, ''))
        : (typeof rawTotal === 'number' ? rawTotal : 0);

      console.log('RevenueCard - Processed data:', { rawTotal, numericTotal });

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
  }, [selectedMonths, selectedYear, selectedDepartments]);

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
               Vui lòng tạo/cập nhật hàm `get_total_revenue` trong SQL Editor của Supabase. Tham khảo README.md.
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Kiểm tra cấu trúc bảng 'Doanh_thu' và các tham số của hàm RPC.
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
           <div className="text-xl font-bold text-muted-foreground">
            0 VND
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate">
            Không có dữ liệu cho: {filterDescription}.
          </CardDescription>
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
         <div className="text-xl font-bold text-primary">
            {formattedTotalRevenue}
          </div>
          <CardDescription className="text-xs text-muted-foreground truncate">
            Cho: {filterDescription}
          </CardDescription>
      </CardContent>
    </Card>
  );
}

