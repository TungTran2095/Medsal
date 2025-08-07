"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrgNode, FlatOrgUnit } from '@/types';

interface NganhDocMetric {
  key: string;
  ft_salary?: number;
  pt_salary?: number;
}

interface MergedNganhDocData {
  grouping_key: string;
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

const calculateChange = (valNew: number | null, valOld: number | null): number | null => {
    if (valNew === null || valOld === null) return null;
    if (valOld === 0 && valNew === 0) return 0;
    if (valOld === 0) return valNew > 0 ? Infinity : (valNew < 0 ? -Infinity : 0);
    return (valNew - valOld) / valOld;
};

interface SystemWideNganhDocComparisonTableProps {
  selectedMonths?: number[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
  orgHierarchyData: OrgNode[];
  flatOrgUnits: FlatOrgUnit[];
}

export default function SystemWideNganhDocComparisonTable({
  selectedMonths,
  selectedNganhDoc,
  selectedDonVi2,
  orgHierarchyData,
  flatOrgUnits 
}: SystemWideNganhDocComparisonTableProps) {
  const [comparisonData, setComparisonData] = useState<MergedNganhDocData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");
  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'ascending' | 'descending' }>({ key: 'grouping_key', direction: 'ascending' });

  const fetchDataForYear = useCallback(async (year: number): Promise<{ ftData: NganhDocMetric[], ptData: NganhDocMetric[] } | FetchError> => {
    try {
      // Try new functions first, fallback to old functions if they don't exist
      let ftData, ftError, ptData, ptError;

      // Try new FT function first
      const ftResult = await supabase.rpc('get_nganhdoc_ft_salary_hanoi_with_filter', {
        p_filter_year: year,
        p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
      });
      
      if (ftResult.error && ftResult.error.message.includes('does not exist')) {
        // Fallback to old function
        const oldFtResult = await supabase.rpc('get_nganhdoc_ft_salary_hanoi', {
          p_filter_year: year,
          p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        });
        ftData = oldFtResult.data;
        ftError = oldFtResult.error;
      } else {
        ftData = ftResult.data;
        ftError = ftResult.error;
      }

      if (ftError) {
        return { type: 'rpcMissing', message: `Lỗi RPC FT salary: ${ftError.message}` } as FetchError;
      }

      // Try new PT function first
      const ptResult = await supabase.rpc('get_donvi2_pt_salary_with_filter', {
        p_filter_year: year,
        p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        p_filter_donvi2: (selectedDonVi2 && selectedDonVi2.length > 0) ? selectedDonVi2 : null,
      });

      if (ptResult.error && ptResult.error.message.includes('does not exist')) {
        // Fallback to old function
        const oldPtResult = await supabase.rpc('get_donvi2_pt_salary', {
          p_filter_year: year,
          p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        });
        ptData = oldPtResult.data;
        ptError = oldPtResult.error;
      } else {
        ptData = ptResult.data;
        ptError = ptResult.error;
      }

      if (ptError) {
        return { type: 'rpcMissing', message: `Lỗi RPC PT salary: ${ptError.message}` } as FetchError;
      }

      return {
        ftData: (ftData || []).map((item: any) => ({
          key: String(item.nganh_doc_key || item.nganh_doc || item.department_name || ''),
          ft_salary: Number(item.ft_salary) || 0,
        })),
        ptData: (ptData || []).map((item: any) => ({
          key: String(item.don_vi_2_key || item.don_vi_2 || item.department_name || ''),
          pt_salary: Number(item.pt_salary) || 0,
        }))
      };
    } catch (e: any) {
      return { type: 'generic', message: `Lỗi không xác định khi tải dữ liệu cho năm ${year}: ${e.message}` } as FetchError;
    }
  }, [selectedMonths, selectedNganhDoc, selectedDonVi2]);

  const fetchAllComparisonData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
        if (selectedMonths.length === 12) monthSegment = "cả năm";
        else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
        else monthSegment = `${selectedMonths.length} tháng đã chọn`;
    } else { monthSegment = "cả năm"; }

