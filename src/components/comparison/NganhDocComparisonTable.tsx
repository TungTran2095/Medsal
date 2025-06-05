
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient'; 
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from "@/lib/utils";
import type { OrgNode, FlatOrgUnit } from '@/types'; // Added FlatOrgUnit

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

interface NganhDocComparisonTableProps {
  selectedMonths?: number[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
  orgHierarchyData: OrgNode[]; // For tree structure
  flatOrgUnits: FlatOrgUnit[]; // For lookups, if needed elsewhere
}

interface RenderTableRowProps {
  node: OrgNode;
  level: number;
  dataMap: Map<string, MergedNganhDocData>;
  expandedKeys: Set<string>;
  toggleExpand: (key: string) => void;
  formatCurrency: (value: number | null) => string;
  renderChangeCell: (change: number | null, isCost: boolean) => JSX.Element;
}

const RenderTableRow: React.FC<RenderTableRowProps> = ({ 
  node, 
  level, 
  dataMap,
  expandedKeys,
  toggleExpand,
  formatCurrency,
  renderChangeCell
}) => {
  const nodeData = dataMap.get(node.name);
  const isExpanded = expandedKeys.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  // Only render if there's data for this node OR if it's a parent node with children (to allow expansion)
  // OR if this node itself is an ancestor of a node that has data.
  // For simplicity now, we'll render if nodeData exists or it has children that might have data.
  // A more sophisticated check would see if any descendant has data.
  const shouldRenderRow = !!nodeData || hasChildren;

  if (!shouldRenderRow) {
     // If a node has no data and no children, and we are strictly showing data-bearing nodes or their parents,
     // we might not render it. However, for full hierarchy display, we might always render.
     // For now, let's assume we want to see the structure even if intermediate parents have no direct data.
     // Let's render the row if it has children, or if it has data.
     // If a node has no data and no children, it will not be rendered by this logic if we strict-check nodeData
  }


  const rowContent = nodeData ? (
    <>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(nodeData.ft_salary_2024)}</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(nodeData.ft_salary_2025)}</TableCell>
      {renderChangeCell(nodeData.ft_salary_change_val, true)}
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(nodeData.pt_salary_2024)}</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(nodeData.pt_salary_2025)}</TableCell>
      {renderChangeCell(nodeData.pt_salary_change_val, true)}
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(nodeData.total_salary_2024)}</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(nodeData.total_salary_2025)}</TableCell>
      {renderChangeCell(nodeData.total_salary_change_val, true)}
    </>
  ) : (
    // Render empty cells if no data but it's a parent that might be expanded
    <>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
      <TableCell className="text-center py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
      <TableCell className="text-center py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold text-muted-foreground">-</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold text-muted-foreground">-</TableCell>
      <TableCell className="text-center py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
    </>
  );

  return (
    <>
      <TableRow>
        <TableCell 
          className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left"
          style={{ paddingLeft: `${0.5 + level * 1.25}rem` }}
        >
          <div className="flex items-center">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="mr-1 p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                title={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-[calc(0.875rem+0.125rem+0.25rem)] mr-1"></span> 
            )}
            <span className="truncate" title={node.name}>{node.name}</span>
          </div>
        </TableCell>
        {rowContent}
      </TableRow>
      {isExpanded && hasChildren && node.children.map(childNode => (
        <RenderTableRow
          key={childNode.id}
          node={childNode}
          level={level + 1}
          dataMap={dataMap}
          expandedKeys={expandedKeys}
          toggleExpand={toggleExpand}
          formatCurrency={formatCurrency}
          renderChangeCell={renderChangeCell}
        />
      ))}
    </>
  );
};


