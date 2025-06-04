
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";
// Assuming these tools are created as discussed
// import { getNganhDocFTSalaryHanoiTool, getDonVi2PTSalaryTool } from '@/ai/tools/dashboardQueryTools';

interface NganhDocMetric {
  key: string; // This will be either nganh_doc_key or don_vi_2_key
  ft_salary?: number;
  pt_salary?: number;
}

interface MergedNganhDocData {
  grouping_key: string; // This is the unified key from nganh_doc or Don_vi_2
  ft_salary_2024: number;
  ft_salary_2025: number;
  pt_salary_2024: number;
  pt_salary_2025: number;
  total_salary_2024: number;
  total_salary_2025: number;
  ft_salary_change_val: number | null;
  pt_salary_change_val: number | null;
  total_salary_change_val: number | null;
}

interface FetchError {
  type: 'rpcMissing' | 'generic';
  message: string;
  details?: string;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

type SortableNganhDocColumnKey =
  | 'grouping_key'
  | 'ft_salary_2024' | 'ft_salary_2025' | 'ft_salary_change_val'
  | 'pt_salary_2024' | 'pt_salary_2025' | 'pt_salary_change_val'
  | 'total_salary_2024' | 'total_salary_2025' | 'total_salary_change_val';


const calculateChange = (valNew: number | null, valOld: number | null): number | null => {
    if (valNew === null || valOld === null) return null;
    if (valOld === 0 && valNew === 0) return 0;
    if (valOld === 0) return valNew > 0 ? Infinity : (valNew < 0 ? -Infinity : 0); 
    return (valNew - valOld) / valOld;
};

interface NganhDocComparisonTableProps {
  selectedMonths?: number[];
  // selectedYear is not directly used as this table compares 2024 vs 2025
}


export default function NganhDocComparisonTable({ selectedMonths }: NganhDocComparisonTableProps) {
  const [comparisonData, setComparisonData] = useState<MergedNganhDocData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");
  const [sortConfig, setSortConfig] = useState<{ key: SortableNganhDocColumnKey | null; direction: 'ascending' | 'descending' }>({ key: 'grouping_key', direction: 'ascending' });

  const fetchDataForYear = useCallback(async (year: number): Promise<{ ftData: NganhDocMetric[], ptData: NganhDocMetric[], error: FetchError | null }> => {
    let yearError: FetchError | null = null;
    let ftSalaryData: NganhDocMetric[] = [];
    let ptSalaryData: NganhDocMetric[] = [];

    const rpcArgs = {
      p_filter_year: year,
      p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
    };

    // Fetch Full-time Salary (Hanoi, by nganh_doc)
    try {
      const ftFunctionName = 'get_nganhdoc_ft_salary_hanoi';
      const { data: ftRpcData, error: ftRpcError } = await supabase.rpc(ftFunctionName, rpcArgs);
      if (ftRpcError) {
        const msg = ftRpcError.message ? String(ftRpcError.message).toLowerCase() : '';
        yearError = { type: (ftRpcError.code === '42883' || msg.includes(ftFunctionName.toLowerCase())) ? 'rpcMissing' : 'generic', message: `Lỗi RPC (${ftFunctionName}, ${year}): ${ftRpcError.message}` };
      } else {
        ftSalaryData = (ftRpcData || []).map((item: any) => ({
          key: String(item.nganh_doc_key),
          ft_salary: Number(item.ft_salary) || 0,
        }));
      }
    } catch (e: any) {
      if (!yearError) yearError = { type: 'generic', message: `Lỗi không xác định (FT, ${year}): ${e.message}` };
    }

    // Fetch Part-time Salary (by Don_vi_2)
    if (!yearError) { // Only proceed if no error from FT fetch for this year
        try {
            const ptFunctionName = 'get_donvi2_pt_salary';
            const { data: ptRpcData, error: ptRpcError } = await supabase.rpc(ptFunctionName, rpcArgs);
            if (ptRpcError) {
            const msg = ptRpcError.message ? String(ptRpcError.message).toLowerCase() : '';
            yearError = { type: (ptRpcError.code === '42883' || msg.includes(ptFunctionName.toLowerCase())) ? 'rpcMissing' : 'generic', message: `Lỗi RPC (${ptFunctionName}, ${year}): ${ptRpcError.message}` };
            } else {
            ptSalaryData = (ptRpcData || []).map((item: any) => ({
                key: String(item.don_vi_2_key),
                pt_salary: Number(item.pt_salary) || 0,
            }));
            }
        } catch (e: any) {
            if (!yearError) yearError = { type: 'generic', message: `Lỗi không xác định (PT, ${year}): ${e.message}` };
        }
    }
    
    return { ftData: ftSalaryData, ptData: ptSalaryData, error: yearError };
  }, [selectedMonths]);

  const fetchAllComparisonData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
        if (selectedMonths.length === 12) monthSegment = "cả năm";
        else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
        else monthSegment = `${selectedMonths.length} tháng đã chọn`;
    } else {
        monthSegment = "cả năm";
    }
    setFilterDescription(`${monthSegment} (2024 vs 2025)`);

