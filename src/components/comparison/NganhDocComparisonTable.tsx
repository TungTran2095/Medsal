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
const HETHONG_KHAMCHUABENH_ID = "2"; // Assuming ID "2" is "Hệ thống khám chữa bệnh"
const HETHONG_KHAMCHUABENH_NAME = "Hệ thống khám chữa bệnh";

const DYNAMIC_CHILDREN_NAMES = ["Med Ba Đình", "Med Thanh Xuân", "Med Tây Hồ", "Med Cầu Giấy"];

const EXCLUDED_NGANHDOC_KEYS_SET = new Set([
    "Med Pharma", "0", "Medon", "Medaz", "Medcom", "Medicons", "Medim",
    ...DYNAMIC_CHILDREN_NAMES // Ensure these are part of the general exclusion set too
]);


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
  orgHierarchyData: OrgNode[];
  flatOrgUnits: FlatOrgUnit[];
}

const getAggregatedDataForNode = (
  node: OrgNode,
  dataMap: Map<string, MergedNganhDocData>
): MergedNganhDocData | null => {
  const nodeNameTrimmed = node.name.trim();

  // If this node itself is one of the dynamic children names, AND it's not HTKCB itself,
  // it shouldn't contribute directly to its parent's sum if the parent is not HTKCB.
  // This ensures its data is only accounted for via specificChildrenData for HTKCB.
  // However, its primary data might come from dataMap if it has a matching nganh_doc/don_vi_2 key.
  // The main exclusion happens at the rendering stage. Here, we just check if it's globally excluded.
  if (EXCLUDED_NGANHDOC_KEYS_SET.has(nodeNameTrimmed) && node.id !== HETHONG_KHAMCHUABENH_ID) {
    return null;
  }

  let aggregated: MergedNganhDocData = {
    grouping_key: node.name,
    ft_salary_2024: 0, ft_salary_2025: 0,
    pt_salary_2024: 0, pt_salary_2025: 0,
    total_salary_2024: 0, total_salary_2025: 0,
    ft_salary_change_val: null, pt_salary_change_val: null, total_salary_change_val: null,
  };

  let hasAnyData = false;

  // Add data of the current node itself if it exists in dataMap and is not excluded
  const directData = dataMap.get(node.name);
  if (directData && (!EXCLUDED_NGANHDOC_KEYS_SET.has(nodeNameTrimmed) || node.id === HETHONG_KHAMCHUABENH_ID)) {
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
      // Skip dynamic children if the current node is HTKCB, as they are handled separately for display
      if (node.id === HETHONG_KHAMCHUABENH_ID && DYNAMIC_CHILDREN_NAMES.includes(childNode.name.trim())) {
        continue;
      }
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
  
  if (!hasAnyData) {
    return null; // No data for this node or any of its children
  }

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
  specificChildrenData: Map<string, MergedNganhDocData>;
  isLoadingSpecificChildren: boolean;
  expandedKeys: Set<string>;
  toggleExpand: (key: string) => void;
  formatCurrency: (value: number | null) => string;
  renderChangeCell: (change: number | null, isCost: boolean) => JSX.Element;
}

const RenderTableRow: React.FC<RenderTableRowProps> = ({
  node,
  level,
  dataMap,
  specificChildrenData,
  isLoadingSpecificChildren,
  expandedKeys,
  toggleExpand,
  formatCurrency,
  renderChangeCell,
}) => {

  // CRITICAL: Prevent independent rendering of DYNAMIC_CHILDREN_NAMES if they are not HTKCB itself.
  // These names should only appear as dynamic children of HETHONG_KHAMCHUABENH_ID.
  if (node.id !== HETHONG_KHAMCHUABENH_ID && DYNAMIC_CHILDREN_NAMES.includes(node.name.trim())) {
    return null;
  }
  // Also respect general exclusions from EXCLUDED_NGANHDOC_KEYS_SET for non-HTKCB nodes.
  // DYNAMIC_CHILDREN_NAMES are already in EXCLUDED_NGANHDOC_KEYS_SET.
  if (node.id !== HETHONG_KHAMCHUABENH_ID && EXCLUDED_NGANHDOC_KEYS_SET.has(node.name.trim())) {
      return null;
  }

  const aggregatedNodeData = useMemo(() => getAggregatedDataForNode(node, dataMap), [node, dataMap]);
  const isExpanded = expandedKeys.has(node.id);
  const isHTKCBNode = node.id === HETHONG_KHAMCHUABENH_ID;

  // SỬA: Luôn render tất cả các node con trong cây tổ chức, kể cả khi không có dữ liệu lương
  const hierarchicalChildren = useMemo(() =>
    node.children || [],
    [node.children, node.id]
  );
  
  const hasDisplayableHierarchicalChildrenWithData = hierarchicalChildren.length > 0;
  
  const hasDynamicChildrenToPotentiallyShow = false; // Không hiển thị các phòng khám con

  const canExpand = hasDisplayableHierarchicalChildrenWithData || (isHTKCBNode && hasDynamicChildrenToPotentiallyShow);

  // SỬA: Luôn render row nếu là node trong cây tổ chức (không cần kiểm tra có dữ liệu lương hay không)
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
            specificChildrenData={specificChildrenData} 
            isLoadingSpecificChildren={isLoadingSpecificChildren}
            expandedKeys={expandedKeys}
            toggleExpand={toggleExpand}
            formatCurrency={formatCurrency}
            renderChangeCell={renderChangeCell}
            />
        )
      )}

      {isExpanded && isHTKCBNode && hasDynamicChildrenToPotentiallyShow && (
        <>
          {isLoadingSpecificChildren && (
            <TableRow>
              <TableCell 
                colSpan={10} 
                className="py-1.5 px-2 text-xs text-muted-foreground text-center"
                style={{ paddingLeft: `${0.5 + (level + 1) * 1.25}rem` }}
              >
                <Loader2 className="h-4 w-4 animate-spin inline mr-1"/> Đang tải dữ liệu chi nhánh (HTKCB)...
              </TableCell>
            </TableRow>
          )}
          {!isLoadingSpecificChildren && DYNAMIC_CHILDREN_NAMES.map(childName => {
            const childData = specificChildrenData.get(childName);
            if (!childData || (childData.total_salary_2024 === 0 && childData.total_salary_2025 === 0)) {
                return null;
            }
            return (
              <TableRow key={`dynamic-child-${node.id}-${childName}`}>
                <TableCell
                  className="py-1.5 px-2 text-xs italic sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left"
                  style={{ paddingLeft: `${0.5 + (level + 1) * 1.25}rem` }}
                >
                   <span className="inline-block w-[calc(0.875rem+0.125rem+0.25rem)] mr-1 shrink-0"></span>
                  <span className="truncate" title={childName}>{childName}</span>
                </TableCell>
                {childData ? (
                  <>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(childData.ft_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(childData.ft_salary_2025)}</TableCell>
                    {renderChangeCell(childData.ft_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(childData.pt_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap">{formatCurrency(childData.pt_salary_2025)}</TableCell>
                    {renderChangeCell(childData.pt_salary_change_val, true)}
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(childData.total_salary_2024)}</TableCell>
                    <TableCell className="text-right py-1.5 px-2 text-xs whitespace-nowrap font-semibold">{formatCurrency(childData.total_salary_2025)}</TableCell>
                    {renderChangeCell(childData.total_salary_change_val, true)}
                  </>
                ) : (
                  Array(9).fill(null).map((_, idx) => (
                    <TableCell key={`empty-dynamic-${childName}-${idx}`} className="text-center py-1.5 px-2 text-xs whitespace-nowrap text-muted-foreground">-</TableCell>
                  ))
                )}
              </TableRow>
            );
          })}
        </>
      )}
    </>
  );
};


