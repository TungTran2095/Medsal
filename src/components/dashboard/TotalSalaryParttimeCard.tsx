
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, DollarSign } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface TotalSalaryParttimeCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartmentsForDiadiem?: string[]; 
  selectedDonVi2?: string[]; // New prop for Don_vi_2 filter
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function TotalSalaryParttimeCard({ selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedDonVi2 }: TotalSalaryParttimeCardProps) {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchTotalSalaryParttime = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Debug: Log authentication status
    const { data: { session } } = await supabase.auth.getSession();
    console.log('TotalSalaryParttimeCard - Auth session:', session ? 'Authenticated' : 'Not authenticated');
    console.log('TotalSalaryParttimeCard - User:', session?.user?.email);

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
    if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
      locationSegment = selectedDepartmentsForDiadiem.length <= 2 ? selectedDepartmentsForDiadiem.join(' & ') : `${selectedDepartmentsForDiadiem.length} địa điểm (theo Loại/Pban)`;
    }
    
    let donVi2Segment = "";
    if (selectedDonVi2 && selectedDonVi2.length > 0) {
      donVi2Segment = selectedDonVi2.length <=2 ? selectedDonVi2.join(' & ') : `${selectedDonVi2.length} đơn vị 2`;
      if (locationSegment !== "tất cả địa điểm") locationSegment += " và " + donVi2Segment;
      else locationSegment = donVi2Segment;
    }
    
    setFilterDescription(`${monthSegment} của ${yearSegment} tại ${locationSegment}`);

    try {
      const rpcArgs: { filter_year?: number; filter_months?: number[] | null; filter_locations?: string[] | null; filter_donvi2?: string[] | null } = {};
      if (selectedYear !== null) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonths && selectedMonths.length > 0) {
        rpcArgs.filter_months = selectedMonths;
      } else {
        rpcArgs.filter_months = null;
      }
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        rpcArgs.filter_locations = selectedDepartmentsForDiadiem;
      } else {
        rpcArgs.filter_locations = null;
      }
      if (selectedDonVi2 && selectedDonVi2.length > 0) {
        rpcArgs.filter_donvi2 = selectedDonVi2;
      } else {
        rpcArgs.filter_donvi2 = null;
      }

      console.log('TotalSalaryParttimeCard - RPC args:', rpcArgs);

      // Test: Try to access basic data first
      console.log('TotalSalaryParttimeCard - Testing basic data access...');
      const { data: testData, error: testError } = await supabase
        .from('Parttime')
        .select('*')
        .limit(1);
      console.log('TotalSalaryParttimeCard - Test data access:', { testData, testError });

      const functionName = 'get_total_salary_parttime';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      console.log('TotalSalaryParttimeCard - RPC response:', { data, error: rpcError });

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        const isTableMissingError = rpcMessageText.includes('relation "parttime" does not exist');

        if (isFunctionMissingError) {
          throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Hàm RPC '${functionName}' bị thiếu hoặc chưa hỗ trợ 'filter_donvi2'. Vui lòng tạo/cập nhật theo README.md.`
          };
        }
        if (rpcMessageText.includes("filter_donvi2") && rpcMessageText.includes("does not exist")){
             throw {
                type: 'rpcMissing' as 'rpcMissing',
                message: `Tham số 'filter_donvi2' không tồn tại trong hàm RPC '${functionName}'. Vui lòng cập nhật hàm RPC.`
             };
        }
        if (isTableMissingError) {
           throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Bảng 'Parttime' không tồn tại. Hàm RPC '${functionName}' cần bảng này.`
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'Đã xảy ra lỗi RPC không xác định.'};
      }

      const rawTotal = data;
      const numericTotal = typeof rawTotal === 'string'
        ? parseFloat(rawTotal.replace(/,/g, ''))
        : (typeof rawTotal === 'number' ? rawTotal : 0);

      console.log('TotalSalaryParttimeCard - Processed data:', { rawTotal, numericTotal });

      setTotalSalary(numericTotal || 0);

    } catch (err: any) {
      if (err.type === 'rpcMissing') {
        setError(err);
      } else {
        setError({ type: 'generic', message: err.message || 'Không thể tải dữ liệu tổng lương Part-time qua RPC.' });
      }
      console.error("Error fetching total part-time salary via RPC. Details:", err);
      setTotalSalary(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedDonVi2]);

  useEffect(() => {
    fetchTotalSalaryParttime();
  }, [fetchTotalSalaryParttime]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Part-time</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
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
            Lỗi Dữ Liệu Lương Part-time
          </CardTitle>
           <DollarSign className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Vui lòng tạo/cập nhật hàm `get_total_salary_parttime` trong SQL Editor của Supabase để hỗ trợ các tham số lọc mới. Tham khảo README.md.
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Kiểm tra cấu trúc bảng 'Parttime' và các tham số của hàm RPC.
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
           <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Part-time</CardTitle>
           <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
           <div className="text-xl font-bold text-muted-foreground">
            0 VND
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate" title={filterDescription}>
            Không có dữ liệu cho: {filterDescription}.
          </CardDescription>
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
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Part-time</CardTitle>
        <DollarSign className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
         <div className="text-xl font-bold text-primary">
            {formattedTotalSalary}
          </div>
          <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
            Cho: {filterDescription}
          </CardDescription>
      </CardContent>
    </Card>
  );
}