    let appliedFiltersDesc = "";
    if (selectedNganhDoc && selectedNganhDoc.length > 0) {
        appliedFiltersDesc += (selectedNganhDoc.length <=2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (selectedDonVi2 && selectedDonVi2.length > 0) {
        if (appliedFiltersDesc) appliedFiltersDesc += " và ";
        appliedFiltersDesc += (selectedDonVi2.length <=2 ? selectedDonVi2.join(' & ') : `${selectedDonVi2.length} đơn vị 2`);
    }

    setFilterDescription(`${monthSegment}${appliedFiltersDesc ? ` cho ${appliedFiltersDesc}` : ''} (2024 vs 2025)`);

    const [data2024Result, data2025Result] = await Promise.all([
      fetchDataForYear(2024),
      fetchDataForYear(2025),
    ]);

    if (data2024Result.error) { setError(data2024Result.error); setIsLoading(false); return; }
    if (data2025Result.error) { setError(data2025Result.error); setIsLoading(false); return; }

    const mergedMap = new Map<string, MergedNganhDocData>();
    const allKeys = new Set<string>();

    (data2024Result.ftData || []).forEach(item => allKeys.add(item.key));
    (data2024Result.ptData || []).forEach(item => allKeys.add(item.key));
    (data2025Result.ftData || []).forEach(item => allKeys.add(item.key));
    (data2025Result.ptData || []).forEach(item => allKeys.add(item.key));

    // Hàm chuẩn hóa tên đơn vị
    const normalizeUnitName = (name: string): string => {
        return name.trim().toLowerCase();
    };

    // Tạo map để gộp các đơn vị có tên chuẩn hóa giống nhau
    const normalizedMap = new Map<string, MergedNganhDocData>();

    allKeys.forEach(key => {
        const ft2024 = data2024Result.ftData.find(d => d.key === key)?.ft_salary || 0;
        const pt2024 = data2024Result.ptData.find(d => d.key === key)?.pt_salary || 0;
        const ft2025 = data2025Result.ftData.find(d => d.key === key)?.ft_salary || 0;
        const pt2025 = data2025Result.ptData.find(d => d.key === key)?.pt_salary || 0;

        const passesNganhDocFilter = !selectedNganhDoc || selectedNganhDoc.length === 0 || selectedNganhDoc.includes(key);
        const passesDonVi2Filter = !selectedDonVi2 || selectedDonVi2.length === 0 || selectedDonVi2.includes(key);

        const finalFt2024 = passesNganhDocFilter ? ft2024 : 0;
        const finalFt2025 = passesNganhDocFilter ? ft2025 : 0;
        const finalPt2024 = passesDonVi2Filter ? pt2024 : 0;
        const finalPt2025 = passesDonVi2Filter ? pt2025 : 0;
        
        const total_salary_2024 = finalFt2024 + finalPt2024;
        const total_salary_2025 = finalFt2025 + finalPt2025;

        // Only process if it has data
        if (total_salary_2024 !== 0 || total_salary_2025 !== 0) {
            const normalizedKey = normalizeUnitName(key);
            
            if (normalizedMap.has(normalizedKey)) {
                // Gộp với dữ liệu đã có
                const existing = normalizedMap.get(normalizedKey)!;
                existing.ft_salary_2024 += finalFt2024;
                existing.ft_salary_2025 += finalFt2025;
                existing.pt_salary_2024 += finalPt2024;
                existing.pt_salary_2025 += finalPt2025;
                existing.total_salary_2024 += total_salary_2024;
                existing.total_salary_2025 += total_salary_2025;
                
                // Recalculate change values
                existing.ft_salary_change_val = calculateChange(existing.ft_salary_2025, existing.ft_salary_2024);
                existing.pt_salary_change_val = calculateChange(existing.pt_salary_2025, existing.pt_salary_2024);
                existing.total_salary_change_val = calculateChange(existing.total_salary_2025, existing.total_salary_2024);
            } else {
                // Tạo mới
                normalizedMap.set(normalizedKey, {
                    grouping_key: normalizedKey, // Sử dụng tên chuẩn hóa
                    ft_salary_2024: finalFt2024,
                    pt_salary_2024: finalPt2024,
                    total_salary_2024: total_salary_2024,
                    ft_salary_2025: finalFt2025,
                    pt_salary_2025: finalPt2025,
                    total_salary_2025: total_salary_2025,
                    ft_salary_change_val: calculateChange(finalFt2025, finalFt2024), 
                    pt_salary_change_val: calculateChange(finalPt2025, finalPt2024),
                    total_salary_change_val: calculateChange(total_salary_2025, total_salary_2024),
                });
            }
        }
    });

    // Chuyển từ normalizedMap sang mergedMap
    normalizedMap.forEach((value, key) => {
        mergedMap.set(key, value);
    });
    
    setComparisonData(Array.from(mergedMap.values())); 
    setIsLoading(false);
  }, [fetchDataForYear, selectedMonths, selectedNganhDoc, selectedDonVi2]);

  useEffect(() => {
    fetchAllComparisonData();
  }, [fetchAllComparisonData]);

