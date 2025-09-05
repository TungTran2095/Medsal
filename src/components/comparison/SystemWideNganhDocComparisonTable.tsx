"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
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

const getAggregatedDataForNode = (
  node: OrgNode,
  dataMap: Map<string, MergedNganhDocData>
): MergedNganhDocData | null => {
  const nodeNameTrimmed = node.name.trim();

  let aggregated: MergedNganhDocData = {
    grouping_key: node.name,
    ft_salary_2024: 0, ft_salary_2025: 0,
    pt_salary_2024: 0, pt_salary_2025: 0,
    total_salary_2024: 0, total_salary_2025: 0,
    ft_salary_change_val: null, pt_salary_change_val: null, total_salary_change_val: null,
  };

  let hasAnyData = false;

  // Add data of the current node itself if it exists in dataMap
  const directData = dataMap.get(node.name);
  console.log(`SystemWide - Looking for node "${node.name}" in dataMap:`, directData);
  if (directData) {
    aggregated.ft_salary_2024 += directData.ft_salary_2024;
    aggregated.ft_salary_2025 += directData.ft_salary_2025;
    aggregated.pt_salary_2024 += directData.pt_salary_2024;
    aggregated.pt_salary_2025 += directData.pt_salary_2025;
    if (directData.ft_salary_2024 !== 0 || directData.ft_salary_2025 !== 0 || directData.pt_salary_2024 !== 0 || directData.pt_salary_2025 !== 0) {
      hasAnyData = true;
    }
  }

  if (node.children && node.children.length > 0) {
    for (const childNode of node.children) {
      const childAggregatedData = getAggregatedDataForNode(childNode, dataMap);
      if (childAggregatedData) {
        aggregated.ft_salary_2024 += childAggregatedData.ft_salary_2024;
        aggregated.ft_salary_2025 += childAggregatedData.ft_salary_2025;
        aggregated.pt_salary_2024 += childAggregatedData.pt_salary_2024;
        aggregated.pt_salary_2025 += childAggregatedData.pt_salary_2025;
        hasAnyData = true;
      }
    }
  }
  
  // Luôn trả về dữ liệu ngay cả khi không có dữ liệu lương để hiển thị cấu trúc cây
  // if (!hasAnyData) {
  //   return null; // No data for this node or any of its children
  // }

  aggregated.total_salary_2024 = aggregated.ft_salary_2024 + aggregated.pt_salary_2024;
  aggregated.total_salary_2025 = aggregated.ft_salary_2025 + aggregated.pt_salary_2025;
  
  aggregated.ft_salary_change_val = calculateChange(aggregated.ft_salary_2025, aggregated.ft_salary_2024);
  aggregated.pt_salary_change_val = calculateChange(aggregated.pt_salary_2025, aggregated.pt_salary_2024);
  aggregated.total_salary_change_val = calculateChange(aggregated.total_salary_2025, aggregated.total_salary_2024);

  return aggregated;
};

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
  renderChangeCell,
}) => {
  const aggregatedNodeData = useMemo(() => getAggregatedDataForNode(node, dataMap), [node, dataMap]);
  const isExpanded = expandedKeys.has(node.id);

  // Get hierarchical children
  const hierarchicalChildren = useMemo(() =>
    node.children || [],
    [node.children, node.id]
  );
  
  const hasDisplayableHierarchicalChildrenWithData = hierarchicalChildren.length > 0;
  const canExpand = hasDisplayableHierarchicalChildrenWithData;

  // Luôn render row nếu là node trong cây tổ chức (không cần kiểm tra có dữ liệu lương hay không)
  const shouldRenderRow = true;

  if (!shouldRenderRow) {
    return null;
  }

  const rowContent = aggregatedNodeData ? (
    <>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(aggregatedNodeData.ft_salary_2024)}</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(aggregatedNodeData.ft_salary_2025)}</TableCell>
      {renderChangeCell(aggregatedNodeData.ft_salary_change_val, true)}
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(aggregatedNodeData.pt_salary_2024)}</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(aggregatedNodeData.pt_salary_2025)}</TableCell>
      {renderChangeCell(aggregatedNodeData.pt_salary_change_val, true)}
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(aggregatedNodeData.total_salary_2024)}</TableCell>
      <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(aggregatedNodeData.total_salary_2025)}</TableCell>
      {renderChangeCell(aggregatedNodeData.total_salary_change_val, true)}
    </>
  ) : ( 
    Array(9).fill(null).map((_, idx) => (
      <TableCell key={`empty-${node.id}-${idx}`} className="text-center py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
    ))
  );

  return (
    <>
      <TableRow>
        <TableCell
          className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left"
          style={{ paddingLeft: `${0.5 + level * 1.25}rem` }}
        >
          <div className="flex items-center">
            {canExpand ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0"
                aria-expanded={isExpanded}
                title={isExpanded ? "Thu gọn" : "Mở rộng"}
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-[calc(0.875rem+0.125rem+0.25rem)] mr-1 shrink-0"></span>
            )}
            <span className="truncate" title={node.name}>{node.name}</span>
          </div>
        </TableCell>
        {rowContent}
      </TableRow>

      {isExpanded && hasDisplayableHierarchicalChildrenWithData && hierarchicalChildren.map(childNode => (
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
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

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

      // Merge các bản ghi có cùng tên phòng khám cho FT
      const mergedFTByName = new Map<string, number>();
      (Array.isArray(ftData) ? ftData : []).forEach((item: any) => {
        const name = String(item.nganh_doc_name || item.nganh_doc_key || item.nganh_doc || item.department_name || '');
        const salary = Number(item.ft_salary) || 0;
        mergedFTByName.set(name, (mergedFTByName.get(name) || 0) + salary);
      });

      // Merge các bản ghi có cùng tên phòng khám cho PT
      const mergedPTByName = new Map<string, number>();
      (Array.isArray(ptData) ? ptData : []).forEach((item: any) => {
        const name = String(item.don_vi_2_name || item.don_vi_2_key || item.don_vi_2 || item.department_name || '');
        const salary = Number(item.pt_salary) || 0;
        mergedPTByName.set(name, (mergedPTByName.get(name) || 0) + salary);
      });

      return {
        ftData: Array.from(mergedFTByName.entries()).map(([name, salary]) => ({
          key: name,
          ft_salary: salary,
        })),
        ptData: Array.from(mergedPTByName.entries()).map(([name, salary]) => ({
          key: name,
          pt_salary: salary,
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

    // Debug: Log dữ liệu từ API
    console.log('SystemWide - FT Data 2024:', data2024Result.ftData);
    console.log('SystemWide - PT Data 2024:', data2024Result.ptData);
    console.log('SystemWide - FT Data 2025:', data2025Result.ftData);
    console.log('SystemWide - PT Data 2025:', data2025Result.ptData);

    const mergedMap = new Map<string, MergedNganhDocData>();
    const allKeys = new Set<string>();

    (data2024Result.ftData || []).forEach(item => allKeys.add(item.key));
    (data2024Result.ptData || []).forEach(item => allKeys.add(item.key));
    (data2025Result.ftData || []).forEach(item => allKeys.add(item.key));
    (data2025Result.ptData || []).forEach(item => allKeys.add(item.key));

    // Tạo map trực tiếp với tên gốc (không chuẩn hóa)
    const directMap = new Map<string, MergedNganhDocData>();

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

        // Tạo dữ liệu trực tiếp với tên gốc
        directMap.set(key, {
            grouping_key: key, // Sử dụng tên gốc
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
    });

    // Chuyển từ directMap sang mergedMap
    directMap.forEach((value, key) => {
        mergedMap.set(key, value);
    });

    // Thêm dữ liệu cho tất cả các node trong cây tổ chức, ngay cả khi không có dữ liệu lương
    if (orgHierarchyData && orgHierarchyData.length > 0) {
      const addNodeToMap = (node: OrgNode) => {
        const nodeName = node.name.trim();
        if (!mergedMap.has(nodeName)) {
          mergedMap.set(nodeName, {
            grouping_key: nodeName,
            ft_salary_2024: 0,
            ft_salary_2025: 0,
            pt_salary_2024: 0,
            pt_salary_2025: 0,
            total_salary_2024: 0,
            total_salary_2025: 0,
            ft_salary_change_val: null,
            pt_salary_change_val: null,
            total_salary_change_val: null,
          });
        }
        if (node.children) {
          node.children.forEach(child => addNodeToMap(child));
        }
      };
      
      orgHierarchyData.forEach(rootNode => addNodeToMap(rootNode));
    }
    
    const finalData = Array.from(mergedMap.values());
    console.log('SystemWide - Final merged data:', finalData);
    console.log('SystemWide - Org hierarchy data:', orgHierarchyData);
    
    setComparisonData(finalData); 
    setIsLoading(false);
  }, [fetchDataForYear, selectedMonths, selectedNganhDoc, selectedDonVi2, orgHierarchyData]);

  useEffect(() => {
    fetchAllComparisonData();
  }, [fetchAllComparisonData]);

  const dataMapForHierarchy = useMemo(() => {
    const map = new Map<string, MergedNganhDocData>();
    comparisonData.forEach(item => {
      map.set(item.grouping_key, item);
    });
    return map;
  }, [comparisonData]);

  const medlatecGroupNode = useMemo(() => {
    if (!orgHierarchyData || orgHierarchyData.length === 0) return null;
    return orgHierarchyData.find(node => String(node.id) === "1" || node.name.trim().toLowerCase() === "medlatec group");
  }, [orgHierarchyData]);

  const nodesToRender = useMemo(() => {
    if (!medlatecGroupNode || !medlatecGroupNode.children) return [];
    return medlatecGroupNode.children;
  }, [medlatecGroupNode]);

  const hasRenderableNodes = useMemo(() => {
    if (!medlatecGroupNode || !medlatecGroupNode.children) return false;
    // Hiển thị tất cả các node trong cây tổ chức, kể cả khi không có dữ liệu lương
    return nodesToRender.length > 0;
  }, [medlatecGroupNode, nodesToRender]);

  const totals = useMemo(() => {
    const defaultTotals = {
      ft_salary_2024: 0, ft_salary_2025: 0, pt_salary_2024: 0, pt_salary_2025: 0,
      total_salary_2024: 0, total_salary_2025: 0,
      ft_salary_change_val: null, pt_salary_change_val: null, total_salary_change_val: null,
    };
    if (!medlatecGroupNode) return defaultTotals;
    
    // Calculate totals for Medlatec Group including its hierarchical children
    const medlatecAggregated = getAggregatedDataForNode(medlatecGroupNode, dataMapForHierarchy);
    let finalTotals = medlatecAggregated ? { ...medlatecAggregated } : { ...defaultTotals, grouping_key: "Medlatec Group" };
    
    return finalTotals;
  }, [medlatecGroupNode, dataMapForHierarchy]);

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

  const noDataForMedlatecGroup = !medlatecGroupNode;

  if (noDataForMedlatecGroup) {
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
           <p className="text-sm text-muted-foreground">Không tìm thấy "Medlatec Group" trong dữ liệu cơ cấu tổ chức hoặc không có dữ liệu cho nhóm này.</p> 
         </CardContent> 
       </Card> 
     ); 
  }

  if (!hasRenderableNodes) {
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
           <p className="text-sm text-muted-foreground">Không có đơn vị con nào thuộc "Medlatec Group" có dữ liệu để hiển thị sau khi lọc.</p> 
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
            {filterDescription}. Hiển thị dữ liệu toàn hệ thống theo cấu trúc cây tổ chức.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px]">
                  Ngành dọc/Đơn vị
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">
                  Lương FT HN 24
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">
                  Lương FT HN 25
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[100px]">
                  +/- FT HN
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">
                  Lương PT ĐV2 24
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">
                  Lương PT ĐV2 25
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[100px]">
                  +/- PT ĐV2
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">
                  Tổng Lương 24
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">
                  Tổng Lương 25
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-center min-w-[110px]">
                  +/- Tổng Lương
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nodesToRender.map(rootNode => (
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
                <TableCell className="py-1.5 px-2 text-xs font-bold text-left sticky left-0 bg-card z-10">
                  Tổng Cộng (Medlatec Group)
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
