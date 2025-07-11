"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgNode, FlatOrgUnit } from '@/types';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SalaryKpiTableProps {
  title: string;
  rpcName: string;
  orgHierarchyData: OrgNode[];
  flatOrgUnits: FlatOrgUnit[];
}

function aggregateKpiForNode(node: OrgNode, kpiData: Record<string, any>): any {
  if (!node.children || node.children.length === 0) {
    return kpiData[node.name?.trim() || ''] || null;
  }
  // Nếu có con, sum các trường lương của các con (đệ quy)
  let sum = { ft_salary_2025: 0, pt_salary_2025: 0, total_salary_2025: 0, quy_cung_2025: 0 };
  let hasChildWithData = false;
  node.children.forEach(child => {
    const childAgg = aggregateKpiForNode(child, kpiData);
    if (childAgg && (childAgg.ft_salary_2025 || childAgg.pt_salary_2025 || childAgg.total_salary_2025 || childAgg.quy_cung_2025)) {
      hasChildWithData = true;
      sum.ft_salary_2025 += childAgg.ft_salary_2025 || 0;
      sum.pt_salary_2025 += childAgg.pt_salary_2025 || 0;
      sum.total_salary_2025 += childAgg.total_salary_2025 || 0;
      sum.quy_cung_2025 += childAgg.quy_cung_2025 || 0;
    }
  });
  if (hasChildWithData) return sum;
  // Nếu tất cả con đều =0, lấy theo node hiện tại (nếu có)
  return kpiData[node.name?.trim() || ''] || null;
}

