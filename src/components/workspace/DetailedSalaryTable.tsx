
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, ListChecks, ChevronLeft, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DetailedSalaryData {
  ma_nv: string;
  ho_ten: string;
  tong_cong: number | null;
  tien_linh: number | null;
}

interface DetailedSalaryTableProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

const ROWS_PER_PAGE = 15;

export default function DetailedSalaryTable({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: DetailedSalaryTableProps) {
  const [data, setData] = useState<DetailedSalaryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * ROWS_PER_PAGE;
      const rpcArgs = {
        p_filter_year: selectedYear,
        p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
        p_limit: ROWS_PER_PAGE,
        p_offset: offset,
      };

      const functionName = 'get_detailed_employee_salary_data';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        let detailedErrorMessage = rpcError.message || `Không thể tải dữ liệu chi tiết lương qua RPC '${functionName}'.`;
        if (rpcError.code === '42883' || (rpcError.message && rpcError.message.toLowerCase().includes("does not exist") && rpcError.message.toLowerCase().includes(functionName))) {
          detailedErrorMessage = `Hàm RPC '${functionName}' không tìm thấy hoặc có lỗi. Vui lòng kiểm tra định nghĩa hàm trong Supabase theo README.md.`;
        } else if (rpcError.message && rpcError.message.toLowerCase().includes('relation "ms_cbnv" does not exist')) {
          detailedErrorMessage = `Bảng 'MS_CBNV' không tồn tại. Hàm RPC '${functionName}' cần bảng này để lấy thông tin nhân viên.`;
        } else if (rpcError.message && rpcError.message.toLowerCase().includes('column "tien_linh" does not exist')) {
          detailedErrorMessage = `Cột 'tien_linh' không tồn tại trong bảng 'Fulltime'. Hàm RPC '${functionName}' cần cột này.`;
        }
        throw new Error(detailedErrorMessage);
      }

      if (rpcData && rpcData.length > 0) {
        setData(rpcData.map((item: any) => ({
          ma_nv: String(item.ma_nv),
          ho_ten: String(item.ho_ten),
          tong_cong: item.tong_cong !== null ? Number(item.tong_cong) : null,
          tien_linh: item.tien_linh !== null ? Number(item.tien_linh) : null,
        })));
        setTotalRecords(Number(rpcData[0].total_records) || 0);
      } else {
        setData([]);
        setTotalRecords(0);
      }

    } catch (e: any) {
      console.error(`Error fetching detailed salary data (raw):`, e, "Stringified:", JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      let errorMessage = 'Không thể tải dữ liệu chi tiết lương.';
      if (e && typeof e === 'object') {
          if (e.message) {
              errorMessage = e.message;
          } else if ((e as any).details) { 
              errorMessage = `Lỗi chi tiết: ${(e as any).details}`;
          } else if ((e as any).code) { 
              errorMessage = `Lỗi RPC với mã: ${(e as any).code}`;
          }
      } else if (typeof e === 'string') {
          errorMessage = e;
      }
      setError(errorMessage);
      toast({
        title: "Lỗi Tải Dữ Liệu Lương Chi Tiết",
        description: errorMessage,
        variant: "destructive",
      });
      setData([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, currentPage, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc]);


  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
  };

  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);
  const canGoNext = currentPage < totalPages;
  const canGoPrevious = currentPage > 1;

  return (
    <Card className="flex-grow flex flex-col h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-md font-semibold flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-primary inline-block" />
          Bảng Lương Chi Tiết Nhân Viên
        </CardTitle>
        <CardDescription className="text-xs">
          Dữ liệu lương và tổng công của từng nhân viên full-time theo bộ lọc.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
        {isLoading && (
          <div className="flex items-center justify-center py-4 text-muted-foreground flex-grow">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <p className="text-sm">Đang tải dữ liệu lương chi tiết...</p>
          </div>
        )}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-4 text-destructive bg-destructive/10 p-3 rounded-md flex-grow">
            <AlertTriangle className="h-6 w-6 mb-1" />
            <p className="font-semibold text-sm">Lỗi Tải Dữ Liệu</p>
            <p className="text-xs text-center">{error}</p>
            {error.includes("Hàm RPC") && (
                <p className="text-xs mt-1 text-center">
                    Vui lòng kiểm tra định nghĩa hàm RPC `get_detailed_employee_salary_data` trong Supabase (README.md) và đảm bảo các bảng `Fulltime`, `MS_CBNV` tồn tại với các cột cần thiết (`tien_linh` trong `Fulltime`).
                </p>
            )}
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <p className="text-muted-foreground text-center py-4 text-sm flex-grow">Không có dữ liệu lương chi tiết cho bộ lọc hiện tại.</p>
        )}
        {!isLoading && !error && data.length > 0 && (
          <ScrollArea className="flex-grow border rounded-md">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-xs py-1.5 px-2">Mã NV</TableHead>
                  <TableHead className="text-xs py-1.5 px-2">Họ và Tên</TableHead>
                  <TableHead className="text-xs py-1.5 px-2 text-right">Tổng Công</TableHead>
                  <TableHead className="text-xs py-1.5 px-2 text-right">Tiền Lĩnh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.ma_nv}>
                    <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ma_nv}</TableCell>
                    <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_ten}</TableCell>
                    <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatNumber(row.tong_cong)}</TableCell>
                    <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        {!isLoading && totalRecords > 0 && (
          <div className="flex items-center justify-end space-x-1 py-2 mt-auto shrink-0">
            <span className="text-xs text-muted-foreground mr-2">
              Hàng {Math.min((currentPage - 1) * ROWS_PER_PAGE + 1, totalRecords)} - {Math.min(currentPage * ROWS_PER_PAGE, totalRecords)} của {totalRecords}
            </span>
            <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={!canGoPrevious || isLoading}
                className="text-xs py-1 h-auto px-2"
            >
                <ChevronLeft className="h-3 w-3 mr-0.5"/>
                Trước
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!canGoNext || isLoading}
                className="text-xs py-1 h-auto px-2"
            >
                Sau
                <ChevronRight className="h-3 w-3 ml-0.5"/>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
