"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OrgNode, FlatOrgUnit } from '@/types';
import { ChevronDown, ChevronRight, Loader2, Expand, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

interface SalaryKpiTableProps {
  title: string;
  rpcName: string;
  orgHierarchyData: OrgNode[];
  flatOrgUnits: FlatOrgUnit[];
}

type SortKey = 'department_name' | 'ft_salary_2025' | 'pt_salary_2025' | 'total_salary_2025' | 'quy_cung_2025' | 'total_revenue_2025' | 'salary_revenue_ratio' | 'allowed_salary_revenue_ratio' | 'excess_ratio' | 'excess_fund' | 'additional_salary_fund';
type SortDir = 'asc' | 'desc';

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
  const [sortKey, setSortKey] = useState<SortKey>('total_salary_2025');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  // States for expandable rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [salaryMonthData, setSalaryMonthData] = useState<any[]>([]);
  const [salaryMonthLoading, setSalaryMonthLoading] = useState(false);

  useEffect(() => {
    setExpandedKeys(new Set());
  }, [orgHierarchyData]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      // Tính số tháng đã chia dựa trên ngày hiện tại
      const now = new Date();
      const currentDay = now.getDate();
      const currentMonth = now.getMonth() + 1; // getMonth() trả về 0-11, cần +1
      
      let calculatedMonths = 0;
      if (currentDay < 10) {
        calculatedMonths = Math.max(currentMonth - 2, 0);
      } else {
        calculatedMonths = Math.max(currentMonth - 1, 0);
      }
      
      // Áp dụng logic này cho cả bảng Hà Nội và các tỉnh
      if (title.includes("Hà Nội") || title.includes("các tỉnh")) {
        setSoThangDaChia(calculatedMonths);
      }
      
      // Lấy dữ liệu KPI
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
      setIsLoading(false);
    }
    fetchData();
  }, [rpcName, title]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const fetchSalaryMonthData = async (departmentName: string) => {
    // Always fetch fresh data
    
    setSalaryMonthLoading(true);
    try {
      // Fetch FT salary data by month
      const { data: ftData, error: ftError } = await supabase
        .from('Fulltime')
        .select('thang, tong_thu_nhap')
        .eq('nam', 2025)
        .eq('hn_or_not', 'Hà Nội')
        .eq('nganh_doc', departmentName);

      if (ftError) {
        console.error('Error fetching FT salary data:', ftError);
        throw new Error(`Lỗi khi tải dữ liệu lương FT: ${ftError.message}`);
      }

      // Fetch PT salary data by month
      const { data: ptData, error: ptError } = await supabase
        .from('Parttime')
        .select('"Thoi gian", "Tong tien"')
        .eq('"Nam"', 2025)
        .eq('"Don vi  2"', departmentName);

      if (ptError) {
        console.error('Error fetching PT salary data:', ptError);
        throw new Error(`Lỗi khi tải dữ liệu lương PT: ${ptError.message}`);
      }

      // Process and combine data
      const monthMap = new Map<string, { ft: number; pt: number; total: number }>();
      
      // Process FT data
      (ftData || []).forEach((item: any) => {
        const month = item.thang;
        const salary = parseFloat(String(item.tong_thu_nhap).replace(/,/g, '')) || 0;
        if (!monthMap.has(month)) {
          monthMap.set(month, { ft: 0, pt: 0, total: 0 });
        }
        const existing = monthMap.get(month)!;
        existing.ft += salary;
        existing.total += salary;
      });

      // Process PT data
      (ptData || []).forEach((item: any) => {
        const month = item['Thoi gian'];
        const salary = parseFloat(String(item['Tong tien']).replace(/,/g, '')) || 0;
        if (!monthMap.has(month)) {
          monthMap.set(month, { ft: 0, pt: 0, total: 0 });
        }
        const existing = monthMap.get(month)!;
        existing.pt += salary;
        existing.total += salary;
      });

      // Convert to array and sort by month
      const chartData = Array.from(monthMap.entries())
        .map(([month, data]) => ({
          month: month,
          salary: data.total
        }))
        .sort((a, b) => {
          const monthA = parseInt(a.month.replace(/\D/g, '')) || 0;
          const monthB = parseInt(b.month.replace(/\D/g, '')) || 0;
          return monthA - monthB;
        });

      setSalaryMonthData(chartData);
    } catch (error: any) {
      console.error('Error fetching salary month data:', error);
      // Set empty data to prevent infinite loading
      setSalaryMonthData([]);
    } finally {
      setSalaryMonthLoading(false);
    }
  };

  const handleExpand = (departmentName: string) => {
    if (expandedRow === departmentName) {
      setExpandedRow(null);
    } else {
      setExpandedRow(departmentName);
      fetchSalaryMonthData(departmentName);
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Đặt chiều sort mặc định cho từng cột (số: desc, text: asc)
      if (
        key === 'ft_salary_2025' ||
        key === 'pt_salary_2025' ||
        key === 'total_salary_2025' ||
        key === 'quy_cung_2025' ||
        key === 'total_revenue_2025' ||
        key === 'salary_revenue_ratio' ||
        key === 'allowed_salary_revenue_ratio' ||
        key === 'excess_ratio' ||
        key === 'excess_fund' ||
        key === 'additional_salary_fund'
      ) {
        setSortDir('desc');
      } else {
        setSortDir('asc');
      }
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 text-primary inline-block ml-1" />;
    return <ArrowDown className="h-3 w-3 text-primary inline-block ml-1" />;
  };

  // Sort data for province table
  const sortedKpiData = useMemo(() => {
    const entries = Object.entries(kpiData);
    
    // Filter out Medcom and Medon for province table
    const filteredEntries = title.includes("các tỉnh") 
      ? entries.filter(([name]) => !['Medcom', 'Medon'].includes(name))
      : entries;
    
    filteredEntries.sort(([nameA, dataA], [nameB, dataB]) => {
      let vA: any, vB: any;
      
      if (sortKey === 'department_name') {
        vA = nameA;
        vB = nameB;
      } else {
        vA = dataA[sortKey];
        vB = dataB[sortKey];
      }
      
      if (vA === null || vA === undefined) return sortDir === 'asc' ? 1 : -1;
      if (vB === null || vB === undefined) return sortDir === 'asc' ? -1 : 1;
      
      if (typeof vA === 'string' && typeof vB === 'string') {
        return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      if (typeof vA === 'number' && typeof vB === 'number') {
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      return 0;
    });
    
    return Object.fromEntries(filteredEntries);
  }, [kpiData, sortKey, sortDir, title]);

  // Calculate totals for province table
  const calculateTotals = () => {
    const entries = Object.entries(sortedKpiData);
    const totals = {
      ft_salary_2025: 0,
      pt_salary_2025: 0,
      total_salary_2025: 0,
      quy_cung_2025: 0,
      total_revenue_2025: 0,
      salary_revenue_ratio: 0,
      allowed_salary_revenue_ratio: 0,
      excess_ratio: 0,
      excess_fund: 0,
      additional_salary_fund: 0
    };

    entries.forEach(([_, data]) => {
      if (data) {
        totals.ft_salary_2025 += data.ft_salary_2025 || 0;
        totals.pt_salary_2025 += data.pt_salary_2025 || 0;
        totals.total_salary_2025 += data.total_salary_2025 || 0;
        totals.quy_cung_2025 += data.quy_cung_2025 || 0;
        totals.total_revenue_2025 += data.total_revenue_2025 || 0;
        totals.excess_fund += data.excess_fund || 0;
        totals.additional_salary_fund += data.additional_salary_fund || 0;
      }
    });

    // Calculate ratios
    if (totals.total_revenue_2025 > 0) {
      totals.salary_revenue_ratio = totals.total_salary_2025 / totals.total_revenue_2025;
    }
    if (totals.quy_cung_2025 > 0 && totals.total_revenue_2025 > 0) {
      totals.allowed_salary_revenue_ratio = totals.quy_cung_2025 / totals.total_revenue_2025;
    }
    if (totals.salary_revenue_ratio > 0 && totals.allowed_salary_revenue_ratio > 0) {
      totals.excess_ratio = totals.salary_revenue_ratio - totals.allowed_salary_revenue_ratio;
    }

    return totals;
  };

  // Render flat rows for province table (no hierarchy)
  const renderFlatRows = (): React.ReactNode[] => {
    const rows = Object.entries(sortedKpiData).map(([departmentName, data]) => {
      if (!data || (data.ft_salary_2025 === 0 && data.pt_salary_2025 === 0 && data.total_salary_2025 === 0 && data.quy_cung_2025 === 0)) {
        return null;
      }

      const thangDaChia = soThangDaChia;
      const thangConLai = Math.max(12 - thangDaChia, 0);
      const quyLuongTrungBinh = (thangDaChia > 0 && data.total_salary_2025 !== undefined) ? (data.total_salary_2025 / thangDaChia) : null;
      let quyLuongConLai = null;
      if (thangConLai > 0 && data.quy_cung_2025 !== undefined && data.total_salary_2025 !== undefined) {
        quyLuongConLai = (data.quy_cung_2025 - data.total_salary_2025) / thangConLai;
      }
      let tyLeQuyLuong = null;
      if (quyLuongTrungBinh !== null && quyLuongTrungBinh !== undefined && quyLuongTrungBinh > 0 && quyLuongConLai !== null && quyLuongConLai !== undefined) {
        tyLeQuyLuong = (quyLuongConLai / quyLuongTrungBinh) * 100;
      }

      return (
        <React.Fragment key={departmentName}>
          <TableRow>
            <TableCell className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left">
              <div className="flex items-center">
                <button 
                  type="button" 
                  onClick={() => handleExpand(departmentName)} 
                  className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0" 
                  title={expandedRow === departmentName ? 'Thu gọn biểu đồ' : 'Xem biểu đồ lương theo tháng'}
                >
                  {expandedRow === departmentName ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <span className="truncate" title={departmentName}>{departmentName}</span>
              </div>
            </TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs">{formatCurrency(data.ft_salary_2025 ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs">{formatCurrency(data.pt_salary_2025 ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(data.total_salary_2025 ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(data.quy_cung_2025 ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(data.total_revenue_2025 ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
              {data.salary_revenue_ratio !== null && data.salary_revenue_ratio !== undefined && !isNaN(data.salary_revenue_ratio) ? (
                <span className="text-blue-600 font-bold">
                  {(data.salary_revenue_ratio * 100).toFixed(1)}%
                </span>
              ) : '-'}
            </TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
              {data.allowed_salary_revenue_ratio !== null && data.allowed_salary_revenue_ratio !== undefined && !isNaN(data.allowed_salary_revenue_ratio) ? (
                <span className="text-purple-600 font-bold">
                  {(data.allowed_salary_revenue_ratio * 100).toFixed(1)}%
                </span>
              ) : '-'}
            </TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
              {data.excess_ratio !== null && data.excess_ratio !== undefined && !isNaN(data.excess_ratio) ? (
                <span className={data.excess_ratio > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  {(data.excess_ratio * 100).toFixed(1)}%
                </span>
              ) : '-'}
            </TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
              {data.excess_fund !== null && data.excess_fund !== undefined && !isNaN(data.excess_fund) ? (
                <span className={data.excess_fund > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  {formatCurrency(data.excess_fund)}
                </span>
              ) : '-'}
            </TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
              {data.additional_salary_fund !== null && data.additional_salary_fund !== undefined && !isNaN(data.additional_salary_fund) ? (
                <span className={data.additional_salary_fund > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  {formatCurrency(data.additional_salary_fund)}
                </span>
              ) : '-'}
            </TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{quyLuongTrungBinh !== null && quyLuongTrungBinh !== undefined && !isNaN(quyLuongTrungBinh) ? formatCurrency(quyLuongTrungBinh) : '-'}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{quyLuongConLai !== null && quyLuongConLai !== undefined && !isNaN(quyLuongConLai) ? formatCurrency(quyLuongConLai) : '-'}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
              {tyLeQuyLuong !== null && tyLeQuyLuong !== undefined && !isNaN(tyLeQuyLuong) ? (
                <span className={tyLeQuyLuong > 100 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                  {tyLeQuyLuong.toFixed(1)}%
                </span>
              ) : '-'}
            </TableCell>
          </TableRow>
          
          {/* Expanded row with salary chart */}
          {expandedRow === departmentName && (
            <TableRow>
              <TableCell colSpan={14} className="p-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3">Quỹ lương theo tháng - {departmentName}</h4>
                  <div className="h-48">
                    {salaryMonthLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2 text-sm">Đang tải dữ liệu...</span>
                      </div>
                    ) : salaryMonthData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salaryMonthData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            fontSize={10}
                            tick={{ fontSize: 10 }}
                          />
                          <YAxis 
                            fontSize={10}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                          />
                          <Tooltip 
                            formatter={(value: any) => [formatCurrency(value), 'Quỹ lương']}
                            labelFormatter={(label) => `Tháng ${label}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="salary" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Không có dữ liệu lương theo tháng
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </React.Fragment>
      );
    }).filter(Boolean);

    // Add total row for province table
    if (title.includes("các tỉnh")) {
      const totals = calculateTotals();
      const thangDaChia = soThangDaChia;
      const thangConLai = Math.max(12 - thangDaChia, 0);
      const quyLuongTrungBinh = (thangDaChia > 0 && totals.total_salary_2025 !== undefined) ? (totals.total_salary_2025 / thangDaChia) : null;
      let quyLuongConLai = null;
      if (thangConLai > 0 && totals.quy_cung_2025 !== undefined && totals.total_salary_2025 !== undefined) {
        quyLuongConLai = (totals.quy_cung_2025 - totals.total_salary_2025) / thangConLai;
      }
      let tyLeQuyLuong = null;
      if (quyLuongTrungBinh !== null && quyLuongTrungBinh !== undefined && quyLuongTrungBinh > 0 && quyLuongConLai !== null && quyLuongConLai !== undefined) {
        tyLeQuyLuong = (quyLuongConLai / quyLuongTrungBinh) * 100;
      }

      rows.push(
        <TableRow key="total" className="bg-muted/50 font-bold">
          <TableCell className="py-1.5 px-2 text-xs font-bold sticky left-0 bg-muted/50 z-10 whitespace-nowrap min-w-[200px] text-left">
            TỔNG CỘNG
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {formatCurrency(totals.ft_salary_2025)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {formatCurrency(totals.pt_salary_2025)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {formatCurrency(totals.total_salary_2025)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {formatCurrency(totals.quy_cung_2025)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {formatCurrency(totals.total_revenue_2025)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {totals.salary_revenue_ratio !== null && totals.salary_revenue_ratio !== undefined && !isNaN(totals.salary_revenue_ratio) ? (
              <span className="text-blue-600 font-bold">
                {(totals.salary_revenue_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {totals.allowed_salary_revenue_ratio !== null && totals.allowed_salary_revenue_ratio !== undefined && !isNaN(totals.allowed_salary_revenue_ratio) ? (
              <span className="text-purple-600 font-bold">
                {(totals.allowed_salary_revenue_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {totals.excess_ratio !== null && totals.excess_ratio !== undefined && !isNaN(totals.excess_ratio) ? (
              <span className={totals.excess_ratio > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                {(totals.excess_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {totals.excess_fund !== null && totals.excess_fund !== undefined && !isNaN(totals.excess_fund) ? (
              <span className={totals.excess_fund > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                {formatCurrency(totals.excess_fund)}
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {totals.additional_salary_fund !== null && totals.additional_salary_fund !== undefined && !isNaN(totals.additional_salary_fund) ? (
              <span className={totals.additional_salary_fund > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                {formatCurrency(totals.additional_salary_fund)}
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {quyLuongTrungBinh !== null && quyLuongTrungBinh !== undefined && !isNaN(quyLuongTrungBinh) ? formatCurrency(quyLuongTrungBinh) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {quyLuongConLai !== null && quyLuongConLai !== undefined && !isNaN(quyLuongConLai) ? formatCurrency(quyLuongConLai) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
            {tyLeQuyLuong !== null && tyLeQuyLuong !== undefined && !isNaN(tyLeQuyLuong) ? (
              <span className={tyLeQuyLuong > 100 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {tyLeQuyLuong.toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
        </TableRow>
      );
    }

    return rows;
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
      // Sử dụng số tháng đã chia từ input
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
        <React.Fragment key={node.id}>
          <TableRow>
            <TableCell className={`py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left ${isExpandable && isExpanded ? 'font-bold' : ''}`} style={{ paddingLeft: `${0.5 + level * 1.25}rem` }}>
              <div className="flex items-center">
                {isExpandable ? (
                  <button type="button" onClick={() => toggleExpand(node.id)} className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0" aria-expanded={isExpanded} title={isExpanded ? 'Thu gọn' : 'Mở rộng'}>
                    {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </button>
                ) : (
                  <span className="inline-block w-[calc(0.875rem+0.125rem+0.25rem)] mr-1 shrink-0"></span>
                )}
                <button 
                  type="button" 
                  onClick={() => handleExpand(node.name)} 
                  className="p-0.5 rounded hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mr-1 shrink-0" 
                  title={expandedRow === node.name ? 'Thu gọn biểu đồ' : 'Xem biểu đồ lương theo tháng'}
                >
                  {expandedRow === node.name ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                <span className="truncate" title={node.name}>{node.name}</span>
              </div>
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
          </TableRow>
          
          {/* Expanded row with salary chart */}
          {expandedRow === node.name && (
            <TableRow>
              <TableCell colSpan={8} className="p-4">
                <div className="bg-muted/30 rounded-lg p-4">
                  <h4 className="text-sm font-semibold mb-3">Quỹ lương theo tháng - {node.name}</h4>
                  {salaryMonthLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      <span className="text-xs text-muted-foreground">Đang tải dữ liệu...</span>
                    </div>
                  ) : salaryMonthData && salaryMonthData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salaryMonthData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="month" 
                            tick={{ fontSize: 10 }}
                            angle={-30}
                            textAnchor="end"
                            height={50}
                          />
                          <YAxis 
                            tick={{ fontSize: 10 }}
                            tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toLocaleString()}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value),
                              name === 'ft_salary' ? 'Lương FT' : name === 'pt_salary' ? 'Lương PT' : 'Tổng lương'
                            ]}
                            labelFormatter={(label) => `Tháng: ${label}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="ft_salary" 
                            stroke="#8884d8" 
                            strokeWidth={2}
                            name="Lương FT"
                            dot={{ r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="pt_salary" 
                            stroke="#82ca9d" 
                            strokeWidth={2}
                            name="Lương PT"
                            dot={{ r: 3 }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="total_salary" 
                            stroke="#ff7300" 
                            strokeWidth={2}
                            name="Tổng lương"
                            dot={{ r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-muted-foreground">
                      <span className="text-xs">Không có dữ liệu lương theo tháng</span>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}
        </React.Fragment>,
        ...(isExpandable && isExpanded ? renderRows(node.children, level + 1) : [])
      ];
    });
  };

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">{title}</CardTitle>
          {!title.includes("các tỉnh") && (
            <button
              onClick={expandAllNodes}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
              title="Mở rộng tất cả các nhánh"
            >
              <Expand className="h-3.5 w-3.5" />
              Mở rộng
            </button>
          )}
        </div>
        {(title.includes("Hà Nội") || title.includes("các tỉnh")) && (
          <div className="flex items-center gap-2 mt-2">
            <Label htmlFor={`soThangDaChia-${title.includes("Hà Nội") ? "hanoi" : "province"}`} className="text-sm font-medium">
              Số tháng đã chia (tự động):
            </Label>
            <Input
              id={`soThangDaChia-${title.includes("Hà Nội") ? "hanoi" : "province"}`}
              type="number"
              min="0"
              max="12"
              value={soThangDaChia}
              onChange={(e) => setSoThangDaChia(Number(e.target.value) || 0)}
              className="w-20 h-8 text-sm"
              placeholder="5"
              title="Tự động tính: nếu ngày < 10 thì tháng hiện tại - 2, nếu >= 10 thì tháng hiện tại - 1"
            />
            <span className="text-xs text-muted-foreground">
              (Tự động: {new Date().getDate() < 10 ? 'ngày < 10' : 'ngày >= 10'})
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px] cursor-pointer', sortKey === 'department_name' && 'font-bold')} onClick={() => handleSort('department_name')}>
                  Ngành dọc/Đơn vị/Chi nhánh {renderSortIcon('department_name')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer', sortKey === 'ft_salary_2025' && 'font-bold')} onClick={() => handleSort('ft_salary_2025')}>
                  Lương FT HN 25 {renderSortIcon('ft_salary_2025')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer', sortKey === 'pt_salary_2025' && 'font-bold')} onClick={() => handleSort('pt_salary_2025')}>
                  Lương PT ĐV2 25 {renderSortIcon('pt_salary_2025')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'total_salary_2025' && 'font-bold')} onClick={() => handleSort('total_salary_2025')}>
                  Tổng Lương 25 {renderSortIcon('total_salary_2025')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'quy_cung_2025' && 'font-bold')} onClick={() => handleSort('quy_cung_2025')}>
                  Quỹ cứng 2025(nếu đạt DT) {renderSortIcon('quy_cung_2025')}
                </TableHead>
                {title.includes("các tỉnh") && (
                  <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'total_revenue_2025' && 'font-bold')} onClick={() => handleSort('total_revenue_2025')}>
                    Tổng doanh thu {renderSortIcon('total_revenue_2025')}
                  </TableHead>
                )}
                {title.includes("các tỉnh") && (
                  <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('salary_revenue_ratio')}>
                    QL/DT lũy kế {renderSortIcon('salary_revenue_ratio')}
                  </TableHead>
                )}
                {title.includes("các tỉnh") && (
                  <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'allowed_salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('allowed_salary_revenue_ratio')}>
                    QL/DT được phép {renderSortIcon('allowed_salary_revenue_ratio')}
                  </TableHead>
                )}
                {title.includes("các tỉnh") && (
                  <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'excess_ratio' && 'font-bold')} onClick={() => handleSort('excess_ratio')}>
                    Tỷ lệ vượt quỹ {renderSortIcon('excess_ratio')}
                  </TableHead>
                )}
                {title.includes("các tỉnh") && (
                  <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'excess_fund' && 'font-bold')} onClick={() => handleSort('excess_fund')}>
                    Quỹ cứng vượt {renderSortIcon('excess_fund')}
                  </TableHead>
                )}
                {title.includes("các tỉnh") && (
                  <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'additional_salary_fund' && 'font-bold')} onClick={() => handleSort('additional_salary_fund')}>
                    Quỹ lương phải bù thêm {renderSortIcon('additional_salary_fund')}
                  </TableHead>
                )}
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ lương trung bình đã chia</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ lương còn lại được chia</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">QL còn lại/QL đã chia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={title.includes("các tỉnh") ? 14 : 8} className="text-center">Đang tải...</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={title.includes("các tỉnh") ? 14 : 8} className="text-center text-red-500">{error}</TableCell></TableRow>
              ) : title.includes("các tỉnh") ? (
                // Render flat rows for province table
                Object.keys(kpiData).length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center">Không có dữ liệu</TableCell></TableRow>
                ) : (
                  renderFlatRows()
                )
              ) : (
                // Render hierarchical rows for Hanoi table
                orgHierarchyData.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center">Không có dữ liệu</TableCell></TableRow>
                ) : (
                  renderRows(orgHierarchyData)
                )
              )}
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