  const sortedComparisonData = useMemo(() => {
    if (!sortConfig.key) return comparisonData;
    
    return [...comparisonData].sort((a, b) => {
      const aValue = a[sortConfig.key as keyof MergedNganhDocData];
      const bValue = b[sortConfig.key as keyof MergedNganhDocData];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'ascending' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      const aNum = typeof aValue === 'number' ? aValue : 0;
      const bNum = typeof bValue === 'number' ? bValue : 0;
      
      return sortConfig.direction === 'ascending' ? aNum - bNum : bNum - aNum;
    });
  }, [comparisonData, sortConfig]);

  const totals = useMemo(() => {
    return comparisonData.reduce((acc, item) => ({
      ft_salary_2024: acc.ft_salary_2024 + item.ft_salary_2024,
      ft_salary_2025: acc.ft_salary_2025 + item.ft_salary_2025,
      pt_salary_2024: acc.pt_salary_2024 + item.pt_salary_2024,
      pt_salary_2025: acc.pt_salary_2025 + item.pt_salary_2025,
      total_salary_2024: acc.total_salary_2024 + item.total_salary_2024,
      total_salary_2025: acc.total_salary_2025 + item.total_salary_2025,
      ft_salary_change_val: calculateChange(
        acc.ft_salary_2025 + item.ft_salary_2025, 
        acc.ft_salary_2024 + item.ft_salary_2024
      ),
      pt_salary_change_val: calculateChange(
        acc.pt_salary_2025 + item.pt_salary_2025, 
        acc.pt_salary_2024 + item.pt_salary_2024
      ),
      total_salary_change_val: calculateChange(
        acc.total_salary_2025 + item.total_salary_2025, 
        acc.total_salary_2024 + item.total_salary_2024
      ),
    }), {
      ft_salary_2024: 0, ft_salary_2025: 0,
      pt_salary_2024: 0, pt_salary_2025: 0,
      total_salary_2024: 0, total_salary_2025: 0,
      ft_salary_change_val: null, pt_salary_change_val: null, total_salary_change_val: null,
    });
  }, [comparisonData]);

