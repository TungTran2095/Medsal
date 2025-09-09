"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight, Expand } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrgNode {
  id: string;
  name: string;
  children?: OrgNode[];
}

interface MonthlySalaryHanoiTableProps {
  orgHierarchyData: OrgNode[];
  flatOrgUnits: any[];
}

type SortKey = 'department_name' | 'ft_salary_month' | 'pt_salary_month' | 'total_salary_month' | 'chi_tieu' | 'doanh_thu_thuc_hien' | 'ty_le_hoan_thanh' | 'quy_luong_chuan' | 'quy_luong_cho_phep' | 'quy_luong_con_lai' | 'quy_luong_con_lai_duoc_chia' | 'chenh_lech_quy_luong_cho_phep' | 'chenh_lech_quy_luong_con_lai';
type SortDir = 'asc' | 'desc';

export default function MonthlySalaryHanoiTable({ orgHierarchyData, flatOrgUnits }: MonthlySalaryHanoiTableProps) {
  const [salaryData, setSalaryData] = useState<Record<string, any>>({});
  const [selectedMonth, setSelectedMonth] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total_salary_month');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Thử sử dụng function cho Hà Nội nếu có, nếu không thì dùng function tỉnh và filter
        let salaryRows;
        let salaryError;
        
        // Thử function Hà Nội trước
        const { data: hanoiRows, error: hanoiError } = await supabase.rpc('get_simple_monthly_salary_hanoi', {
          p_filter_year: 2025,
          p_filter_month: selectedMonth,
          p_so_thang_da_chia: selectedMonth // Sử dụng selectedMonth làm soThangDaChia
        });
        
        if (!hanoiError && hanoiRows) {
          salaryRows = hanoiRows;
          console.log('✅ Sử dụng function Hà Nội:', hanoiRows.length, 'rows');
          console.log('🔍 Dữ liệu Hà Nội mới:', hanoiRows);
          // Debug quy_cung_2025 và total_salary_month
          hanoiRows.forEach((row: any, index: number) => {
            if (index < 5) { // Log 5 dòng đầu
              console.log(`🔍 Row ${index}:`, {
                department_name: row.department_name,
                quy_cung_2025: row.quy_cung_2025,
                total_salary_month: row.total_salary_month,
                total_salary_2025: row.total_salary_2025,
                cumulative_total_salary: row.cumulative_total_salary,
                cumulative_salary_revenue_ratio: row.cumulative_salary_revenue_ratio,
                quy_luong_con_lai_duoc_chia: row.quy_luong_con_lai_duoc_chia
              });
            }
          });
        } else {
          console.log('⚠️ Function Hà Nội chưa có, lỗi:', hanoiError?.message);
          // Fallback về function tỉnh và filter
          const { data: provinceRows, error: provinceError } = await supabase.rpc('get_simple_monthly_salary_province', {
            p_filter_year: 2025,
            p_filter_month: selectedMonth
          });
          
          salaryRows = provinceRows;
          salaryError = provinceError;
          console.log('⚠️ Fallback về function tỉnh:', provinceRows?.length || 0, 'rows');
        }

        if (salaryError) {
          setError(salaryError.message);
          setIsLoading(false);
          return;
        }

        // Nếu dùng function tỉnh, filter chỉ lấy các đơn vị tại Hà Nội
        let hanoiData = salaryRows || [];
        if (hanoiError || !hanoiRows) {
          // Thử filter trước, nếu không có kết quả thì lấy tất cả
          const filteredData = (salaryRows || []).filter((row: any) => {
            const departmentName = row.department_name?.trim() || '';
            return departmentName.toLowerCase().includes('hà nội') || 
                   departmentName.toLowerCase().includes('hanoi') ||
                   departmentName.toLowerCase().includes('hn') ||
                   departmentName.toLowerCase().includes('ha noi');
          });
          
          // Nếu filter có kết quả thì dùng, nếu không thì lấy tất cả (có thể tất cả đều là Hà Nội)
          hanoiData = filteredData.length > 0 ? filteredData : (salaryRows || []);
          console.log('🔍 Filtered data length:', filteredData.length, 'Using all data:', filteredData.length === 0);
        }

        console.log('🔍 Dữ liệu gốc:', salaryRows?.length || 0, 'rows');
        console.log('🔍 Tất cả department names:', salaryRows?.map((r: any) => r.department_name) || []);
        console.log('🔍 Dữ liệu Hà Nội sau filter:', hanoiData.length, 'rows');
        console.log('🔍 Các đơn vị Hà Nội:', hanoiData.map((r: any) => r.department_name));
        console.log('🔍 Chi tiết dữ liệu Hà Nội:', hanoiData);
        
        // Debug: Kiểm tra dữ liệu cho các đơn vị cụ thể
        const debugUnits = ['ban kế hoạch', 'hệ thống cđha tdcn', 'hệ thống kcb ngoại viện'];
        debugUnits.forEach(unit => {
          const found = hanoiData.find((r: any) => 
            r.department_name?.toLowerCase().includes(unit) || 
            unit.includes(r.department_name?.toLowerCase() || '')
          );
          console.log(`🔍 Debug unit "${unit}":`, found || 'NOT FOUND');
        });

        // Map theo tên department_name để tra cứu nhanh
        const map: Record<string, any> = {};
        hanoiData.forEach((row: any) => {
          const key = row.department_name?.trim() || '';
          map[key] = row;
          console.log('📝 Mapping:', key, '->', row);
        });
        console.log('📊 Final salary data map:', map);
        setSalaryData(map);
      } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra khi tải dữ liệu');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [selectedMonth]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(value);
  };

  // Tính quỹ lương cho phép theo logic:
  // - Nếu tỷ lệ hoàn thành < 70% thì tỷ lệ = 70%
  // - Nếu 70% <= tỷ lệ < 95% thì tỷ lệ = tỷ lệ hoàn thành
  // - Nếu tỷ lệ >= 95% thì tỷ lệ = tỷ lệ hoàn thành + 5% nhưng không vượt quá 130%
  const calculateQuyLuongChoPhep = (quyLuongChuan: number, tyLeHoanThanh: number): number => {
    if (!quyLuongChuan || quyLuongChuan <= 0) return 0;
    
    let tyLe = tyLeHoanThanh;
    
    if (tyLe < 0.7) {
      tyLe = 0.7; // 70%
    } else if (tyLe >= 0.7 && tyLe < 0.95) {
      tyLe = tyLe; // Giữ nguyên tỷ lệ hoàn thành
    } else if (tyLe >= 0.95) {
      tyLe = Math.min(tyLe + 0.05, 1.3); // +5% nhưng không vượt quá 130%
    }
    
    return quyLuongChuan * tyLe;
  };

  // Tính quỹ lương còn lại được chia (giống như bảng KPI)
  const calculateQuyLuongConLai = (quyCung: number, totalSalary: number, thangConLai: number): number => {
    console.log('🧮 Calculating quy_luong_con_lai:', { quyCung, totalSalary, thangConLai });
    if (thangConLai <= 0 || quyCung === undefined || quyCung === null || totalSalary === undefined || totalSalary === null) {
      console.log('❌ Invalid values for quy_luong_con_lai calculation');
      return 0;
    }
    const result = (quyCung - totalSalary) / thangConLai;
    console.log('✅ quy_luong_con_lai result:', result);
    return result;
  };

  // Tính số tháng còn lại dựa trên tháng được chọn
  const getThangConLai = (): number => {
    return Math.max(12 - selectedMonth, 0);
  };

  // Lấy số tháng đã chia = tháng được chọn
  const getThangDaChia = (): number => {
    return selectedMonth;
  };

  // Tính chênh lệch quỹ lương cho phép
  const calculateChenhLechQuyLuongChoPhep = (totalSalaryMonth: number, quyLuongChoPhep: number): number => {
    return totalSalaryMonth - quyLuongChoPhep;
  };

  // Tính chênh lệch quỹ lương còn lại
  const calculateChenhLechQuyLuongConLai = (totalSalaryMonth: number, quyLuongConLai: number): number => {
    return totalSalaryMonth - quyLuongConLai;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3" />;
    }
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const toggleExpand = (nodeId: string) => {
    const newExpandedKeys = new Set(expandedKeys);
    if (newExpandedKeys.has(nodeId)) {
      newExpandedKeys.delete(nodeId);
    } else {
      newExpandedKeys.add(nodeId);
    }
    setExpandedKeys(newExpandedKeys);
  };

  const toggleTableExpand = () => {
    const newExpandedState = !isExpanded;
    console.log('🔄 Toggle table expand:', { isExpanded, newExpandedState });
    setIsExpanded(newExpandedState);
    
    // Nếu đang mở rộng, cũng mở tất cả các node
    if (newExpandedState) {
      console.log('📂 Expanding all nodes');
      expandAllNodes();
    } else {
      // Nếu đang thu gọn, đóng tất cả các node
      console.log('📁 Collapsing all nodes');
      setExpandedKeys(new Set());
    }
  };

  const expandAllNodes = () => {
    const allNodeIds = new Set<string>();
    
    const collectNodeIds = (nodes: OrgNode[]) => {
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          allNodeIds.add(node.id);
          collectNodeIds(node.children);
        }
      });
    };
    
    collectNodeIds(orgHierarchyData);
    setExpandedKeys(allNodeIds);
  };

  // Lấy giá trị chi_tieu riêng cho từng đơn vị
  const getChiTieuForNode = (node: OrgNode, dataMap: Record<string, any>): number => {
    const nodeData = findSalaryDataForNode(node, dataMap);
    return nodeData?.chi_tieu || 0;
  };

  const aggregateSalaryForNode = (node: OrgNode, dataMap: Record<string, any>): any => {
    if (!node) return null;
    
    // Tìm dữ liệu lương cho node này bằng cách so sánh tên
    const nodeData = findSalaryDataForNode(node, dataMap);
    const thangConLai = getThangConLai();
    
    // Debug dữ liệu cho node này
    if (node.name.toLowerCase().includes('med group')) {
      console.log('🔍 Debug for Med Group:', {
        nodeName: node.name,
        nodeData: nodeData,
        thangConLai: thangConLai,
        quy_cung_2025: nodeData?.quy_cung_2025,
        total_salary_2025: nodeData?.total_salary_2025,
        cumulative_total_salary: nodeData?.cumulative_total_salary
      });
    }
    
    // Debug dữ liệu cho Trung tâm KHDN
    if (node.name.toLowerCase().includes('khdn')) {
      console.log('🔍 Debug for KHDN:', {
        nodeName: node.name,
        nodeData: nodeData,
        hasChildren: node.children && node.children.length > 0,
        childrenCount: node.children?.length || 0,
        childrenNames: node.children?.map(c => c.name) || []
      });
    }
    
    // Debug dữ liệu cho Med Group
    if (node.name.toLowerCase().includes('med group')) {
      console.log('🔍 Debug for Med Group:', {
        nodeName: node.name,
        nodeData: nodeData,
        hasChildren: node.children && node.children.length > 0,
        childrenCount: node.children?.length || 0,
        childrenNames: node.children?.map(c => c.name) || [],
        ft_salary_month: nodeData?.ft_salary_month,
        pt_salary_month: nodeData?.pt_salary_month,
        total_salary_month: nodeData?.total_salary_month
      });
    }
    
    
    // Tính total_salary_month từ ft_salary_month + pt_salary_month như trong SQL function
    const ftSalary = nodeData.ft_salary_month || 0;
    const ptSalary = nodeData.pt_salary_month || 0;
    
    // Đặc biệt cho "Hệ thống KCB ngoại viện": không tính PT salary vào tổng
    const totalSalary = node.name.toLowerCase().includes('hệ thống kcb ngoại viện') 
      ? ftSalary 
      : ftSalary + ptSalary;
    
    // Tính lại quỹ lương cho phép và còn lại dựa trên total_salary_month đã điều chỉnh
    const adjustedQuyLuongChoPhep = calculateQuyLuongChoPhep(nodeData.quy_luong_chuan || 0, nodeData.ty_le_hoan_thanh || 0);
    // Sử dụng total_salary_month đã điều chỉnh (không bao gồm PT salary cho Hệ thống KCB ngoại viện)
    const adjustedQuyLuongConLai = nodeData.quy_luong_con_lai_duoc_chia || calculateQuyLuongConLai(nodeData.quy_cung_2025 || 0, totalSalary, thangConLai);
    
    let aggregated = {
      ft_salary_month: ftSalary,
      pt_salary_month: ptSalary,
      total_salary_month: totalSalary, // Sử dụng total_salary_month đã điều chỉnh
      chi_tieu: nodeData.chi_tieu || 0, // Sử dụng chỉ tiêu riêng của đơn vị này
      doanh_thu_thuc_hien: nodeData.doanh_thu_thuc_hien || 0, // Sử dụng doanh thu thực hiện riêng của đơn vị này
      ty_le_hoan_thanh: nodeData.ty_le_hoan_thanh || 0, // Sử dụng tỷ lệ hoàn thành riêng của đơn vị này
      quy_luong_chuan: nodeData.quy_luong_chuan || 0, // Sử dụng quỹ lương chuẩn riêng của đơn vị này
      quy_luong_cho_phep: adjustedQuyLuongChoPhep, // Tính quỹ lương cho phép dựa trên total_salary_month đã điều chỉnh
      quy_luong_con_lai: adjustedQuyLuongConLai, // Tính quỹ lương còn lại dựa trên total_salary_month đã điều chỉnh
      chenh_lech_quy_luong_cho_phep: calculateChenhLechQuyLuongChoPhep(totalSalary, adjustedQuyLuongChoPhep),
      chenh_lech_quy_luong_con_lai: calculateChenhLechQuyLuongConLai(totalSalary, adjustedQuyLuongConLai)
    };

    // Tính tổng từ các node con (trừ chi_tieu vì nó là tổng chung)
    if (node.children && node.children.length > 0) {
      // Reset các giá trị lương về 0 để chỉ hiển thị tổng từ children
      aggregated.ft_salary_month = 0;
      aggregated.pt_salary_month = 0;
      aggregated.quy_luong_chuan = 0;
      aggregated.quy_luong_cho_phep = 0;
      aggregated.quy_luong_con_lai = 0;
      aggregated.chenh_lech_quy_luong_cho_phep = 0;
      aggregated.chenh_lech_quy_luong_con_lai = 0;
      
      node.children.forEach(child => {
        const childAgg = aggregateSalaryForNode(child, dataMap);
        if (childAgg) {
          aggregated.ft_salary_month += childAgg.ft_salary_month;
          aggregated.pt_salary_month += childAgg.pt_salary_month;
          aggregated.quy_luong_chuan += childAgg.quy_luong_chuan;
          aggregated.quy_luong_cho_phep += childAgg.quy_luong_cho_phep;
          aggregated.quy_luong_con_lai += childAgg.quy_luong_con_lai;
          // chi_tieu không cộng dồn, giữ nguyên giá trị từ nodeData
          
          // Debug cho Med Group
          if (node.name.toLowerCase().includes('med group')) {
            console.log('🔍 Med Group child:', child.name, 'data:', childAgg);
          }
        }
      });
      
      // Debug tổng sau khi cộng dồn cho Med Group
      if (node.name.toLowerCase().includes('med group')) {
        console.log('🔍 Med Group after aggregation:', {
          nodeName: node.name,
          aggregated: aggregated,
          childrenCount: node.children.length,
          originalData: nodeData
        });
      }
      
      // Tính lại total_salary_month sau khi cộng dồn từ children
      // Đặc biệt cho "Hệ thống KCB ngoại viện": không tính PT salary vào tổng
      if (node.name.toLowerCase().includes('hệ thống kcb ngoại viện')) {
        aggregated.total_salary_month = aggregated.ft_salary_month;
      } else {
        aggregated.total_salary_month = aggregated.ft_salary_month + aggregated.pt_salary_month;
      }
      
      // Tính lại các giá trị chênh lệch sau khi cộng dồn
      // Sử dụng total_salary_month đã được điều chỉnh (không bao gồm PT salary cho Hệ thống KCB ngoại viện)
      aggregated.chenh_lech_quy_luong_cho_phep = calculateChenhLechQuyLuongChoPhep(aggregated.total_salary_month, aggregated.quy_luong_cho_phep);
      aggregated.chenh_lech_quy_luong_con_lai = calculateChenhLechQuyLuongConLai(aggregated.total_salary_month, aggregated.quy_luong_con_lai);
      
      // Đặc biệt cho "Hệ thống KCB ngoại viện": tính lại quỹ lương cho phép và còn lại dựa trên total_salary_month đã điều chỉnh
      if (node.name.toLowerCase().includes('hệ thống kcb ngoại viện')) {
        // Tính lại quỹ lương cho phép dựa trên tỷ lệ hoàn thành và quỹ lương chuẩn
        aggregated.quy_luong_cho_phep = calculateQuyLuongChoPhep(aggregated.quy_luong_chuan || 0, aggregated.ty_le_hoan_thanh || 0);
        
        // Tính lại quỹ lương còn lại dựa trên quỹ cứng 2025 và total_salary_month đã điều chỉnh
        const quyCung2025 = nodeData?.quy_cung_2025 || 0;
        const thangConLai = 12 - selectedMonth;
        aggregated.quy_luong_con_lai = calculateQuyLuongConLai(quyCung2025, aggregated.total_salary_month, thangConLai);
        
        // Tính lại các giá trị chênh lệch với quỹ lương đã điều chỉnh
        aggregated.chenh_lech_quy_luong_cho_phep = calculateChenhLechQuyLuongChoPhep(aggregated.total_salary_month, aggregated.quy_luong_cho_phep);
        aggregated.chenh_lech_quy_luong_con_lai = calculateChenhLechQuyLuongConLai(aggregated.total_salary_month, aggregated.quy_luong_con_lai);
      }
    }

    // Nếu là node cha và không có dữ liệu trực tiếp, thử tìm dữ liệu từ các đơn vị con trong RPC
    if ((!nodeData || (!nodeData.ft_salary_month && !nodeData.pt_salary_month)) && node.children && node.children.length > 0) {
      const childNames = node.children.map(child => child.name.toLowerCase());
        let totalFromChildren = { ft_salary_month: 0, pt_salary_month: 0, total_salary_month: 0, chi_tieu: 0, doanh_thu_thuc_hien: 0, ty_le_hoan_thanh: 0, quy_luong_chuan: 0, quy_luong_cho_phep: 0, quy_luong_con_lai: 0, chenh_lech_quy_luong_cho_phep: 0, chenh_lech_quy_luong_con_lai: 0 };
      
      for (const [key, data] of Object.entries(dataMap)) {
        const keyLower = key.toLowerCase();
        if (childNames.some(childName => keyLower.includes(childName) || childName.includes(keyLower))) {
          const childFtSalary = data.ft_salary_month || 0;
          const childPtSalary = data.pt_salary_month || 0;
          // Đặc biệt cho "Hệ thống KCB ngoại viện": không tính PT salary vào tổng
          // Kiểm tra tên của child thay vì tên của node cha
          const isChildKCB = childNames.some(childName => 
            childName.includes('hệ thống kcb ngoại viện') || 
            keyLower.includes('hệ thống kcb ngoại viện')
          );
          const childTotalSalary = isChildKCB 
            ? childFtSalary 
            : childFtSalary + childPtSalary;
          
          totalFromChildren.ft_salary_month += childFtSalary;
          totalFromChildren.pt_salary_month += childPtSalary;
          totalFromChildren.doanh_thu_thuc_hien += data.doanh_thu_thuc_hien || 0;
          totalFromChildren.ty_le_hoan_thanh += data.ty_le_hoan_thanh || 0;
          totalFromChildren.quy_luong_chuan += data.quy_luong_chuan || 0;
          const childQuyLuongChoPhep = calculateQuyLuongChoPhep(data.quy_luong_chuan || 0, data.ty_le_hoan_thanh || 0);
          // Sử dụng childTotalSalary đã điều chỉnh (không bao gồm PT salary cho Hệ thống KCB ngoại viện)
          const childQuyLuongConLai = data.quy_luong_con_lai_duoc_chia || calculateQuyLuongConLai(data.quy_cung_2025 || 0, childTotalSalary, thangConLai);
          totalFromChildren.quy_luong_cho_phep += childQuyLuongChoPhep;
          totalFromChildren.quy_luong_con_lai += childQuyLuongConLai;
          totalFromChildren.chenh_lech_quy_luong_cho_phep += calculateChenhLechQuyLuongChoPhep(childTotalSalary, childQuyLuongChoPhep);
          totalFromChildren.chenh_lech_quy_luong_con_lai += calculateChenhLechQuyLuongConLai(childTotalSalary, childQuyLuongConLai);
          // chi_tieu không cộng dồn, giữ nguyên giá trị từ nodeData
          console.log('🔗 Adding child data:', key, 'to', node.name, data);
        }
      }
      
      // Debug cho Trung tâm KHDN
      if (node.name.toLowerCase().includes('khdn')) {
        console.log('🔍 KHDN Children Debug:', {
          nodeName: node.name,
          childNames: childNames,
          totalFromChildren: totalFromChildren,
          dataMapKeys: Object.keys(dataMap).filter(key => 
            childNames.some(childName => 
              key.toLowerCase().includes(childName) || childName.includes(key.toLowerCase())
            )
          )
        });
      }
      
      // Tính total_salary_month từ tổng ft_salary_month + pt_salary_month
      // Đặc biệt cho "Hệ thống KCB ngoại viện": không tính PT salary vào tổng
      if (node.name.toLowerCase().includes('hệ thống kcb ngoại viện')) {
        totalFromChildren.total_salary_month = totalFromChildren.ft_salary_month;
      } else {
        totalFromChildren.total_salary_month = totalFromChildren.ft_salary_month + totalFromChildren.pt_salary_month;
      }
      
      if (totalFromChildren.total_salary_month > 0) {
        aggregated = {
          ...totalFromChildren,
          chi_tieu: getChiTieuForNode(node, dataMap), // Sử dụng chỉ tiêu riêng của node này
          doanh_thu_thuc_hien: totalFromChildren.doanh_thu_thuc_hien, // Sử dụng doanh thu thực hiện từ children
          ty_le_hoan_thanh: totalFromChildren.ty_le_hoan_thanh, // Sử dụng tỷ lệ hoàn thành từ children
          quy_luong_chuan: totalFromChildren.quy_luong_chuan, // Sử dụng quỹ lương chuẩn từ children
          quy_luong_cho_phep: totalFromChildren.quy_luong_cho_phep, // Sử dụng quỹ lương cho phép từ children
          quy_luong_con_lai: totalFromChildren.quy_luong_con_lai, // Sử dụng quỹ lương còn lại từ children
          chenh_lech_quy_luong_cho_phep: totalFromChildren.chenh_lech_quy_luong_cho_phep,
          chenh_lech_quy_luong_con_lai: totalFromChildren.chenh_lech_quy_luong_con_lai
        };
        
        // Đặc biệt cho "Hệ thống KCB ngoại viện": tính lại quỹ lương cho phép và còn lại dựa trên total_salary_month đã điều chỉnh
        if (node.name.toLowerCase().includes('hệ thống kcb ngoại viện')) {
          // Tính lại quỹ lương cho phép dựa trên tỷ lệ hoàn thành và quỹ lương chuẩn
          aggregated.quy_luong_cho_phep = calculateQuyLuongChoPhep(aggregated.quy_luong_chuan || 0, aggregated.ty_le_hoan_thanh || 0);
          
          // Tính lại quỹ lương còn lại dựa trên quỹ cứng 2025 và total_salary_month đã điều chỉnh
          const quyCung2025 = nodeData?.quy_cung_2025 || 0;
          const thangConLai = 12 - selectedMonth;
          aggregated.quy_luong_con_lai = calculateQuyLuongConLai(quyCung2025, aggregated.total_salary_month, thangConLai);
          
          // Tính lại các giá trị chênh lệch với quỹ lương đã điều chỉnh
          aggregated.chenh_lech_quy_luong_cho_phep = calculateChenhLechQuyLuongChoPhep(aggregated.total_salary_month, aggregated.quy_luong_cho_phep);
          aggregated.chenh_lech_quy_luong_con_lai = calculateChenhLechQuyLuongConLai(aggregated.total_salary_month, aggregated.quy_luong_con_lai);
        }
        
        console.log('📊 Aggregated from children:', node.name, aggregated);
      }
    }

    return aggregated;
  };

  const findSalaryDataForNode = (node: OrgNode, dataMap: Record<string, any>): any => {
    if (!node || !node.name) return {};
    
    // Bỏ các đơn vị không cần thiết
    const excludedUnits = ['med pharma', 'medaz', 'medcom', 'medicons', 'medim', 'medon'];
    const nodeNameLower = node.name.toLowerCase();
    if (excludedUnits.some(unit => nodeNameLower.includes(unit))) {
      return {};
    }
    
    console.log('🔍 Finding data for node:', node.name);
    
    // Thử tìm exact match trước
    let nodeData = dataMap[node.name.trim()] || dataMap[node.name.trim().toLowerCase()];
    if (nodeData) {
      console.log('✅ Exact match found:', node.name, '->', nodeData);
      return nodeData;
    }
    
    // Thử tìm partial match với các từ khóa chính (chỉ áp dụng cho một số trường hợp đặc biệt)
    const keywords = nodeNameLower.split(' ').filter(word => word.length > 3);
    for (const [key, data] of Object.entries(dataMap)) {
      const keyLower = key.toLowerCase();
      // Chỉ match nếu có ít nhất 2 từ khóa trùng nhau và độ dài tên tương đối gần nhau
      const matchingKeywords = keywords.filter(keyword => keyLower.includes(keyword) || keyword.includes(keyLower));
      if (matchingKeywords.length >= 2 && Math.abs(nodeNameLower.length - keyLower.length) < 20) {
        console.log('✅ Partial match found:', node.name, '->', key, data);
        return data;
      }
    }
    
    // Mapping đặc biệt cho các node cha
    const specialMappings: Record<string, string[]> = {
      'med group': ['medaz', 'medcom', 'medicons', 'medim', 'medon', 'med pharma'],
      'medlatec group': ['medlatec', 'medlatec group'],
      'meddom': ['meddom'],
      'med việt nam': ['med việt nam', 'med viet nam']
    };
    
    const nodeNameKey = nodeNameLower;
    if (specialMappings[nodeNameKey]) {
      for (const pattern of specialMappings[nodeNameKey]) {
        for (const [key, data] of Object.entries(dataMap)) {
          const keyLower = key.toLowerCase();
          if (keyLower.includes(pattern) || pattern.includes(keyLower)) {
            console.log('🎯 Special mapping found:', nodeNameKey, '->', key, data);
            return data;
          }
        }
      }
    }
    
    // Thử tìm partial match
    for (const [key, data] of Object.entries(dataMap)) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes(nodeNameLower) || nodeNameLower.includes(keyLower)) {
        console.log('🔍 Partial match found:', nodeNameKey, '->', key, data);
        return data;
      }
    }
    
    // Thử tìm trong children nếu có
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        const childData = findSalaryDataForNode(child, dataMap);
        if (childData && (childData.ft_salary_month || childData.pt_salary_month)) {
          console.log('👶 Child data found:', nodeNameKey, '->', child.name, childData);
          return childData;
        }
      }
    }
    
    // Đặc biệt cho các phòng khám Medlatec - tạo dữ liệu giả nếu không tìm thấy
    if (nodeNameLower.includes('tây hồ') || nodeNameLower.includes('cầu giấy') || 
        nodeNameLower.includes('thanh xuân') || nodeNameLower.includes('medlatec')) {
      console.log('🔧 Creating placeholder data for Medlatec unit:', nodeNameKey);
        return {
          ft_salary_month: 0,
          pt_salary_month: 0,
          total_salary_month: 0,
           chi_tieu: 0, // Sẽ được tính từ SQL function
           doanh_thu_thuc_hien: 0, // Sẽ được tính từ SQL function
           ty_le_hoan_thanh: 0, // Sẽ được tính từ SQL function
           quy_luong_chuan: 0, // Sẽ được tính từ SQL function
           quy_luong_cho_phep: 0, // Sẽ được tính từ quy_luong_chuan và ty_le_hoan_thanh
           quy_luong_con_lai: 0 // Sẽ được tính từ quy_cung_2025 và total_salary_2025
        };
    }
    
    console.log('❌ No data found for:', nodeNameKey);
    return {};
  };

  const renderRows = (nodes: OrgNode[], level = 0): React.ReactNode[] => {
    console.log('🌳 Rendering nodes:', nodes.length, 'nodes');
    console.log('🌳 Salary data keys:', Object.keys(salaryData));
    console.log('🌳 Salary data values:', Object.values(salaryData));
    console.log('🌳 Org hierarchy structure:', nodes.map(n => ({ name: n.name, children: n.children?.length || 0 })));
    
    // Tạo các đơn vị con cho "Hệ thống khám chữa bệnh" nếu chúng chưa tồn tại
    const enhancedNodes = nodes.map(node => {
      if (node.name.toLowerCase().includes('hệ thống khám chữa bệnh')) {
        const existingChildren = node.children || [];
        const requiredChildren = [
          { id: 'med-tay-ho', name: 'Phòng khám Medlatec Tây Hồ', children: [] },
          { id: 'med-cau-giay', name: 'Phòng khám Medlatec Cầu Giấy', children: [] },
          { id: 'med-thanh-xuan', name: 'Phòng khám Medlatec Thanh Xuân', children: [] }
        ];
        
        // Chỉ thêm các đơn vị con nếu chúng chưa tồn tại
        const missingChildren = requiredChildren.filter(reqChild => {
          const hasExisting = existingChildren.some(existing => 
            existing.name.toLowerCase().includes('tây hồ') ||
            existing.name.toLowerCase().includes('cầu giấy') ||
            existing.name.toLowerCase().includes('thanh xuân')
          );
          return !hasExisting;
        });
        
        if (missingChildren.length > 0) {
          console.log('🔧 Adding missing Medlatec children to Hệ thống khám chữa bệnh:', missingChildren);
          return {
            ...node,
            children: [...existingChildren, ...missingChildren]
          };
        }
      }
      return node;
    });
    
    return enhancedNodes.flatMap(node => {
      // Bỏ các đơn vị không cần thiết
      const excludedUnits = ['med pharma', 'medaz', 'medcom', 'medicons', 'medim', 'medon'];
      const nodeNameLower = node.name.toLowerCase();
      if (excludedUnits.some(unit => nodeNameLower.includes(unit))) {
        console.log('🚫 Excluding node:', node.name);
        return [];
      }
      
      // Ẩn các Trung tâm KHDN không cần thiết
      if (nodeNameLower.includes('khdn') && 
          (nodeNameLower.includes('hà nội 2') || 
           nodeNameLower.includes('miền bắc') || 
           nodeNameLower.includes('miền trung') || 
           nodeNameLower.includes('miền nam'))) {
        console.log('🚫 Hiding KHDN node:', node.name);
        return [];
      }
      
      // Xóa hoàn toàn Trung tâm KD BV/PK
      if (nodeNameLower.includes('trung tâm kd bv/pk')) {
        console.log('🚫 Removing KD BV/PK node:', node.name);
        return [];
      }
      
      // Xóa đơn vị con "Phòng Vận hành" của "Trung tâm tại nhà Toàn quốc"
      if (nodeNameLower.includes('phòng vận hành')) {
        console.log('🚫 Removing Phòng Vận hành:', node.name);
        return [];
      }
      
      // Xóa Med Campuchia khỏi bảng Hà Nội
      if (nodeNameLower.includes('med campuchia') || nodeNameLower.includes('campuchia')) {
        console.log('🚫 Removing Med Campuchia:', node.name);
        return [];
      }
      
      const agg = aggregateSalaryForNode(node, salaryData);
      console.log('🌳 Node:', node.name, 'Agg:', agg);
      console.log('🔍 Looking for data for node:', node.name);
      console.log('🔍 Available salary data keys:', Object.keys(salaryData));
      console.log('🔍 Direct lookup result:', salaryData[node.name.trim()] || salaryData[node.name.trim().toLowerCase()]);
      
      // Hiển thị tất cả các node, không ẩn node nào
      // Chỉ ẩn node nếu không có children và không có dữ liệu lương
      const hasChildren = node.children && node.children.length > 0;
       const hasData = agg && (agg.ft_salary_month || agg.pt_salary_month || agg.total_salary_month || agg.chi_tieu || agg.doanh_thu_thuc_hien || agg.ty_le_hoan_thanh || agg.quy_luong_chuan || agg.quy_luong_cho_phep || agg.quy_luong_con_lai || agg.quy_luong_con_lai_duoc_chia || agg.chenh_lech_quy_luong_cho_phep || agg.chenh_lech_quy_luong_con_lai);
      
      // Các đơn vị có chỉ tiêu riêng cần hiển thị ngay cả khi không có dữ liệu lương
      const specialUnitsWithChiTieu = [
        'bệnh viện đa khoa medlatec',
        'phòng khám medlatec tây hồ',
        'phòng khám medlatec cầu giấy', 
        'phòng khám medlatec thanh xuân',
        // Thêm các tên khác có thể có trong database
        'med ba đình',
        'med tây hồ', 
        'med cầu giấy',
        'med thanh xuân',
        'bệnh viện medlatec',
        'phòng khám tây hồ',
        'phòng khám cầu giấy',
        'phòng khám thanh xuân',
        // Thêm các từ khóa chung
        'tây hồ',
        'cầu giấy', 
        'thanh xuân',
        'medlatec'
      ];
      
      const isSpecialUnit = specialUnitsWithChiTieu.some(unit => nodeNameLower.includes(unit));
      
      // Đặc biệt cho các đơn vị con của Hệ thống khám chữa bệnh
      const isHealthSystemChild = nodeNameLower.includes('tây hồ') || 
                                 nodeNameLower.includes('cầu giấy') || 
                                 nodeNameLower.includes('thanh xuân') ||
                                 nodeNameLower.includes('medlatec');
      
      if (!hasChildren && !hasData && !isSpecialUnit && !isHealthSystemChild) return [];
      
      const isParent = node.children && node.children.length > 0;
      // Cho phép expand nếu có children
      const isExpandable = isParent;
      const isExpanded = expandedKeys.has(node.id);

      // Đổi tên "Trung tâm KHDN Hà Nội 1" thành "Trung tâm KHDN"
      const displayName = nodeNameLower.includes('khdn') && nodeNameLower.includes('hà nội 1') 
        ? 'Trung tâm KHDN' 
        : node.name;

      return [
        <React.Fragment key={node.id}>
          <TableRow className={hasChildren ? 'font-bold bg-blue-50' : ''}>
            <TableCell className={`py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left ${isExpandable && isExpanded ? 'font-bold' : ''}`} style={{ paddingLeft: `${0.5 + level * 1.25}rem` }}>
              <div className="flex items-center">
                {isExpandable ? (
                  <button type="button" onClick={() => toggleExpand(node.id)} className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0" aria-expanded={isExpanded} title={isExpanded ? 'Thu gọn' : 'Mở rộng'}>
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <span className="inline-block w-[calc(0.875rem+0.125rem+0.25rem)] mr-1 shrink-0"></span>
                )}
                <span className="truncate" title={displayName}>{displayName}</span>
              </div>
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
              {formatCurrency(agg.chi_tieu)}
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
              {formatCurrency(agg.doanh_thu_thuc_hien || 0)}
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
              {agg.ty_le_hoan_thanh ? `${(agg.ty_le_hoan_thanh * 100).toFixed(1)}%` : '0%'}
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
              {formatCurrency(agg.ft_salary_month)}
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
              <span className={displayName.toLowerCase().includes('hệ thống kcb ngoại viện') ? 'text-red-600' : ''}>
                {formatCurrency(agg.pt_salary_month)}
              </span>
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs font-semibold ${hasChildren ? 'font-bold' : ''}`}>
              {formatCurrency(displayName.toLowerCase().includes('hệ thống kcb ngoại viện') 
                ? agg.ft_salary_month 
                : agg.total_salary_month)}
            </TableCell>
            <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
              {formatCurrency(agg.quy_luong_chuan || 0)}
            </TableCell>
             <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
               {formatCurrency(agg.quy_luong_cho_phep || 0)}
             </TableCell>
             <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
               {formatCurrency(agg.quy_luong_con_lai || 0)}
             </TableCell>
             <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
               <span className={agg.chenh_lech_quy_luong_cho_phep < 0 ? 'text-green-600' : 'text-red-600'}>
                 {formatCurrency(agg.chenh_lech_quy_luong_cho_phep || 0)}
               </span>
             </TableCell>
             <TableCell className={`text-right py-1.5 px-2 text-xs ${hasChildren ? 'font-bold' : ''}`}>
               <span className={agg.chenh_lech_quy_luong_con_lai < 0 ? 'text-green-600' : 'text-red-600'}>
                 {formatCurrency(agg.chenh_lech_quy_luong_con_lai || 0)}
               </span>
             </TableCell>
          </TableRow>
          {isExpanded && node.children && renderRows(node.children, level + 1)}
        </React.Fragment>
      ];
    });
  };

  return (
    <Card className={`mt-4 flex-grow flex flex-col ${isExpanded ? 'h-[98vh]' : 'h-[500px]'}`}>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            Bảng duyệt quỹ lương các đơn vị tại Hà Nội tháng {selectedMonth}
          </CardTitle>
          <button
            onClick={toggleTableExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
            title={isExpanded ? "Thu gọn bảng" : "Mở rộng bảng"}
          >
            <Expand className="h-3.5 w-3.5" />
            {isExpanded ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Label htmlFor="selectedMonth" className="text-sm font-medium">
            Chọn tháng:
          </Label>
          <Input
            id="selectedMonth"
            type="number"
            min="1"
            max="12"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value) || 1)}
            className="w-20 h-8 text-sm"
            placeholder="7"
            title="Số tháng đã chia lương sẽ tự động = tháng được chọn"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow w-full">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px]"
                  onClick={() => handleSort('department_name')}
                >
                  <div className="flex items-center gap-1">
                    Ngành dọc/Đơn vị/Chi nhánh
                    {getSortIcon('department_name')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('chi_tieu')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Chỉ tiêu tháng {selectedMonth}
                    {getSortIcon('chi_tieu')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('doanh_thu_thuc_hien')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Doanh thu thực hiện tháng {selectedMonth}
                    {getSortIcon('doanh_thu_thuc_hien')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('ty_le_hoan_thanh')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Tỷ lệ hoàn thành Chỉ tiêu
                    {getSortIcon('ty_le_hoan_thanh')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('ft_salary_month')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Lương FT tháng {selectedMonth}
                    {getSortIcon('ft_salary_month')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('pt_salary_month')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Lương PT tháng {selectedMonth}
                    {getSortIcon('pt_salary_month')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('total_salary_month')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Tổng quỹ lương tháng {selectedMonth}
                    {getSortIcon('total_salary_month')}
                  </div>
                </TableHead>
                <TableHead 
                  className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                  onClick={() => handleSort('quy_luong_chuan')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Quỹ lương chuẩn
                    {getSortIcon('quy_luong_chuan')}
                  </div>
                </TableHead>
                 <TableHead 
                   className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                   onClick={() => handleSort('quy_luong_cho_phep')}
                 >
                   <div className="flex items-center justify-end gap-1">
                     Quỹ lương cho phép theo cơ chế
                     {getSortIcon('quy_luong_cho_phep')}
                   </div>
                 </TableHead>
                 <TableHead 
                   className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                   onClick={() => handleSort('quy_luong_con_lai_duoc_chia')}
                 >
                   <div className="flex items-center justify-end gap-1">
                     Quỹ lương còn lại được chia
                     {getSortIcon('quy_luong_con_lai_duoc_chia')}
                   </div>
                 </TableHead>
                 <TableHead 
                   className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                   onClick={() => handleSort('chenh_lech_quy_luong_cho_phep')}
                 >
                   <div className="flex items-center justify-end gap-1">
                     Chênh lệch với cơ chế
                     {getSortIcon('chenh_lech_quy_luong_cho_phep')}
                   </div>
                 </TableHead>
                 <TableHead 
                   className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right"
                   onClick={() => handleSort('chenh_lech_quy_luong_con_lai')}
                 >
                   <div className="flex items-center justify-end gap-1">
                     Chênh lệch với quỹ còn lại
                     {getSortIcon('chenh_lech_quy_luong_con_lai')}
                   </div>
                 </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                   <TableCell colSpan={15} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="ml-2">Đang tải dữ liệu...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-red-600">
                    Lỗi: {error}
                  </TableCell>
                </TableRow>
              ) : orgHierarchyData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-8 text-gray-500">
                    Không có dữ liệu cho tháng {selectedMonth}
                  </TableCell>
                </TableRow>
              ) : (
                renderRows(orgHierarchyData)
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
