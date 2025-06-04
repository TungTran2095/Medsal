
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, GanttChartSquare, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";

interface LocationComparisonTableProps {
  selectedMonths?: number[];
  selectedDepartments?: string[];
}

interface LocationMetric {
  location_name: string;
  ft_salary: number;
  pt_salary: number;
  total_revenue: number;
}

interface MergedComparisonData {
  location_name: string;
  ft_salary_2024: number;
  ft_salary_2025: number;
  pt_salary_2024: number;
  pt_salary_2025: number;
  total_salary_2024: number;
  total_salary_2025: number;
  total_revenue_2024: number;
  total_revenue_2025: number;
  ratio_2024: number | null;
  ratio_2025: number | null;
  ft_salary_change_val: number | null;
  pt_salary_change_val: number | null;
  total_salary_change_val: number | null;
  revenue_change_val: number | null;
  ratio_change_pp_val: number | null;
}

interface FetchError {
  type: 'rpcMissing' | 'generic';
  message: string;
  details?: string;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

type SortableColumnKey =
  | 'location_name'
  | 'ft_salary_2024' | 'ft_salary_2025' | 'ft_salary_change_val'
  | 'pt_salary_2024' | 'pt_salary_2025' | 'pt_salary_change_val'
  | 'total_salary_2024' | 'total_salary_2025' | 'total_salary_change_val'
  | 'total_revenue_2024' | 'total_revenue_2025' | 'revenue_change_val'
  | 'ratio_2024' | 'ratio_2025' | 'ratio_change_pp_val';

const calculateChange = (valNew: number | null, valOld: number | null): number | null => {
    if (valNew === null || valOld === null) return null;
    if (valOld === 0 && valNew === 0) return 0;
    if (valOld === 0) return valNew > 0 ? Infinity : (valNew < 0 ? -Infinity : 0); 
    return (valNew - valOld) / valOld;
};

const EXCLUDED_LOCATIONS: string[] = [
  "#N/A", "0", "Med An Giang", "Med BR-VT", "Med Group", 
  "Medlatec Group", "Med Kiên Giang", "Med Long An", "Med Mê Linh", 
  "Med Ba Đình", "Med Thanh Xuân", "Med Tây Hồ", "Med Cầu giấy", 
  "Medim", "Med Sơn Tây", "Medcom", "Medicons", "Medon",
  "Med Thụy Khuê" // Added new location to exclude
];


export default function LocationComparisonTable({ selectedMonths, selectedDepartments }: LocationComparisonTableProps) {
  const [comparisonData, setComparisonData] = useState<MergedComparisonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");
  const [sortConfig, setSortConfig] = useState<{ key: SortableColumnKey | null; direction: 'ascending' | 'descending' }>({ key: 'location_name', direction: 'ascending' });

  const fetchDataForYear = useCallback(async (year: number): Promise<LocationMetric[] | FetchError> => {
    const departmentNames = selectedDepartments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];
    const rpcArgs = {
      p_filter_year: year,
      p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
      p_filter_locations: (departmentNames.length > 0) ? departmentNames : null,
    };

    try {
      const functionName = 'get_location_comparison_metrics';
      const { data, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        let isCriticalSetupError =
            rpcError.code === '42883' ||
            (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
            (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        let setupErrorDetails = "";
        if (isCriticalSetupError) {
            setupErrorDetails = `Hàm RPC '${functionName}' hoặc các bảng/cột phụ thuộc của nó có vấn đề.`;
        }
        if (rpcMessageText.includes('relation "fulltime" does not exist')) { setupErrorDetails += " Bảng 'Fulltime' không tồn tại."; isCriticalSetupError = true; }
        if (rpcMessageText.includes('relation "parttime" does not exist')) { setupErrorDetails += " Bảng 'Parttime' không tồn tại."; isCriticalSetupError = true; }
        if (rpcMessageText.includes('relation "doanh_thu" does not exist')) { setupErrorDetails += " Bảng 'Doanh_thu' không tồn tại."; isCriticalSetupError = true; }


        if (isCriticalSetupError) {
            let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}'. Chi tiết: ${setupErrorDetails.trim()}`;
            detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo hàm '${functionName}' đã được tạo đúng trong Supabase theo README.md, và các bảng 'Fulltime', 'Parttime', 'Doanh_thu' tồn tại với các cột cần thiết.`;
            return { type: 'rpcMissing', message: detailedGuidance } as FetchError;
        }
        return { type: 'generic', message: `Lỗi RPC (${functionName}, ${year}): ${rpcError.message}` } as FetchError;
      }
      return (data || []).map((item: any) => ({
        location_name: String(item.location_name),
        ft_salary: Number(item.ft_salary) || 0,
        pt_salary: Number(item.pt_salary) || 0,
        total_revenue: Number(item.total_revenue) || 0,
      }));
    } catch (e: any) {
      return { type: 'generic', message: `Lỗi không xác định khi tải dữ liệu cho năm ${year}: ${e.message}` } as FetchError;
    }
  }, [selectedMonths, selectedDepartments]);

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

    const departmentNames = selectedDepartments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];
    let locationSegment: string;
    if (departmentNames.length > 0) {
        if (departmentNames.length <= 2) locationSegment = departmentNames.join(' & ');
        else locationSegment = `${departmentNames.length} địa điểm đã chọn`;
    } else {
        locationSegment = "tất cả địa điểm";
    }
    setFilterDescription(`${monthSegment} tại ${locationSegment}`);

    const [data2024Result, data2025Result] = await Promise.all([
      fetchDataForYear(2024),
      fetchDataForYear(2025),
    ]);

    if (Array.isArray(data2024Result) && Array.isArray(data2025Result)) {
      const mergedMap = new Map<string, Partial<MergedComparisonData>>();

      data2024Result.forEach(item => {
        let correctedLocationName = item.location_name;
        if (correctedLocationName.startsWith("MED ")) {
            correctedLocationName = "Med " + correctedLocationName.substring(4);
        } else if (correctedLocationName === "MED") {
            correctedLocationName = "Med";
        }

        const existingEntry = mergedMap.get(correctedLocationName) || { 
            location_name: correctedLocationName,
            ft_salary_2024: 0, pt_salary_2024: 0, total_salary_2024: 0, total_revenue_2024: 0,
            ft_salary_2025: 0, pt_salary_2025: 0, total_salary_2025: 0, total_revenue_2025: 0,
         };
        
        mergedMap.set(correctedLocationName, {
          ...existingEntry,
          ft_salary_2024: (existingEntry.ft_salary_2024 || 0) + item.ft_salary,
          pt_salary_2024: (existingEntry.pt_salary_2024 || 0) + item.pt_salary,
          total_salary_2024: (existingEntry.total_salary_2024 || 0) + item.ft_salary + item.pt_salary,
          total_revenue_2024: (existingEntry.total_revenue_2024 || 0) + item.total_revenue,
        });
      });

      data2025Result.forEach(item => {
        let correctedLocationName = item.location_name;
        if (correctedLocationName.startsWith("MED ")) {
            correctedLocationName = "Med " + correctedLocationName.substring(4);
        } else if (correctedLocationName === "MED") {
            correctedLocationName = "Med";
        }
        const existingEntry = mergedMap.get(correctedLocationName) || { 
            location_name: correctedLocationName,
            ft_salary_2024: 0, pt_salary_2024: 0, total_salary_2024: 0, total_revenue_2024: 0,
            ft_salary_2025: 0, pt_salary_2025: 0, total_salary_2025: 0, total_revenue_2025: 0,
        };
        mergedMap.set(correctedLocationName, {
          ...existingEntry,
          ft_salary_2025: (existingEntry.ft_salary_2025 || 0) + item.ft_salary,
          pt_salary_2025: (existingEntry.pt_salary_2025 || 0) + item.pt_salary,
          total_salary_2025: (existingEntry.total_salary_2025 || 0) + item.ft_salary + item.pt_salary,
          total_revenue_2025: (existingEntry.total_revenue_2025 || 0) + item.total_revenue,
        });
      });
      
      const rawFinalData = Array.from(mergedMap.values()).map(item => {
        const ft_s_2024 = item.ft_salary_2024 || 0;
        const ft_s_2025 = item.ft_salary_2025 || 0;
        const pt_s_2024 = item.pt_salary_2024 || 0;
        const pt_s_2025 = item.pt_salary_2025 || 0;
        const total_s_2024 = item.total_salary_2024 || 0; 
        const total_s_2025 = item.total_salary_2025 || 0; 
        const total_r_2024 = item.total_revenue_2024 || 0;
        const total_r_2025 = item.total_revenue_2025 || 0;
        
        const r_2024 = total_r_2024 !== 0 ? total_s_2024 / total_r_2024 : null;
        const r_2025 = total_r_2025 !== 0 ? total_s_2025 / total_r_2025 : null;

        return {
            location_name: item.location_name!,
            ft_salary_2024: ft_s_2024,
            ft_salary_2025: ft_s_2025,
            pt_salary_2024: pt_s_2024,
            pt_salary_2025: pt_s_2025,
            total_salary_2024: total_s_2024,
            total_salary_2025: total_s_2025,
            total_revenue_2024: total_r_2024,
            total_revenue_2025: total_r_2025,
            ratio_2024: r_2024,
            ratio_2025: r_2025,
            ft_salary_change_val: calculateChange(ft_s_2025, ft_s_2024),
            pt_salary_change_val: calculateChange(pt_s_2025, pt_s_2024),
            total_salary_change_val: calculateChange(total_s_2025, total_s_2024),
            revenue_change_val: calculateChange(total_r_2025, total_r_2024),
            ratio_change_pp_val: (r_2025 !== null && r_2024 !== null) ? r_2025 - r_2024 : null,
        };
      }).filter(d => 
        (d.ft_salary_2024 !== 0 || d.ft_salary_2025 !== 0 ||
        d.pt_salary_2024 !== 0 || d.pt_salary_2025 !== 0 ||
        d.total_revenue_2024 !== 0 || d.total_revenue_2025 !== 0) &&
        !EXCLUDED_LOCATIONS.includes(d.location_name)
      );

      setComparisonData(rawFinalData);

    } else {
      if (!Array.isArray(data2024Result)) setError(data2024Result as FetchError);
      else if (!Array.isArray(data2025Result)) setError(data2025Result as FetchError);
      setComparisonData([]);
    }

    setIsLoading(false);
  }, [selectedMonths, selectedDepartments, fetchDataForYear]);

  useEffect(() => {
    fetchAllComparisonData();
  }, [fetchAllComparisonData]);

  const requestSort = (key: SortableColumnKey) => {
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
  
  const formatPercentagePoint = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    const sign = value > 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(1)} pp`;
  }
  
  const renderChangeCell = (change: number | null, isCost: boolean, isRatio: boolean = false) => {
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

    const displayValue = isRatio ? formatPercentagePoint(change) : formatPercentage(change, true);

    return (
      <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}>
        <div className="flex items-center justify-center gap-0.5">
          <Icon className="h-3 w-3" />
          {displayValue}
        </div>
      </TableCell>
    );
  };

  const renderSortableTableHead = (label: string, columnKey: SortableColumnKey, isSticky: boolean = false, minWidth?: string, align: 'left' | 'center' | 'right' = 'center') => {
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
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><GanttChartSquare className="h-4 w-4 text-primary" />Bảng So Sánh Chi Tiết Theo Địa Điểm</CardTitle>
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
            <AlertTriangle className="h-4 w-4" /> Lỗi Tải Bảng So Sánh Địa Điểm
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 flex-grow">
           <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p>
            {(error.message.includes(CRITICAL_SETUP_ERROR_PREFIX) || error.type === 'rpcMissing') && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ hàm RPC `get_location_comparison_metrics` và các bảng/cột phụ thuộc trong Supabase theo hướng dẫn tại README.md.
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
            <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><GanttChartSquare className="h-4 w-4" />Bảng So Sánh Chi Tiết Theo Địa Điểm</CardTitle>
            <CardDescription className="text-xs truncate">
                {filterDescription}. Một số địa điểm không hoạt động hoặc thuộc nhóm tổng công ty đã được loại trừ.
            </CardDescription>
        </CardHeader>
         <CardContent className="pt-2 flex items-center justify-center flex-grow">
           <p className="text-sm text-muted-foreground">Không có dữ liệu địa điểm nào cho kỳ đã chọn hoặc sau khi loại trừ các địa điểm không cần thiết.</p>
         </CardContent>
       </Card>
    );
  }

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[600px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><GanttChartSquare className="h-4 w-4 text-primary" />Bảng So Sánh Chi Tiết Theo Địa Điểm</CardTitle>
        <CardDescription className="text-xs truncate">
            {filterDescription}. Một số địa điểm không hoạt động hoặc thuộc nhóm tổng công ty đã được loại trừ.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                {renderSortableTableHead("Địa Điểm", 'location_name', true, '180px', 'left')}
                {renderSortableTableHead("Lương FT 24", 'ft_salary_2024', false, '100px', 'right')}
                {renderSortableTableHead("Lương FT 25", 'ft_salary_2025', false, '100px', 'right')}
                {renderSortableTableHead("+/- FT", 'ft_salary_change_val', false, '80px')}
                {renderSortableTableHead("Lương PT 24", 'pt_salary_2024', false, '100px', 'right')}
                {renderSortableTableHead("Lương PT 25", 'pt_salary_2025', false, '100px', 'right')}
                {renderSortableTableHead("+/- PT", 'pt_salary_change_val', false, '80px')}
                {renderSortableTableHead("Tổng Lương 24", 'total_salary_2024', false, '110px', 'right')}
                {renderSortableTableHead("Tổng Lương 25", 'total_salary_2025', false, '110px', 'right')}
                {renderSortableTableHead("+/- Lương", 'total_salary_change_val', false, '90px')}
                {renderSortableTableHead("Doanh Thu 24", 'total_revenue_2024', false, '110px', 'right')}
                {renderSortableTableHead("Doanh Thu 25", 'total_revenue_2025', false, '110px', 'right')}
                {renderSortableTableHead("+/- DT", 'revenue_change_val', false, '80px')}
                {renderSortableTableHead("QL/DT 24", 'ratio_2024', false, '80px')}
                {renderSortableTableHead("QL/DT 25", 'ratio_2025', false, '80px')}
                {renderSortableTableHead("+/- QL/DT", 'ratio_change_pp_val', false, '90px')}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedComparisonData.map((row) => (
                  <TableRow key={row.location_name}>
                    <TableCell className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[180px] text-left">{row.location_name}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.ft_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.ft_salary_2025)}</TableCell>
                    {renderChangeCell(row.ft_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.pt_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(row.pt_salary_2025)}</TableCell>
                    {renderChangeCell(row.pt_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(row.total_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(row.total_salary_2025)}</TableCell>
                    {renderChangeCell(row.total_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(row.total_revenue_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(row.total_revenue_2025)}</TableCell>
                    {renderChangeCell(row.revenue_change_val, false)}
                    <TableCell className="text-center py-1.5 px-2 text-xs whitespace-nowrap">{formatPercentage(row.ratio_2024)}</TableCell>
                    <TableCell className="text-center py-1.5 px-2 text-xs whitespace-nowrap">{formatPercentage(row.ratio_2025)}</TableCell>
                    {renderChangeCell(row.ratio_change_pp_val, true, true)}
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

