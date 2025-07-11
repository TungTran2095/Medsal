"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Users } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface BackOfficeRatioData {
  back_office_count: number;
  total_count: number;
  back_office_ratio: number;
}

interface BackOfficeEmployeeRatioCardProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

export default function BackOfficeEmployeeRatioCard({ 
  selectedYear, 
  selectedMonths, 
  selectedDepartmentsForDiadiem, 
  selectedNganhDoc, 
  selectedDonVi2 
}: BackOfficeEmployeeRatioCardProps) {
  const [ratioData, setRatioData] = useState<BackOfficeRatioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tháng mới nhất");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    setFilterDescription("tháng mới nhất");

    try {
      const functionName = 'get_back_office_employee_ratio_latest_month';
      const { data, error: rpcError } = await supabase.rpc(functionName);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        if (isFunctionMissingError) {
          throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Hàm RPC '${functionName}' bị thiếu. Vui lòng tạo theo README.md.`
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'Đã xảy ra lỗi RPC không xác định.'};
      }

      if (!data || data.length === 0) {
        setRatioData(null);
        return;
      }

      const typedData = data[0] as BackOfficeRatioData;
      setRatioData({
        back_office_count: Number(typedData.back_office_count) || 0,
        total_count: Number(typedData.total_count) || 0,
        back_office_ratio: Number(typedData.back_office_ratio) || 0,
      });

    } catch (err: any) {
      if (err.type === 'rpcMissing') {
        setError(err);
      } else {
        setError({ type: 'generic', message: err.message || 'Không thể tải dữ liệu tỷ lệ nhân viên khối back.' });
      }
      console.error("Error fetching back office employee ratio:", err);
      setRatioData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tỷ lệ nhân viên khối back</CardTitle>
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
          <CardTitle className="text-destructive text-sm font-semibold flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Dữ Liệu Tỷ Lệ
          </CardTitle>
          <Users className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error.message}</p>
          {error.type === 'rpcMissing' && (
            <p className="text-xs text-muted-foreground mt-1">
              Vui lòng tạo hàm `get_back_office_employee_ratio_latest_month` trong SQL Editor của Supabase. Tham khảo README.md.
            </p>
          )}
          {error.type === 'generic' && (
            <p className="text-xs text-muted-foreground mt-1">
              Kiểm tra cấu trúc bảng 'Fulltime' và 'ms_org_nganhdoc'.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (!ratioData || ratioData.total_count === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tỷ lệ nhân viên khối back</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-xl font-bold text-muted-foreground">
            0%
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate" title={filterDescription}>
            Không có dữ liệu cho: {filterDescription}.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tỷ lệ nhân viên khối back</CardTitle>
        <Users className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-xl font-bold text-primary">
          {ratioData.back_office_ratio.toFixed(1)}%
        </div>
        <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
          {ratioData.back_office_count.toLocaleString()} / {ratioData.total_count.toLocaleString()} nhân viên khối back / tổng số
        </CardDescription>
      </CardContent>
    </Card>
  );
} 