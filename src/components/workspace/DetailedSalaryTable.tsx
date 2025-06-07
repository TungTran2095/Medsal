
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, AlertTriangle, ListChecks, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DetailedSalaryData {
  ma_nv: string;
  ho_ten: string;
  tong_cong_cy: number | null;
  tien_linh_cy: number | null;
  tien_linh_per_cong_cy: number | null;
  tong_cong_py: number | null;
  tien_linh_py: number | null;
  tien_linh_per_cong_py: number | null;
  total_records?: bigint; 
  overall_sum_tien_linh_cy?: number | null; 
  overall_sum_tong_cong_cy?: number | null; 
}

interface DetailedSalaryTableProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

type SortableColumn = 
  | 'ma_nv' 
  | 'ho_ten' 
  | 'tong_cong_cy' 
  | 'tien_linh_cy' 
  | 'tien_linh_per_cong_cy'
  | 'growth_tong_cong'
  | 'growth_tien_linh'
  | 'growth_tien_linh_per_cong';

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
        p_limit: null, 
        p_offset: 0,
      };

      const functionName = 'get_detailed_employee_salary_data';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        let detailedErrorMessage = rpcError.message || `Không thể tải dữ liệu chi tiết lương qua RPC '${functionName}'.`;
        if (rpcError.code === '42883' || (rpcError.message && rpcError.message.toLowerCase().includes("does not exist") && rpcError.message.toLowerCase().includes(functionName))) {
          detailedErrorMessage = `Hàm RPC '${functionName}' không tìm thấy hoặc có lỗi. Vui lòng kiểm tra định nghĩa hàm trong Supabase theo README.md. Đảm bảo bảng Fulltime có các cột cần thiết cho cả năm hiện tại và năm trước.`;
        } else if (rpcError.message && (rpcError.message.toLowerCase().includes("column") && rpcError.message.toLowerCase().includes("does not exist"))) {
            detailedErrorMessage = `Một hoặc nhiều cột cần thiết không tồn tại trong bảng 'Fulltime'. Hàm RPC '${functionName}' cần các cột này.`;
        }
        throw new Error(detailedErrorMessage);
      }

      if (rpcData && rpcData.length > 0) {
        setData(rpcData.map((item: any) => ({
          ma_nv: String(item.ma_nv),
          ho_ten: String(item.ho_ten),
          tong_cong_cy: item.tong_cong_cy !== null ? Number(item.tong_cong_cy) : null,
          tien_linh_cy: item.tien_linh_cy !== null ? Number(item.tien_linh_cy) : null,
          tien_linh_per_cong_cy: item.tien_linh_per_cong_cy !== null ? Number(item.tien_linh_per_cong_cy) : null,
          tong_cong_py: item.tong_cong_py !== null ? Number(item.tong_cong_py) : null,
          tien_linh_py: item.tien_linh_py !== null ? Number(item.tien_linh_py) : null,
          tien_linh_per_cong_py: item.tien_linh_per_cong_py !== null ? Number(item.tien_linh_per_cong_py) : null,
        })));
        // total_records from RPC now refers to CY unique employees
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

  const calculateGrowth = (current: number | null, previous: number | null): number | null => {
    if (current === null || previous === null) return null;
    if (previous === 0) {
      return current > 0 ? Infinity : (current < 0 ? -Infinity : 0);
    }
    return (current - previous) / Math.abs(previous);
  };

  const requestSort = (key: SortableColumn) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const dataWithGrowth = useMemo(() => {
    return data.map(row => ({
      ...row,
      growth_tong_cong: calculateGrowth(row.tong_cong_cy, row.tong_cong_py),
      growth_tien_linh: calculateGrowth(row.tien_linh_cy, row.tien_linh_py),
      growth_tien_linh_per_cong: calculateGrowth(row.tien_linh_per_cong_cy, row.tien_linh_per_cong_py),
    }));
  }, [data]);

  const sortedData = useMemo(() => {
    let sortableItems = [...dataWithGrowth];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1; 
        if (valB === null) return -1;
        
        if (valA === Infinity) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (valB === Infinity) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA === -Infinity) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valB === -Infinity) return sortConfig.direction === 'ascending' ? 1 : -1;

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
  }, [dataWithGrowth, sortConfig]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
  };

  const renderGrowthCell = (growth: number | null) => {
    if (growth === null) return <TableCell className="text-center text-muted-foreground text-xs py-1.5 px-2">N/A</TableCell>;
    
    let colorClass = 'text-muted-foreground';
    let Icon = Minus;
    let displayValue = "";

    if (growth === Infinity) {
        displayValue = "Tăng ∞";
        colorClass = 'text-green-600 dark:text-green-500';
        Icon = TrendingUp;
    } else if (growth === -Infinity) {
        displayValue = "Giảm ∞";
        colorClass = 'text-red-600 dark:text-red-500';
        Icon = TrendingDown;
    } else if (growth > 0) {
        displayValue = `+${(growth * 100).toFixed(1)}%`;
        colorClass = 'text-green-600 dark:text-green-500';
        Icon = TrendingUp;
    } else if (growth < 0) {
        displayValue = `${(growth * 100).toFixed(1)}%`;
        colorClass = 'text-red-600 dark:text-red-500';
        Icon = TrendingDown;
    } else { // growth === 0
        displayValue = "0.0%";
    }
    
    return (
      <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}>
        <div className="flex items-center justify-center gap-0.5">
          <Icon className="h-3 w-3" />
          {displayValue}
        </div>
      </TableCell>
    );
  };

  const SortableHeader = ({ columnKey, label, align = 'left' }: { columnKey: SortableColumn, label: string, align?: 'left' | 'right' | 'center' }) => (
    <TableHead
      className={cn("text-xs py-1.5 px-2 cursor-pointer hover:bg-muted/50 whitespace-nowrap", `text-${align}`)}
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
          Bảng Lương Chi Tiết Nhân Viên (YoY)
        </CardTitle>
        <CardDescription className="text-xs">
          Dữ liệu lương, công và tăng trưởng YoY. Tổng số NV (kỳ hiện tại): {totalRecords}.
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
                      Vui lòng kiểm tra định nghĩa hàm RPC `get_detailed_employee_salary_data` trong Supabase (README.md) và đảm bảo bảng `Fulltime` tồn tại với các cột cần thiết.
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
            <ScrollArea className="border rounded-md max-h-[36rem]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <SortableHeader columnKey="ma_nv" label="Mã NV" />
                    <SortableHeader columnKey="ho_ten" label="Họ và Tên" />
                    <SortableHeader columnKey="tong_cong_cy" label="Tổng Công (CY)" align="right" />
                    <SortableHeader columnKey="tien_linh_cy" label="Tiền Lĩnh (CY)" align="right" />
                    <SortableHeader columnKey="tien_linh_per_cong_cy" label="Lĩnh/Công (CY)" align="right" />
                    <SortableHeader columnKey="growth_tong_cong" label="TT Công (YoY)" align="center"/>
                    <SortableHeader columnKey="growth_tien_linh" label="TT Tiền Lĩnh (YoY)" align="center"/>
                    <SortableHeader columnKey="growth_tien_linh_per_cong" label="TT Lĩnh/Công (YoY)" align="center"/>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((row) => (
                    <TableRow key={row.ma_nv}>
                      <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ma_nv}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_ten}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatNumber(row.tong_cong_cy)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh_cy)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh_per_cong_cy)}</TableCell>
                      {renderGrowthCell(row.growth_tong_cong)}
                      {renderGrowthCell(row.growth_tien_linh)}
                      {renderGrowthCell(row.growth_tien_linh_per_cong)}
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