  const formatCurrency = (value: number | null) => { 
    if (value === null || value === undefined) return 'N/A'; 
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value); 
  };

  const formatChangeValue = (value: number | null, forceSign = false) => {
    if (value === null || value === undefined) return 'N/A';
    if (value === Infinity) return '+∞';
    if (value === -Infinity) return '-∞';
    if (value === 0) return '0%';
    
    const percentage = value * 100;
    const sign = forceSign && percentage > 0 ? '+' : '';
    return `${sign}${percentage.toFixed(1)}%`;
  };

  const renderChangeCell = (change: number | null, isCost: boolean) => {
    if (change === null || change === undefined) {
      return <TableCell className="text-center whitespace-nowrap text-xs py-1.5 px-2 text-muted-foreground">N/A</TableCell>;
    }
    
    let colorClass = 'text-muted-foreground';
    let Icon = Minus;
    
    if (change > 0) {
        colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'; 
        Icon = TrendingUp;
    } else if (change < 0) {
        colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'; 
        Icon = TrendingDown;
    }
    
    const displayVal = formatChangeValue(change, true);
    return (
      <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}>
        <div className="flex items-center justify-center gap-0.5">
          <Icon className="h-3 w-3" />
          {displayVal}
        </div>
      </TableCell>
    );
  };

  const handleSort = (key: string) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        // Nếu đang sort theo cột này, đổi hướng
        return {
          key,
          direction: prevConfig.direction === 'ascending' ? 'descending' : 'ascending'
        };
      } else {
        // Nếu sort theo cột mới, mặc định ascending
        return {
          key,
          direction: 'ascending'
        };
      }
    });
  };

  const getSortIcon = (columnKey: string) => {
    if (sortConfig.key !== columnKey) {
      return <ArrowUpDown className="h-3 w-3 ml-1" />;
    }
    return sortConfig.direction === 'ascending' 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  if (isLoading) { 
    return ( 
      <Card className="mt-4 flex-grow flex flex-col"> 
        <CardHeader className="pb-2 pt-3"> 
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-primary" />
            Bảng So Sánh Chi Tiết Theo Ngành Dọc (Toàn Hệ Thống)
          </CardTitle> 
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
            <AlertTriangle className="h-4 w-4" /> 
            Lỗi Tải Bảng Ngành Dọc Toàn Hệ Thống 
          </CardTitle> 
        </CardHeader> 
        <CardContent className="pt-2 flex-grow"> 
          <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p> 
                     {(error.message.includes(CRITICAL_SETUP_ERROR_PREFIX) || error.type === 'rpcMissing' || error.message.toLowerCase().includes("does not exist") || error.message.includes("RPC")) && ( 
             <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> 
               {CRITICAL_SETUP_ERROR_PREFIX} Đây là một lỗi cấu hình quan trọng. Component này đang sử dụng fallback với các functions cũ. Để có đầy đủ tính năng lọc, vui lòng tạo các hàm RPC `get_nganhdoc_ft_salary_hanoi_with_filter` và `get_donvi2_pt_salary_with_filter` trong Supabase theo hướng dẫn tại docs/system-wide-nganh-doc-comparison.md. Đảm bảo các bảng `Fulltime` (với cột `nganh_doc`, `hn_or_note`) và `Parttime` (với cột `Don_vi_2`) tồn tại và có dữ liệu. 
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
           <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5">
             <BarChart3 className="h-4 w-4" />
             Bảng So Sánh Chi Tiết Theo Ngành Dọc (Toàn Hệ Thống)
           </CardTitle> 
           <CardDescription className="text-xs truncate" title={filterDescription}> 
             {filterDescription}. 
           </CardDescription> 
         </CardHeader> 
         <CardContent className="pt-2 flex items-center justify-center flex-grow"> 
           <p className="text-sm text-muted-foreground">Không có dữ liệu để hiển thị sau khi lọc.</p> 
         </CardContent> 
       </Card> 
     ); 
  }

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-primary" />
          Bảng So Sánh Chi Tiết Theo Ngành Dọc (Toàn Hệ Thống)
        </CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
            {filterDescription}. Hiển thị dữ liệu toàn hệ thống.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('grouping_key')}
                >
                  <div className="flex items-center">
                    Ngành dọc/Đơn vị
                    {getSortIcon('grouping_key')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('ft_salary_2024')}
                >
                  <div className="flex items-center justify-end">
                    Lương FT HN 24
                    {getSortIcon('ft_salary_2024')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('ft_salary_2025')}
                >
                  <div className="flex items-center justify-end">
                    Lương FT HN 25
                    {getSortIcon('ft_salary_2025')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[100px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('ft_salary_change_val')}
                >
                  <div className="flex items-center justify-center">
                    +/- FT HN
                    {getSortIcon('ft_salary_change_val')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('pt_salary_2024')}
                >
                  <div className="flex items-center justify-end">
                    Lương PT ĐV2 24
                    {getSortIcon('pt_salary_2024')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('pt_salary_2025')}
                >
                  <div className="flex items-center justify-end">
                    Lương PT ĐV2 25
                    {getSortIcon('pt_salary_2025')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[100px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('pt_salary_change_val')}
                >
                  <div className="flex items-center justify-center">
                    +/- PT ĐV2
                    {getSortIcon('pt_salary_change_val')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('total_salary_2024')}
                >
                  <div className="flex items-center justify-end">
                    Tổng Lương 24
                    {getSortIcon('total_salary_2024')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('total_salary_2025')}
                >
                  <div className="flex items-center justify-end">
                    Tổng Lương 25
                    {getSortIcon('total_salary_2025')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[110px] cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('total_salary_change_val')}
                >
                  <div className="flex items-center justify-center">
                    +/- Tổng Lương
                    {getSortIcon('total_salary_change_val')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedComparisonData.map((row) => (
                <TableRow key={row.grouping_key}>
                  <TableCell className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[180px] text-left">
                    {row.grouping_key}
                  </TableCell>
                  <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">
                    {formatCurrency(row.ft_salary_2024)}
                  </TableCell>
                  <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">
                    {formatCurrency(row.ft_salary_2025)}
                  </TableCell>
                  {renderChangeCell(row.ft_salary_change_val, true)}
                  <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">
                    {formatCurrency(row.pt_salary_2024)}
                  </TableCell>
                  <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">
                    {formatCurrency(row.pt_salary_2025)}
                  </TableCell>
                  {renderChangeCell(row.pt_salary_change_val, true)}
                  <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">
                    {formatCurrency(row.total_salary_2024)}
                  </TableCell>
                  <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">
                    {formatCurrency(row.total_salary_2025)}
                  </TableCell>
                  {renderChangeCell(row.total_salary_change_val, true)}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-card z-10">
              <TableRow>
                <TableCell className="py-1.5 px-2 text-xs font-bold text-left sticky left-0 bg-card z-10">
                  Tổng Cộng (Toàn Hệ Thống)
                </TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
                  {formatCurrency(totals.ft_salary_2024)}
                </TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
                  {formatCurrency(totals.ft_salary_2025)}
                </TableCell>
                {renderChangeCell(totals.ft_salary_change_val, true)}
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
                  {formatCurrency(totals.pt_salary_2024)}
                </TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
                  {formatCurrency(totals.pt_salary_2025)}
                </TableCell>
                {renderChangeCell(totals.pt_salary_change_val, true)}
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
                  {formatCurrency(totals.total_salary_2024)}
                </TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
                  {formatCurrency(totals.total_salary_2025)}
                </TableCell>
                {renderChangeCell(totals.total_salary_change_val, true)}
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