    const [data2024Result, data2025Result] = await Promise.all([
      fetchDataForYear(2024),
      fetchDataForYear(2025),
    ]);
    
    if (data2024Result.error) {
        setError(data2024Result.error);
        setIsLoading(false);
        return;
    }
    if (data2025Result.error) {
        setError(data2025Result.error);
        setIsLoading(false);
        return;
    }
    
    const mergedMap = new Map<string, MergedNganhDocData>();
    const allKeys = new Set<string>();

    data2024Result.ftData.forEach(item => allKeys.add(item.key));
    data2024Result.ptData.forEach(item => allKeys.add(item.key));
    data2025Result.ftData.forEach(item => allKeys.add(item.key));
    data2025Result.ptData.forEach(item => allKeys.add(item.key));

    allKeys.forEach(key => {
        const ft2024 = data2024Result.ftData.find(d => d.key === key)?.ft_salary || 0;
        const pt2024 = data2024Result.ptData.find(d => d.key === key)?.pt_salary || 0;
        const ft2025 = data2025Result.ftData.find(d => d.key === key)?.ft_salary || 0;
        const pt2025 = data2025Result.ptData.find(d => d.key === key)?.pt_salary || 0;

        if (ft2024 === 0 && pt2024 === 0 && ft2025 === 0 && pt2025 === 0) {
            return; // Skip if all values are zero for this key
        }

        mergedMap.set(key, {
            grouping_key: key,
            ft_salary_2024: ft2024,
            pt_salary_2024: pt2024,
            total_salary_2024: ft2024 + pt2024,
            ft_salary_2025: ft2025,
            pt_salary_2025: pt2025,
            total_salary_2025: ft2025 + pt2025,
            ft_salary_change_val: null, // Will be calculated next
            pt_salary_change_val: null,
            total_salary_change_val: null,
        });
    });

    const finalData = Array.from(mergedMap.values()).map(item => ({
        ...item,
        ft_salary_change_val: calculateChange(item.ft_salary_2025, item.ft_salary_2024),
        pt_salary_change_val: calculateChange(item.pt_salary_2025, item.pt_salary_2024),
        total_salary_change_val: calculateChange(item.total_salary_2025, item.total_salary_2024),
    }));
    
