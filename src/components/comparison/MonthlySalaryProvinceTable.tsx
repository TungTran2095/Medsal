"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthlySalaryProvinceTableProps {
  orgHierarchyData: any[];
  flatOrgUnits: any[];
}

type SortKey = 'department_name' | 'ft_salary_month' | 'pt_salary_month' | 'total_salary_month' | 'total_revenue_month' | 'target_revenue_month' | 'completion_ratio' | 'salary_revenue_ratio' | 'cumulative_salary_revenue_ratio' | 'allowed_salary_revenue_ratio' | 'allowed_salary_fund' | 'excess_salary_fund';
type SortDir = 'asc' | 'desc';

export default function MonthlySalaryProvinceTable({ orgHierarchyData, flatOrgUnits }: MonthlySalaryProvinceTableProps) {
  const [salaryData, setSalaryData] = useState<Record<string, any>>({});
  const [selectedMonth, setSelectedMonth] = useState<number>(7);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total_salary_month');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data: salaryRows, error: salaryError } = await supabase.rpc('get_simple_monthly_salary_province', {
          p_filter_year: 2025,
          p_filter_month: selectedMonth
        });

        if (salaryError) {
          setError(salaryError.message);
          setIsLoading(false);
          return;
        }

        // Map theo tên department_name để tra cứu nhanh
        const map: Record<string, any> = {};
        (salaryRows || []).forEach((row: any) => {
          map[row.department_name?.trim() || ''] = row;
        });
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Đặt chiều sort mặc định cho từng cột (số: desc, text: asc)
      if (
        key === 'ft_salary_month' ||
        key === 'pt_salary_month' ||
        key === 'total_salary_month' ||
        key === 'total_revenue_month' ||
        key === 'target_revenue_month' ||
        key === 'completion_ratio' ||
        key === 'salary_revenue_ratio' ||
        key === 'cumulative_salary_revenue_ratio' ||
        key === 'allowed_salary_revenue_ratio' ||
        key === 'allowed_salary_fund' ||
        key === 'excess_salary_fund'
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

  // Sort data
  const sortedSalaryData = useMemo(() => {
    const entries = Object.entries(salaryData);
    
    entries.sort(([nameA, dataA], [nameB, dataB]) => {
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
    
    return Object.fromEntries(entries);
  }, [salaryData, sortKey, sortDir]);

  // Calculate totals
  const calculateTotals = () => {
    const entries = Object.entries(sortedSalaryData);
    const totals = {
      ft_salary_month: 0,
      pt_salary_month: 0,
      total_salary_month: 0,
      total_revenue_month: 0,
      target_revenue_month: 0,
      completion_ratio: 0,
      salary_revenue_ratio: 0,
      cumulative_salary_revenue_ratio: 0,
      quy_cung_2025: 0,
      allowed_salary_revenue_ratio: 0,
      allowed_salary_fund: 0,
      excess_salary_fund: 0
    };

    entries.forEach(([departmentName, data]) => {
      // Bỏ Medcom và Medon khỏi tính tổng
      if (departmentName === 'Medcom' || departmentName === 'Medon') {
        return;
      }
      
      if (data) {
        totals.ft_salary_month += data.ft_salary_month || 0;
        totals.pt_salary_month += data.pt_salary_month || 0;
        totals.total_salary_month += data.total_salary_month || 0;
        totals.total_revenue_month += data.total_revenue_month || 0;
        totals.target_revenue_month += data.target_revenue_month || 0;
        totals.quy_cung_2025 += data.quy_cung_2025 || 0;
      }
    });

    // Calculate ratios for totals
    if (totals.target_revenue_month > 0) {
      totals.completion_ratio = totals.total_revenue_month / totals.target_revenue_month;
    }
    if (totals.total_revenue_month > 0) {
      totals.salary_revenue_ratio = totals.total_salary_month / totals.total_revenue_month;
    }
    
    // Calculate allowed salary revenue ratio for totals
    // For totals, we need to calculate cumulative target revenue from all departments
    let cumulativeTargetRevenue = 0;
    entries.forEach(([_, data]) => {
      if (data && data.chi_tieu_dt) {
        cumulativeTargetRevenue += data.chi_tieu_dt;
      }
    });
    
    if (cumulativeTargetRevenue > 0) {
      totals.allowed_salary_revenue_ratio = totals.quy_cung_2025 / cumulativeTargetRevenue;
    }
    
    // Calculate allowed salary fund and excess salary fund for totals
    totals.allowed_salary_fund = totals.total_revenue_month * totals.allowed_salary_revenue_ratio;
    totals.excess_salary_fund = totals.total_salary_month - totals.allowed_salary_fund;
    
    // Calculate cumulative ratios for totals (need to sum cumulative data from all rows)
    let cumulativeTotalSalary = 0;
    entries.forEach(([_, data]) => {
      if (data) {
        // Note: These would need to be calculated from the SQL function results
        // For now, we'll use the individual row ratios
      }
    });
    
    // For cumulative ratio, we'll calculate it from the SQL function results
    // This is a simplified approach - in practice, the SQL function should return cumulative totals

    return totals;
  };

  // Render rows
  const renderRows = (): React.ReactNode[] => {
    const rows = Object.entries(sortedSalaryData).map(([departmentName, data]) => {
      // Bỏ Medcom và Medon
      if (departmentName === 'Medcom' || departmentName === 'Medon') {
        return null;
      }
      
      if (!data || (data.ft_salary_month === 0 && data.pt_salary_month === 0 && data.total_salary_month === 0)) {
        return null;
      }

      return (
        <TableRow key={departmentName}>
          <TableCell className="py-1.5 px-2 text-xs font-medium sticky left-0 bg-card z-10 whitespace-nowrap min-w-[200px] text-left">
            {departmentName}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs">
            {formatCurrency(data.ft_salary_month ?? null)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs">
            {formatCurrency(data.pt_salary_month ?? null)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {formatCurrency(data.total_salary_month ?? null)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {formatCurrency(data.total_revenue_month ?? null)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {formatCurrency(data.target_revenue_month ?? null)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {data.completion_ratio !== null && data.completion_ratio !== undefined && !isNaN(data.completion_ratio) ? (
              <span className={data.completion_ratio >= 1 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                {(data.completion_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {data.salary_revenue_ratio !== null && data.salary_revenue_ratio !== undefined && !isNaN(data.salary_revenue_ratio) ? (
              <span className="text-blue-600 font-bold">
                {(data.salary_revenue_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {data.cumulative_salary_revenue_ratio !== null && data.cumulative_salary_revenue_ratio !== undefined && !isNaN(data.cumulative_salary_revenue_ratio) ? (
              <span className="text-purple-600 font-bold">
                {(data.cumulative_salary_revenue_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {data.allowed_salary_revenue_ratio !== null && data.allowed_salary_revenue_ratio !== undefined && !isNaN(data.allowed_salary_revenue_ratio) ? (
              <span className="text-orange-600 font-bold">
                {(data.allowed_salary_revenue_ratio * 100).toFixed(1)}%
              </span>
            ) : '-'}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {formatCurrency(data.allowed_salary_fund ?? null)}
          </TableCell>
          <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">
            {data.excess_salary_fund !== null && data.excess_salary_fund !== undefined && !isNaN(data.excess_salary_fund) ? (
              <span className={data.excess_salary_fund > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                {formatCurrency(data.excess_salary_fund)}
              </span>
            ) : '-'}
          </TableCell>
        </TableRow>
      );
    }).filter(Boolean);

    // Add total row
    const totals = calculateTotals();
    rows.push(
      <TableRow key="total" className="bg-muted/50 font-bold">
        <TableCell className="py-1.5 px-2 text-xs font-bold sticky left-0 bg-muted/50 z-10 whitespace-nowrap min-w-[200px] text-left">
          TỔNG CỘNG
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {formatCurrency(totals.ft_salary_month)}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {formatCurrency(totals.pt_salary_month)}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {formatCurrency(totals.total_salary_month)}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {formatCurrency(totals.total_revenue_month)}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {formatCurrency(totals.target_revenue_month)}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {totals.completion_ratio !== null && totals.completion_ratio !== undefined && !isNaN(totals.completion_ratio) ? (
            <span className={totals.completion_ratio >= 1 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              {(totals.completion_ratio * 100).toFixed(1)}%
            </span>
          ) : '-'}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {totals.salary_revenue_ratio !== null && totals.salary_revenue_ratio !== undefined && !isNaN(totals.salary_revenue_ratio) ? (
            <span className="text-blue-600 font-bold">
              {(totals.salary_revenue_ratio * 100).toFixed(1)}%
            </span>
          ) : '-'}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {totals.cumulative_salary_revenue_ratio !== null && totals.cumulative_salary_revenue_ratio !== undefined && !isNaN(totals.cumulative_salary_revenue_ratio) ? (
            <span className="text-purple-600 font-bold">
              {(totals.cumulative_salary_revenue_ratio * 100).toFixed(1)}%
            </span>
          ) : '-'}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {totals.allowed_salary_revenue_ratio !== null && totals.allowed_salary_revenue_ratio !== undefined && !isNaN(totals.allowed_salary_revenue_ratio) ? (
            <span className="text-orange-600 font-bold">
              {(totals.allowed_salary_revenue_ratio * 100).toFixed(1)}%
            </span>
          ) : '-'}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {formatCurrency(totals.allowed_salary_fund)}
        </TableCell>
        <TableCell className="text-right py-1.5 px-2 text-xs font-bold">
          {totals.excess_salary_fund !== null && totals.excess_salary_fund !== undefined && !isNaN(totals.excess_salary_fund) ? (
            <span className={totals.excess_salary_fund > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
              {formatCurrency(totals.excess_salary_fund)}
            </span>
          ) : '-'}
        </TableCell>
      </TableRow>
    );

    return rows;
  };

  return (
    <Card className="mt-4 flex-grow flex flex-col h-[500px]">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            Bảng duyệt quỹ lương các tỉnh tháng {selectedMonth}
          </CardTitle>
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
          />
        </div>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden flex flex-col">
        <ScrollArea className="flex-grow border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-20">
              <TableRow>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-left sticky left-0 bg-card z-20 min-w-[200px] cursor-pointer', sortKey === 'department_name' && 'font-bold')} onClick={() => handleSort('department_name')}>
                  Ngành dọc/Đơn vị/Chi nhánh {renderSortIcon('department_name')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer', sortKey === 'ft_salary_month' && 'font-bold')} onClick={() => handleSort('ft_salary_month')}>
                  Lương FT tháng {selectedMonth} {renderSortIcon('ft_salary_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer', sortKey === 'pt_salary_month' && 'font-bold')} onClick={() => handleSort('pt_salary_month')}>
                  Lương PT tháng {selectedMonth} {renderSortIcon('pt_salary_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'total_salary_month' && 'font-bold')} onClick={() => handleSort('total_salary_month')}>
                  Tổng quỹ lương tháng {selectedMonth} {renderSortIcon('total_salary_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'total_revenue_month' && 'font-bold')} onClick={() => handleSort('total_revenue_month')}>
                  Tổng doanh thu tháng {selectedMonth} {renderSortIcon('total_revenue_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'target_revenue_month' && 'font-bold')} onClick={() => handleSort('target_revenue_month')}>
                  Chỉ tiêu doanh thu tháng {selectedMonth} {renderSortIcon('target_revenue_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'completion_ratio' && 'font-bold')} onClick={() => handleSort('completion_ratio')}>
                  Tỷ lệ hoàn thành chỉ tiêu {renderSortIcon('completion_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('salary_revenue_ratio')}>
                  Quỹ lương/Doanh thu {renderSortIcon('salary_revenue_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'cumulative_salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('cumulative_salary_revenue_ratio')}>
                  Quỹ lương/Doanh thu lũy kế {renderSortIcon('cumulative_salary_revenue_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'allowed_salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('allowed_salary_revenue_ratio')}>
                  QL/DT được phép {renderSortIcon('allowed_salary_revenue_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[150px] cursor-pointer', sortKey === 'allowed_salary_fund' && 'font-bold')} onClick={() => handleSort('allowed_salary_fund')}>
                  Quỹ lương được phép chia {renderSortIcon('allowed_salary_fund')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[150px] cursor-pointer', sortKey === 'excess_salary_fund' && 'font-bold')} onClick={() => handleSort('excess_salary_fund')}>
                  Vượt quỹ lương tháng {renderSortIcon('excess_salary_fund')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center">Đang tải...</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={12} className="text-center text-red-500">{error}</TableCell></TableRow>
              ) : Object.keys(salaryData).length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center">Không có dữ liệu</TableCell></TableRow>
              ) : (
                renderRows()
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