export default function NganhDocComparisonTable({
  selectedMonths,
  selectedNganhDoc,
  selectedDonVi2,
  orgHierarchyData,
  flatOrgUnits 
}: NganhDocComparisonTableProps) {
  const [comparisonData, setComparisonData] = useState<MergedNganhDocData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("kỳ được chọn");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set([HETHONG_KHAMCHUABENH_ID]));

  const [specificChildrenData, setSpecificChildrenData] = useState<Map<string, MergedNganhDocData>>(new Map());
  const [isLoadingSpecificChildren, setIsLoadingSpecificChildren] = useState(false);

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
        // Merge các bản ghi có cùng tên phòng khám
        const mergedByName = new Map<string, number>();
        (Array.isArray(ftRpcData) ? ftRpcData : []).forEach((item: any) => {
          const name = String(item.nganh_doc_name || item.nganh_doc_key);
          const salary = Number(item.ft_salary) || 0;
          mergedByName.set(name, (mergedByName.get(name) || 0) + salary);
        });
        ftSalaryData = Array.from(mergedByName.entries()).map(([name, salary]) => ({
          key: name,
          ft_salary: salary,
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
                // Merge các bản ghi có cùng tên phòng khám
                const mergedByName = new Map<string, number>();
                (Array.isArray(ptRpcData) ? ptRpcData : []).forEach((item: any) => {
                  const name = String(item.don_vi_2_name || item.don_vi_2_key);
                  const salary = Number(item.pt_salary) || 0;
                  mergedByName.set(name, (mergedByName.get(name) || 0) + salary);
                });
                ptSalaryData = Array.from(mergedByName.entries()).map(([name, salary]) => ({
                  key: name,
                  pt_salary: salary,
                }));
            }
        } catch (e: any) {
            if (!yearError) yearError = { type: 'generic', message: `Lỗi không xác định khi gọi RPC Lương PT (năm ${year}): ${e.message}` };
        }
    }
    return { ftData: ftSalaryData, ptData: ptSalaryData, error: yearError };
  }, [selectedMonths]);

  const fetchSpecificChildrenFinancialData = useCallback(async () => {
    setIsLoadingSpecificChildren(true);
    const newSpecificChildrenData = new Map<string, MergedNganhDocData>();
    setSpecificChildrenData(newSpecificChildrenData); // Không lấy dữ liệu cho các phòng khám con
    setIsLoadingSpecificChildren(false);
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
        
        const total_salary_2024 = finalFt2024 + finalPt2024;
        const total_salary_2025 = finalFt2025 + finalPt2025;

        // Only add to map if it has data or is HTKCB (which might have dynamic children)
        if (total_salary_2024 !== 0 || total_salary_2025 !== 0 || key === HETHONG_KHAMCHUABENH_NAME) {
            mergedMap.set(key, {
                grouping_key: key,
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
    });
    
    setComparisonData(Array.from(mergedMap.values())); 

    await fetchSpecificChildrenFinancialData();

    setIsLoading(false);
  }, [selectedMonths, fetchDataForYear, selectedNganhDoc, selectedDonVi2, fetchSpecificChildrenFinancialData]);


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
    // Filter out explicitly excluded keys UNLESS it's HTKCB, which has special handling
    return medlatecGroupNode.children.filter(child => 
        !EXCLUDED_NGANHDOC_KEYS_SET.has(child.name.trim()) || child.id === HETHONG_KHAMCHUABENH_ID
    );
  }, [medlatecGroupNode]);


  const totals = useMemo(() => {
    const defaultTotals = {
        ft_salary_2024: 0, ft_salary_2025: 0, pt_salary_2024: 0, pt_salary_2025: 0,
        total_salary_2024: 0, total_salary_2025: 0,
        ft_salary_change_val: null, pt_salary_change_val: null, total_salary_change_val: null,
      };
    if (!medlatecGroupNode) return defaultTotals;
    
    // Calculate totals for Medlatec Group including its hierarchical children and specific dynamic children of HTKCB
    const medlatecAggregated = getAggregatedDataForNode(medlatecGroupNode, dataMapForHierarchy);
    let finalTotals = medlatecAggregated ? { ...medlatecAggregated } : { ...defaultTotals, grouping_key: "Medlatec Group" };

    // Add specific children data of HTKCB to the Medlatec Group total if HTKCB is a child of Medlatec Group
    const htkcbNodeFromMedlatecChildren = medlatecGroupNode.children.find(c => c.id === HETHONG_KHAMCHUABENH_ID);
    if (htkcbNodeFromMedlatecChildren) {
        specificChildrenData.forEach(childData => {
            finalTotals.ft_salary_2024 += childData.ft_salary_2024;
            finalTotals.ft_salary_2025 += childData.ft_salary_2025;
            finalTotals.pt_salary_2024 += childData.pt_salary_2024;
            finalTotals.pt_salary_2025 += childData.pt_salary_2025;
        });
        finalTotals.total_salary_2024 = finalTotals.ft_salary_2024 + finalTotals.pt_salary_2024;
        finalTotals.total_salary_2025 = finalTotals.ft_salary_2025 + finalTotals.pt_salary_2025;
        finalTotals.ft_salary_change_val = calculateChange(finalTotals.ft_salary_2025, finalTotals.ft_salary_2024);
        finalTotals.pt_salary_change_val = calculateChange(finalTotals.pt_salary_2025, finalTotals.pt_salary_2024);
        finalTotals.total_salary_change_val = calculateChange(finalTotals.total_salary_2025, finalTotals.total_salary_2024);
    }
    
    return finalTotals;

  }, [medlatecGroupNode, dataMapForHierarchy, specificChildrenData]);


  const formatCurrency = (value: number | null) => { if (value === null || value === undefined) return 'N/A'; return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value); };

  const formatChangeValue = (value: number | null, forceSign = false) => {
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
        colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'; Icon = TrendingUp;
    } else if (change === -Infinity) {
        colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'; Icon = TrendingDown;
    } else if (change > 0) {
        colorClass = isCost ? 'text-red-600 dark:text-red-500' : 'text-green-600 dark:text-green-500'; Icon = TrendingUp;
    } else if (change < 0) {
        colorClass = isCost ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'; Icon = TrendingDown;
    }
    const displayVal = formatChangeValue(change, true);
    return ( <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}> <div className="flex items-center justify-center gap-0.5"> <Icon className="h-3 w-3" /> {displayVal} </div> </TableCell> );
  };

  const noDataForMedlatecGroup = !medlatecGroupNode;
  
  const hasRenderableNodes = useMemo(() => {
      if (!medlatecGroupNode || !medlatecGroupNode.children) return false;
      return nodesToRender.some(childNode => {
         const aggData = getAggregatedDataForNode(childNode, dataMapForHierarchy);
         // Check if this node has data OR if it's HTKCB and has dynamic children with data
         const hasNodeData = aggData !== null && (aggData.total_salary_2024 !== 0 || aggData.total_salary_2025 !== 0);
         const isHTKCBWithDynamicData = childNode.id === HETHONG_KHAMCHUABENH_ID && DYNAMIC_CHILDREN_NAMES.some(name => {
            const dynamicChild = specificChildrenData.get(name);
            return dynamicChild && (dynamicChild.total_salary_2024 !==0 || dynamicChild.total_salary_2025 !==0);
         });
         return hasNodeData || isHTKCBWithDynamicData;
      });
  }, [medlatecGroupNode, nodesToRender, dataMapForHierarchy, specificChildrenData]);


  if (isLoading) { return ( <Card className="mt-4 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu so sánh chi tiết...</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center flex-grow"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { return ( <Card className="mt-4 border-destructive/50 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1.5"> <AlertTriangle className="h-4 w-4" /> Lỗi Tải Bảng Ngành Dọc/Đơn Vị 2 </CardTitle> </CardHeader> <CardContent className="pt-2 flex-grow"> <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p> {(error.message.includes(CRITICAL_SETUP_ERROR_PREFIX) || error.type === 'rpcMissing' || error.message.toLowerCase().includes("does not exist") || error.message.includes("RPC")) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> {CRITICAL_SETUP_ERROR_PREFIX} Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các hàm RPC `get_nganhdoc_ft_salary_hanoi` và `get_donvi2_pt_salary` trong Supabase theo hướng dẫn tại README.md. Đảm bảo các bảng `Fulltime` (với cột `nganh_doc`, `hn_or_note`) và `Parttime` (với cột `Don_vi_2`) tồn tại và có dữ liệu. </p> )} </CardContent> </Card> ); }

  if (noDataForMedlatecGroup) {
     return ( <Card className="mt-4 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}> {filterDescription}. </CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center flex-grow"> <p className="text-sm text-muted-foreground">Không tìm thấy "Medlatec Group" trong dữ liệu cơ cấu tổ chức hoặc không có dữ liệu cho nhóm này.</p> </CardContent> </Card> );
  }
  if (!hasRenderableNodes && !isLoadingSpecificChildren) {
     return ( <Card className="mt-4 flex-grow flex flex-col"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}> {filterDescription}. </CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center flex-grow"> <p className="text-sm text-muted-foreground">Không có đơn vị con nào thuộc "Medlatec Group" có dữ liệu để hiển thị sau khi lọc.</p> </CardContent> </Card> );
  }


  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" />Bảng so sánh theo Ngành dọc (Hà Nội FT) & Đơn vị 2 (PT)</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
            {filterDescription}. Chỉ hiển thị các đơn vị thuộc Medlatec Group.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px]">Ngành dọc/Đơn vị/Chi nhánh</TableHead>
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
              {nodesToRender.map(rootNode => (
                <RenderTableRow
                  key={rootNode.id}
                  node={rootNode}
                  level={0}
                  dataMap={dataMapForHierarchy}
                  specificChildrenData={specificChildrenData}
                  isLoadingSpecificChildren={isLoadingSpecificChildren}
                  expandedKeys={expandedKeys}
                  toggleExpand={toggleExpand}
                  formatCurrency={formatCurrency}
                  renderChangeCell={renderChangeCell}
                />
              ))}
            </TableBody>
            <TableFooter className="sticky bottom-0 bg-card z-10">
              <TableRow>
                <TableCell className="py-1.5 px-2 text-xs font-bold text-left sticky left-0 bg-card z-10">Tổng Cộng (Medlatec Group)</TableCell>
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


    