    setComparisonData(finalData);
    setIsLoading(false);
  }, [selectedMonths, fetchDataForYear]); 

  useEffect(() => {
    fetchAllComparisonData();
  }, [fetchAllComparisonData]);

  const requestSort = (key: SortableNganhDocColumnKey) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedComparisonData = useMemo(() => {
    let sortableItems = [...comparisonData];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];

        if (valA === null && valB === null) return 0;
        if (valA === null) return sortConfig.direction === 'ascending' ? -1 : 1; 
        if (valB === null) return sortConfig.direction === 'ascending' ? 1 : -1; 
        
        if (valA === Infinity) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (valB === Infinity) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA === -Infinity) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valB === -Infinity) return sortConfig.direction === 'ascending' ? 1 : -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'ascending' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [comparisonData, sortConfig]);


  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatPercentage = (value: number | null, forceSign = false) => {
    if (value === null || value === undefined) return 'N/A';
    if (value === Infinity) return 'Tăng ∞';
    if (value === -Infinity) return 'Giảm ∞';
    const sign = value > 0 && forceSign ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)}%`;
  };
  
  const renderChangeCell = (change: number | null, isCost: boolean) => {
    if (change === null || change === undefined) return <TableCell className="text-center text-muted-foreground text-xs py-1.5 px-2">N/A</TableCell>;
    
    let colorClass = 'text-muted-foreground';
    let Icon = Minus;

    if (change === Infinity) {
      colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500';
      Icon = TrendingUp;
    } else if (change === -Infinity) {
      colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
      Icon = TrendingDown;
    } else if (change > 0) {
      colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500';
      Icon = TrendingUp;
    } else if (change < 0) {
      colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500';
      Icon = TrendingDown;
    }

    const displayValue = formatPercentage(change, true);

    return (
      <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}>
        <div className="flex items-center justify-center gap-0.5">
          <Icon className="h-3 w-3" />
          {displayValue}
        </div>
      </TableCell>
    );
  };

  const renderSortableTableHead = (label: string, columnKey: SortableNganhDocColumnKey, isSticky: boolean = false, minWidth?: string, align: 'left' | 'center' | 'right' = 'center') => {
    const isSorted = sortConfig.key === columnKey;
    const SortIcon = isSorted ? (sortConfig.direction === 'ascending' ? ArrowUp : ArrowDown) : ArrowUpDown;
    
    return (
      <TableHead 
        className={cn(
          "py-1.5 px-2 text-xs font-medium whitespace-nowrap cursor-pointer hover:bg-muted/50",
          `text-${align}`,
          isSticky && "sticky left-0 bg-card z-20", 
          minWidth && `min-w-[${minWidth}]`
        )}
        style={isSticky ? { minWidth: minWidth || '180px' } : { minWidth : minWidth }} 
        onClick={() => requestSort(columnKey)}
      >
        <div className={cn("flex items-center gap-1", `justify-${align === 'center' ? 'center' : align === 'left' ? 'start' : 'end'}`)}>
          {label}
          <SortIcon className={cn("h-3 w-3 shrink-0", isSorted ? "opacity-100" : "opacity-50")} />
        </div>
      </TableHead>
    );
  };


  if (isLoading) {
    return (
      <Card className="mt-4 flex-grow flex flex-col">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle>
          <CardDescription className="text-xs truncate">Đang tải dữ liệu so sánh chi tiết...</CardDescription>
        </CardHeader>
        <CardContent className="pt-2 flex items-center justify-center flex-grow">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 border-destructive/50 flex-grow flex flex-col">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Lỗi Tải Bảng Ngành Dọc/Đơn Vị 2
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 flex-grow">
           <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p>
            {(error.message.includes(CRITICAL_SETUP_ERROR_PREFIX) || error.type === 'rpcMissing' || error.message.includes("RPC")) && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các hàm RPC `get_nganhdoc_ft_salary_hanoi` và `get_donvi2_pt_salary` trong Supabase theo hướng dẫn tại README.md. Đảm bảo các bảng `Fulltime` (với cột `nganh_doc`, `hn_or_note`) và `Parttime` (với cột `Don_vi_2`) tồn tại.
                </p>
            )}
        </CardContent>
      </Card>
    );
  }
  
  if (comparisonData.length === 0) {
    return (
       <Card className="mt-4 flex-grow flex flex-col">
        <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle>
            <CardDescription className="text-xs truncate">
                {filterDescription}.
            </CardDescription>
        </CardHeader>
         <CardContent className="pt-2 flex items-center justify-center flex-grow">
           <p className="text-sm text-muted-foreground">Không có dữ liệu nào cho kỳ đã chọn hoặc sau khi loại trừ các nhóm không có số liệu.</p>
         </CardContent>
       </Card>
    );
  }

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]"> {/* Adjust height as needed */}
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle>
        <CardDescription className="text-xs truncate">
            {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                {renderSortableTableHead("Ngành dọc/Đơn vị", 'grouping_key', true, '200px', 'left')}
                {renderSortableTableHead("Lương FT HN 24", 'ft_salary_2024', false, '120px', 'right')}
                {renderSortableTableHead("Lương FT HN 25", 'ft_salary_2025', false, '120px', 'right')}
                {renderSortableTableHead("+/- FT HN", 'ft_salary_change_val', false, '100px')}
                {renderSortableTableHead("Lương PT ĐV2 24", 'pt_salary_2024', false, '120px', 'right')}
                {renderSortableTableHead("Lương PT ĐV2 25", 'pt_salary_2025', false, '120px', 'right')}
                {renderSortableTableHead("+/- PT ĐV2", 'pt_salary_change_val', false, '100px')}
                {renderSortableTableHead("Tổng Lương 24", 'total_salary_2024', false, '130px', 'right')}
                {renderSortableTableHead("Tổng Lương 25", 'total_salary_2025', false, '130px', 'right')}
                {renderSortableTableHead("+/- Tổng Lương", 'total_salary_change_val', false, '110px')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedComparisonData.map((row) => (
                  <TableRow key={row.grouping_key}>
                    <TableCell className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left">{row.grouping_key}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.ft_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.ft_salary_2025)}</TableCell>
                    {renderChangeCell(row.ft_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.pt_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.pt_salary_2025)}</TableCell>
                    {renderChangeCell(row.pt_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(row.total_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(row.total_salary_2025)}</TableCell>
                    {renderChangeCell(row.total_salary_change_val, true)}
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

    