function SalaryKpiTable({ title, rpcName, orgHierarchyData }: SalaryKpiTableProps) {
  const [kpiData, setKpiData] = useState<Record<string, any>>({});
  const [soThangDaChia, setSoThangDaChia] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [orgHierarchyData]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      // Lấy dữ liệu KPI (có thêm trường so_thang_da_chia)
      const { data: kpiRows, error: kpiError } = await supabase.rpc(rpcName, {
        p_filter_year: 2025,
        p_filter_months: []
      });
      if (kpiError) {
        setError(kpiError.message);
        setIsLoading(false);
        return;
      }
      // Map theo tên department_name để tra cứu nhanh
      const map: Record<string, any> = {};
      (kpiRows || []).forEach((row: any) => {
        map[row.department_name?.trim() || ''] = row;
      });
      setKpiData(map);
      // Không cần lấy số tháng đã chia từ database nữa, sử dụng giá trị từ input
      setIsLoading(false);
    }
    fetchData();
  }, [rpcName]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const toggleExpand = (id: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  // Đệ quy render cây tổ chức với sum cha, ẩn con =0, có expand/collapse
  const renderRows = (nodes: OrgNode[], level = 0): React.ReactNode[] => {
    return nodes.flatMap(node => {
      const agg = aggregateKpiForNode(node, kpiData);
      // Ẩn node nếu tất cả trường lương đều =0
      if (!agg || (!agg.ft_salary_2025 && !agg.pt_salary_2025 && !agg.total_salary_2025 && !agg.quy_cung_2025)) return [];
      const isParent = node.children && node.children.length > 0;
      // Chỉ còn dòng con có lương > 0 mới cho phép expand
      const hasChildWithData = node.children && node.children.some(child => {
        const childAgg = aggregateKpiForNode(child, kpiData);
        return childAgg && (childAgg.ft_salary_2025 || childAgg.pt_salary_2025 || childAgg.total_salary_2025 || childAgg.quy_cung_2025);
      });
      const isExpandable = isParent && hasChildWithData;
      const isExpanded = expandedKeys.has(node.id);
      // Sử dụng số tháng đã chia từ state
      const thangDaChia = soThangDaChia;
      const thangConLai = Math.max(12 - thangDaChia, 0);
      // Quỹ lương trung bình đã chia
      const quyLuongTrungBinh = (thangDaChia > 0 && agg.total_salary_2025 !== undefined) ? (agg.total_salary_2025 / thangDaChia) : null;
      // Quỹ lương còn lại được chia
      let quyLuongConLai = null;
      if (thangConLai > 0 && agg.quy_cung_2025 !== undefined && agg.total_salary_2025 !== undefined) {
        quyLuongConLai = (agg.quy_cung_2025 - agg.total_salary_2025) / thangConLai;
      }
      // Tỷ lệ QL còn lại/QL đã chia
      let tyLeQuyLuong = null;
      if (quyLuongTrungBinh !== null && quyLuongTrungBinh !== undefined && quyLuongTrungBinh > 0 && quyLuongConLai !== null && quyLuongConLai !== undefined) {
        tyLeQuyLuong = (quyLuongConLai / quyLuongTrungBinh) * 100;
      }
      return [
        <TableRow key={node.id}>
          <TableCell className={`py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left ${isExpandable && isExpanded ? 'font-bold' : ''}`} style={{ paddingLeft: `${0.5 + level * 1.25}rem` }}>
            {isExpandable ? (
              <button type="button" onClick={() => toggleExpand(node.id)} className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0" aria-expanded={isExpanded} title={isExpanded ? 'Thu gọn' : 'Mở rộng'}>
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="inline-block w-[calc(0.875rem+0.125rem+0.25rem)] mr-1 shrink-0"></span>
            )}
            <span className="truncate" title={node.name}>{node.name}</span>
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs">{formatCurrency(agg.ft_salary_2025 ?? null)}</TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs">{formatCurrency(agg.pt_salary_2025 ?? null)}</TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(agg.total_salary_2025 ?? null)}</TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(agg.quy_cung_2025 ?? null)}</TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{quyLuongTrungBinh !== null && quyLuongTrungBinh !== undefined && !isNaN(quyLuongTrungBinh) ? formatCurrency(quyLuongTrungBinh) : '-'}</TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{quyLuongConLai !== null && quyLuongConLai !== undefined && !isNaN(quyLuongConLai) ? formatCurrency(quyLuongConLai) : '-'}</TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {tyLeQuyLuong !== null && tyLeQuyLuong !== undefined && !isNaN(tyLeQuyLuong) ? (
              <span className={tyLeQuyLuong > 100 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {tyLeQuyLuong.toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
        </TableRow>,
        ...(isExpandable && isExpanded ? renderRows(node.children, level + 1) : [])
      ];
    });
  };

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">{title}</CardTitle>
        {(title.includes("Hà Nội") || title.includes("các tỉnh")) && (
          <div className="flex items-center gap-2 mt-2">
            <Label htmlFor={`soThangDaChia-${title.includes("Hà Nội") ? "hanoi" : "province"}`} className="text-sm font-medium">Số tháng đã chia:</Label>
            <Input
              id={`soThangDaChia-${title.includes("Hà Nội") ? "hanoi" : "province"}`}
              type="number"
              min="0"
              max="12"
              value={soThangDaChia}
              onChange={(e) => setSoThangDaChia(Number(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
              placeholder="5"
            />
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px]">Ngành dọc/Đơn vị/Chi nhánh</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">Lương FT HN 25</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">Lương PT ĐV2 25</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Tổng Lương 25</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ cứng 2025(nếu đạt DT)</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ lương trung bình đã chia</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ lương còn lại được chia</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">QL còn lại/QL đã chia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">Đang tải...</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={7} className="text-center text-red-500">{error}</TableCell></TableRow>
              ) : orgHierarchyData.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center">Không có dữ liệu</TableCell></TableRow>
              ) : renderRows(orgHierarchyData)}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default function NganhDocKpiComparisonTable({ orgHierarchyData, flatOrgUnits }: { orgHierarchyData: OrgNode[], flatOrgUnits: FlatOrgUnit[] }) {
  return (
    <>
      <SalaryKpiTable
        title="Bảng so sánh với chỉ tiêu 2025 các đơn vị tại Hà Nội"
        rpcName="get_nganhdoc_salary_kpi_2025_hanoi"
        orgHierarchyData={orgHierarchyData}
        flatOrgUnits={flatOrgUnits}
      />
      <SalaryKpiTable
        title="Bảng so sánh với chỉ tiêu 2025 các tỉnh"
        rpcName="get_nganhdoc_salary_kpi_2025_province"
        orgHierarchyData={orgHierarchyData}
        flatOrgUnits={flatOrgUnits}
      />
    </>
  );
}

