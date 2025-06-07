
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Button is not used directly for pagination anymore, but might be for future actions
// import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, ListChecks, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DetailedSalaryData {
  ma_nv: string;
  ho_ten: string;
  tong_cong: number | null;
  tien_linh: number | null;
  tien_linh_per_cong: number | null;
  total_records?: bigint; // Total records matching filter, before client-side sorting/display
  overall_sum_tien_linh?: number | null; 
  overall_sum_tong_cong?: number | null; 
}

interface DetailedSalaryTableProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

type SortableColumn = 'ma_nv' | 'ho_ten' | 'tong_cong' | 'tien_linh' | 'tien_linh_per_cong';
interface SortConfig {
  key: SortableColumn | null;
  direction: 'ascending' | 'descending';
}

export default function DetailedSalaryTable({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: DetailedSalaryTableProps) {
  const [data, setData] = useState<DetailedSalaryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ma_nv', direction: 'ascending' });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rpcArgs = {
        p_filter_year: selectedYear,
        p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
        p_limit: null, // Fetch all records
        p_offset: 0,
      };

      const functionName = 'get_detailed_employee_salary_data';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        let detailedErrorMessage = rpcError.message || `Không thể tải dữ liệu chi tiết lương qua RPC '${functionName}'.`;
        if (rpcError.code === '42883' || (rpcError.message && rpcError.message.toLowerCase().includes("does not exist") && rpcError.message.toLowerCase().includes(functionName))) {
          detailedErrorMessage = `Hàm RPC '${functionName}' không tìm thấy hoặc có lỗi. Vui lòng kiểm tra định nghĩa hàm trong Supabase theo README.md. Đảm bảo bảng Fulltime có các cột 'ma_nhan_vien', 'ho_va_ten', và 'tien_linh'.`;
        } else if (rpcError.message && (rpcError.message.toLowerCase().includes('column "ma_nhan_vien" does not exist') || rpcError.message.toLowerCase().includes('column "ho_va_ten" does not exist') || rpcError.message.toLowerCase().includes('column "tien_linh" does not exist'))) {
          detailedErrorMessage = `Một hoặc nhiều cột (ma_nhan_vien, ho_va_ten, tien_linh) không tồn tại trong bảng 'Fulltime'. Hàm RPC '${functionName}' cần các cột này.`;
        }
        throw new Error(detailedErrorMessage);
      }

      if (rpcData && rpcData.length > 0) {
        setData(rpcData.map((item: any) => ({
          ma_nv: String(item.ma_nv),
          ho_ten: String(item.ho_ten),
          tong_cong: item.tong_cong !== null ? Number(item.tong_cong) : null,
          tien_linh: item.tien_linh !== null ? Number(item.tien_linh) : null,
          tien_linh_per_cong: item.tien_linh_per_cong !== null ? Number(item.tien_linh_per_cong) : null,
        })));
        setTotalRecords(Number(rpcData[0].total_records) || 0);
      } else {
        setData([]);
        setTotalRecords(0);
      }

    } catch (e: any) {
      console.error(`Error fetching detailed salary data:`, JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
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
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const requestSort = (key: SortableColumn) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1; 
        if (valB === null) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'ascending'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
  };

  const SortableHeader = ({ columnKey, label, align = 'left' }: { columnKey: SortableColumn, label: string, align?: 'left' | 'right' | 'center' }) => (
    <TableHead
      className={cn("text-xs py-1.5 px-2 cursor-pointer hover:bg-muted/50", `text-${align}`)}
      onClick={() => requestSort(columnKey)}
    >
      <div className={cn("flex items-center gap-1", align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start')}>
        <span>{label}</span>
        {sortConfig.key === columnKey ? (
          sortConfig.direction === 'ascending' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );


  return (
    <Card className="flex-grow flex flex-col h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-md font-semibold flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-primary inline-block" />
          Bảng Lương Chi Tiết Nhân Viên
        </CardTitle>
        <CardDescription className="text-xs">
          Dữ liệu lương và tổng công của từng nhân viên full-time theo bộ lọc ({totalRecords} dòng).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
        <div className="flex-grow min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <p className="text-sm">Đang tải dữ liệu lương chi tiết...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-6 w-6 mb-1" />
              <p className="font-semibold text-sm">Lỗi Tải Dữ Liệu</p>
              <p className="text-xs text-center whitespace-pre-line">{error}</p>
              {(error.includes("Hàm RPC") || error.includes("Cột")) && (
                  <p className="text-xs mt-1 text-center">
                      Vui lòng kiểm tra định nghĩa hàm RPC `get_detailed_employee_salary_data` trong Supabase (README.md) và đảm bảo bảng `Fulltime` tồn tại với các cột `ma_nhan_vien`, `ho_va_ten`, `tien_linh` và các cột công cần thiết.
                  </p>
              )}
            </div>
          )}
          {!isLoading && !error && data.length === 0 && (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-center py-4 text-sm">Không có dữ liệu lương chi tiết cho bộ lọc hiện tại.</p>
            </div>
          )}
          {!isLoading && !error && data.length > 0 && (
            <ScrollArea className="h-full border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <SortableHeader columnKey="ma_nv" label="Mã NV" />
                    <SortableHeader columnKey="ho_ten" label="Họ và Tên" />
                    <SortableHeader columnKey="tong_cong" label="Tổng Công" align="right" />
                    <SortableHeader columnKey="tien_linh" label="Tiền Lĩnh" align="right" />
                    <SortableHeader columnKey="tien_linh_per_cong" label="Tiền lĩnh/công" align="right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((row) => (
                    <TableRow key={row.ma_nv}>
                      <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ma_nv}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_ten}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatNumber(row.tong_cong)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh_per_cong)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
