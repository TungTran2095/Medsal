
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Users, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface EmployeeCountCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  // Added for future consistency, RPC needs to be updated to use these
  selectedDepartmentsForDiadiem?: string[]; 
  selectedNganhDoc?: string[];
}

export default function EmployeeCountCard({ selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedNganhDoc }: EmployeeCountCardProps) {
  const [employeeCount, setEmployeeCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ");

  const fetchEmployeeCount = useCallback(async () => {
    setIsLoading(true);
    setError(null);

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
      const rpcArgs: { 
        filter_year?: number; 
        filter_months?: number[] | null;
        filter_locations?: string[] | null; // For future SQL update
        filter_nganh_docs?: string[] | null; // For future SQL update
      } = {};
       if (selectedYear !== null) {
        rpcArgs.filter_year = selectedYear;
      }
      rpcArgs.filter_months = (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null;
      // Pass these to RPC if/when it supports them
      rpcArgs.filter_locations = (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null;
      rpcArgs.filter_nganh_docs = (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null;


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

        let detailedErrorMessage = rpcError.message || 'Không thể tải số lượng nhân viên qua RPC.';
        if (isFunctionMissingError) {
          detailedErrorMessage = `Hàm RPC '${functionName}' không tìm thấy hoặc chưa hỗ trợ các bộ lọc (locations, nganh_docs). Vui lòng tạo/cập nhật nó trong SQL Editor của Supabase. Xem hướng dẫn trong README.md.`;
        } else if ( (rpcMessageText.includes('filter_locations') || rpcMessageText.includes('filter_nganh_docs')) && rpcMessageText.includes('does not exist') ) {
           detailedErrorMessage = `Hàm RPC '${functionName}' chưa hỗ trợ lọc theo 'filter_locations' hoặc 'filter_nganh_docs'. Vui lòng cập nhật hàm SQL.`;
        }
        throw new Error(detailedErrorMessage);
      }

      setEmployeeCount(data as number ?? 0);

    } catch (err: any) {
      let uiErrorMessage = err.message || 'Không thể tải số lượng nhân viên qua RPC.';
      setError(uiErrorMessage);
      console.error("Error fetching employee count via RPC. Details:", err);
      setEmployeeCount(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedNganhDoc]);

  useEffect(() => {
    fetchEmployeeCount();
  }, [fetchEmployeeCount]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số NV (Full-time)</CardTitle>
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
          <CardTitle className="text-sm font-semibold text-destructive">Lỗi Số Lượng NV</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
           {(error.includes("Hàm RPC") && (error.includes("không tìm thấy") || error.includes("chưa hỗ trợ"))) && (
             <p className="text-xs text-muted-foreground mt-1">
               Vui lòng đảm bảo hàm RPC `get_employee_count_fulltime` đã được tạo/cập nhật trong Supabase theo README.md để hỗ trợ các bộ lọc cần thiết.
             </p>
           )}
        </CardContent>
      </Card>
    );
  }
  
  if (employeeCount === null || employeeCount === 0) {
     return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
           <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số NV (Full-time)</CardTitle>
           <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
           <div className="text-xl font-bold text-muted-foreground">
            0
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate" title={filterDescription}>
            Không có nhân viên nào cho: {filterDescription}.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số NV (Full-time)</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-xl font-bold text-primary">
          {employeeCount !== null ? employeeCount.toLocaleString('vi-VN') : 'N/A'}
        </div>
        <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
          Cho: {filterDescription}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

