
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface EmployeeCountCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
}

export default function EmployeeCountCard({ selectedMonths, selectedYear }: EmployeeCountCardProps) {
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ");

  const fetchEmployeeCount = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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

    if (selectedYear) {
      finalFilterDescription = `${monthSegment} của ${yearSegment}`;
    } else {
      if (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) {
        finalFilterDescription = `${monthSegment} (trong mọi năm)`;
      } else {
        finalFilterDescription = "tất cả các kỳ";
      }
    }
    setFilterDescription(finalFilterDescription);


    try {
      const rpcArgs: { filter_year?: number; filter_months?: number[] } = {};
       if (selectedYear !== null) {
        rpcArgs.filter_year = selectedYear;
      }
      if (selectedMonths && selectedMonths.length > 0) {
        rpcArgs.filter_months = selectedMonths;
      } else {
        rpcArgs.filter_months = undefined; 
      }


      const functionName = 'get_employee_count_fulltime';
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
          throw new Error(`Hàm RPC '${functionName}' không tìm thấy. Vui lòng tạo nó trong SQL Editor của Supabase. Xem hướng dẫn trong README.md.`);
        }
        throw rpcError;
      }

      setEmployeeCount(data as number ?? 0);

    } catch (err: any) {
      let uiErrorMessage = err.message || 'Không thể tải số lượng nhân viên qua RPC.';
      setError(uiErrorMessage);
      console.error("Error fetching employee count via RPC. Details:", {
          message: err.message,
          name: err.name,
          code: err.code,
          stack: err.stack,
          originalErrorObject: err
      });
      setEmployeeCount(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear]);

  useEffect(() => {
    fetchEmployeeCount();
  }, [fetchEmployeeCount]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số Nhân Viên</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle className="text-sm font-semibold text-destructive">Lỗi Số Lượng Nhân Viên</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
           {error.includes("Hàm RPC") && error.includes("không tìm thấy") && (
             <p className="text-xs text-muted-foreground mt-1">
               Vui lòng đảm bảo hàm RPC `get_employee_count_fulltime` đã được tạo trong Supabase theo README.md.
             </p>
           )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số Nhân Viên</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-2xl font-bold text-primary">
          {employeeCount !== null ? employeeCount.toLocaleString('vi-VN') : 'N/A'}
        </div>
        <p className="text-xs text-muted-foreground">
          Cho: {filterDescription}
        </p>
      </CardContent>
    </Card>
  );
}