export default function NganhDocComparisonTable({ 
  selectedMonths, 
  selectedNganhDoc, 
  selectedDonVi2, 
  orgHierarchyData,
  // flatOrgUnits prop is now available if needed for other logic later
  flatOrgUnits 
}: NganhDocComparisonTableProps) {
  const [comparisonData, setComparisonData] = useState<MergedNganhDocData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const fetchDataForYear = useCallback(async (year: number): Promise<{ ftData: NganhDocMetric[], ptData: NganhDocMetric[], error: FetchError | null }> => {
    let yearError: FetchError | null = null;
    let ftSalaryData: NganhDocMetric[] = [];
    let ptSalaryData: NganhDocMetric[] = [];

    const rpcArgs = {
      p_filter_year: year,
      p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
    };

    try {
      const ftFunctionName = 'get_nganhdoc_ft_salary_hanoi';
      const { data: ftRpcData, error: ftRpcError } = await supabase.rpc(ftFunctionName, rpcArgs);
      if (ftRpcError) {
        const msg = ftRpcError.message ? String(ftRpcError.message).toLowerCase() : '';
        yearError = { type: (ftRpcError.code === '42883' || msg.includes(ftFunctionName.toLowerCase()) || (msg.includes(ftFunctionName.toLowerCase()) && msg.includes('does not exist')) ) ? 'rpcMissing' : 'generic', message: `Lỗi RPC (${ftFunctionName}, ${year}): ${ftRpcError.message}` };
      } else {
        ftSalaryData = (Array.isArray(ftRpcData) ? ftRpcData : []).map((item: any) => ({
          key: String(item.nganh_doc_key),
          ft_salary: Number(item.ft_salary) || 0,
        }));
      }
    } catch (e: any) {
      if (!yearError) yearError = { type: 'generic', message: `Lỗi không xác định khi gọi RPC Lương FT (năm ${year}): ${e.message}` };
    }

    if (!yearError) { 
        try {
            const ptFunctionName = 'get_donvi2_pt_salary';
            const { data: ptRpcData, error: ptRpcError } = await supabase.rpc(ptFunctionName, rpcArgs);
            if (ptRpcError) {
                const msg = ptRpcError.message ? String(ptRpcError.message).toLowerCase() : '';
                yearError = { type: (ptRpcError.code === '42883' || msg.includes(ptFunctionName.toLowerCase()) || (msg.includes(ptFunctionName.toLowerCase()) && msg.includes('does not exist')) ) ? 'rpcMissing' : 'generic', message: `Lỗi RPC (${ptFunctionName}, ${year}): ${ptRpcError.message}` };
            } else {
                ptSalaryData = (Array.isArray(ptRpcData) ? ptRpcData : []).map((item: any) => ({
                    key: String(item.don_vi_2_key),
                    pt_salary: Number(item.pt_salary) || 0,
                }));
            }
        } catch (e: any) {
            if (!yearError) yearError = { type: 'generic', message: `Lỗi không xác định khi gọi RPC Lương PT (năm ${year}): ${e.message}` };
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

    data2024Result.ftData.forEach(item => allKeys.add(item.key));
    data2024Result.ptData.forEach(item => allKeys.add(item.key));
    data2025Result.ftData.forEach(item => allKeys.add(item.key));
    data2025Result.ptData.forEach(item => allKeys.add(item.key));

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

        if (finalFt2024 === 0 && finalPt2024 === 0 && finalFt2025 === 0 && finalPt2025 === 0) {
            return; 
        }

        mergedMap.set(key, {
            grouping_key: key,
            ft_salary_2024: finalFt2024,
            pt_salary_2024: finalPt2024,
            total_salary_2024: finalFt2024 + finalPt2024,
            ft_salary_2025: finalFt2025,
            pt_salary_2025: finalPt2025,
            total_salary_2025: finalFt2025 + finalPt2025,
            ft_salary_change_val: null, 
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
  }, [selectedMonths, fetchDataForYear, selectedNganhDoc, selectedDonVi2]); 

  useEffect(() => {
    fetchAllComparisonData();
  }, [fetchAllComparisonData]);

  const dataMapForHierarchy = useMemo(() => {
    const map = new Map<string, MergedNganhDocData>();
    comparisonData.forEach(item => map.set(item.grouping_key, item));
    return map;
  }, [comparisonData]);

  const totals = useMemo(() => {
    // Calculate totals based on the flat comparisonData before hierarchical transformation
    // This ensures all filtered data contributes to the total, regardless of tree visibility
    if (!comparisonData || comparisonData.length === 0) {
      return {
        ft_salary_2024: 0, ft_salary_2025: 0,
        pt_salary_2024: 0, pt_salary_2025: 0,
        total_salary_2024: 0, total_salary_2025: 0,
        ft_salary_change_val: null, pt_salary_change_val: null, total_salary_change_val: null,
      };
    }
    const ft_salary_2024 = comparisonData.reduce((sum, item) => sum + item.ft_salary_2024, 0);
    const ft_salary_2025 = comparisonData.reduce((sum, item) => sum + item.ft_salary_2025, 0);
    const pt_salary_2024 = comparisonData.reduce((sum, item) => sum + item.pt_salary_2024, 0);
    const pt_salary_2025 = comparisonData.reduce((sum, item) => sum + item.pt_salary_2025, 0);
    const total_salary_2024 = comparisonData.reduce((sum, item) => sum + item.total_salary_2024, 0);
    const total_salary_2025 = comparisonData.reduce((sum, item) => sum + item.total_salary_2025, 0);

    return {
      ft_salary_2024, ft_salary_2025,
      pt_salary_2024, pt_salary_2025,
      total_salary_2024, total_salary_2025,
      ft_salary_change_val: calculateChange(ft_salary_2025, ft_salary_2024),
      pt_salary_change_val: calculateChange(pt_salary_2025, pt_salary_2024),
      total_salary_change_val: calculateChange(total_salary_2025, total_salary_2024),
    };
  }, [comparisonData]);


  const formatCurrency = (value: number | null) => { if (value === null || value === undefined) return 'N/A'; return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value); };
  const renderChangeCell = (change: number | null, isCost: boolean) => { if (change === null || change === undefined) return <TableCell className="text-center text-muted-foreground text-xs py-1.5 px-2">N/A</TableCell>; let colorClass = 'text-muted-foreground'; let Icon = Minus; if (change === Infinity) { colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'; Icon = TrendingUp; } else if (change === -Infinity) { colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'; Icon = TrendingDown; } else if (change > 0) { colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'; Icon = TrendingUp; } else if (change < 0) { colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'; Icon = TrendingDown; } const displayValue = (value: number | null, forceSign = false) => { if (value === null || value === undefined) return 'N/A'; if (value === Infinity) return 'Tăng ∞'; if (value === -Infinity) return 'Giảm ∞'; const sign = value > 0 && forceSign ? '+' : ''; return `${sign}${(value * 100).toFixed(1)}%`; }(change, true); return ( <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}> <div className="flex items-center justify-center gap-0.5"> <Icon className="h-3 w-3" /> {displayValue} </div> </TableCell> ); };
  
  if (isLoading) { return ( <Card className="mt-4 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu so sánh chi tiết...</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center flex-grow"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { return ( <Card className="mt-4 border-destructive/50 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1.5"> <AlertTriangle className="h-4 w-4" /> Lỗi Tải Bảng Ngành Dọc/Đơn Vị 2 </CardTitle> </CardHeader> <CardContent className="pt-2 flex-grow"> <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p> {(error.message.includes(CRITICAL_SETUP_ERROR_PREFIX) || error.type === 'rpcMissing' || error.message.toLowerCase().includes("does not exist") || error.message.includes("RPC")) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> {CRITICAL_SETUP_ERROR_PREFIX} Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các hàm RPC `get_nganhdoc_ft_salary_hanoi` và `get_donvi2_pt_salary` trong Supabase theo hướng dẫn tại README.md. Đảm bảo các bảng `Fulltime` (với cột `nganh_doc`, `hn_or_note`) và `Parttime` (với cột `Don_vi_2`) tồn tại và có dữ liệu. </p> )} </CardContent> </Card> ); }
  
  const noDataAvailable = orgHierarchyData.length === 0 || Array.from(dataMapForHierarchy.values()).every(
    d => d.ft_salary_2024 === 0 && d.ft_salary_2025 === 0 && d.pt_salary_2024 === 0 && d.pt_salary_2025 === 0
  );

  if (noDataAvailable && !isLoading) { return ( <Card className="mt-4 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}> {filterDescription}. </CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center flex-grow"> <p className="text-sm text-muted-foreground">Không có dữ liệu nào cho kỳ đã chọn hoặc theo bộ lọc.</p> </CardContent> </Card> ); }

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
            {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px]">Ngành dọc/Đơn vị</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">Lương FT HN 24</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">Lương FT HN 25</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[100px]">+/- FT HN</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">Lương PT ĐV2 24</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">Lương PT ĐV2 25</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[100px]">+/- PT ĐV2</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Tổng Lương 24</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Tổng Lương 25</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[110px]">+/- Tổng Lương</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgHierarchyData.map(rootNode => (
                <RenderTableRow 
                  key={rootNode.id}
                  node={rootNode}
                  level={0}
                  dataMap={dataMapForHierarchy}
                  expandedKeys={expandedKeys}
                  toggleExpand={toggleExpand}
                  formatCurrency={formatCurrency}
                  renderChangeCell={renderChangeCell}
                />
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-card z-10">
              <TableRow>
                <TableCell className="py-1.5 px-2 text-xs font-bold text-left sticky left-0 bg-card z-10">Tổng Cộng</TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">{formatCurrency(totals.ft_salary_2024)}</TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">{formatCurrency(totals.ft_salary_2025)}</TableCell>
                {renderChangeCell(totals.ft_salary_change_val, true)}
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">{formatCurrency(totals.pt_salary_2024)}</TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">{formatCurrency(totals.pt_salary_2025)}</TableCell>
                {renderChangeCell(totals.pt_salary_change_val, true)}
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">{formatCurrency(totals.total_salary_2024)}</TableCell>
                <TableCell className="text-right py-1.5 px-2 text-xs font-bold">{formatCurrency(totals.total_salary_2025)}</TableCell>
                {renderChangeCell(totals.total_salary_change_val, true)}
              </TableRow>
            </TableFooter>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

