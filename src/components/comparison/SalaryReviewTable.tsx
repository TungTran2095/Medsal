"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

type SortKey = 'department_name' | 'ft_salary_month' | 'pt_salary_month' | 'total_salary_month' | 'total_revenue_month' | 'salary_revenue_ratio' | 'allowed_salary_revenue_ratio' | 'excess_ratio' | 'excess_fund' | 'additional_salary_fund';
type SortDir = 'asc' | 'desc';

export default function SalaryReviewTable() {
  const [kpiData, setKpiData] = useState<Record<string, any>>({});
  const [soThangDaChia, setSoThangDaChia] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total_salary_month');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  
  // States for expandable rows
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [salaryMonthData, setSalaryMonthData] = useState<any[]>([]);
  const [salaryMonthLoading, setSalaryMonthLoading] = useState(false);

  // Auto calculate soThangDaChia based on current date
  useEffect(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth() + 1; // getMonth() returns 0-11
    
    if (currentDay < 10) {
      setSoThangDaChia(currentMonth - 2);
    } else {
      setSoThangDaChia(currentMonth - 1);
    }
  }, []);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const fetchKpiData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Fetching monthly salary data for month:', soThangDaChia);

      // Try SQL function first, fallback to direct queries if it fails
      let data, error;
      
      try {
        const result = await supabase.rpc('get_monthly_salary_data_2025_province', {
          p_filter_year: 2025,
          p_filter_month: soThangDaChia
        });
        data = result.data;
        error = result.error;
        console.log('SQL function result:', { data, error });
      } catch (rpcError) {
        console.log('SQL function failed, using direct queries with MS_Org_Diadiem mapping:', rpcError);
        
        // Get business units from MS_Org_Diadiem
        const { data: orgData, error: orgError } = await supabase
          .from('MS_Org_Diadiem')
          .select('"Bussiness Unit", "Department"')
          .eq('Division', 'Company')
          .not('"Bussiness Unit"', 'is', null)
          .not('"Bussiness Unit"', 'eq', '')
          .not('"Department"', 'is', null)
          .not('"Department"', 'eq', '');
        
        console.log('Org mapping data:', { orgData, orgError });
        
        if (orgError) {
          setError(`Lỗi khi tải dữ liệu tổ chức: ${orgError.message}`);
          return;
        }
        
        // Create department to business unit mapping
        const deptToBusinessUnitMap = new Map<string, string>();
        orgData?.forEach((item: any) => {
          deptToBusinessUnitMap.set(item['Department'], item['Bussiness Unit']);
        });
        
        console.log('Department to BusinessUnit map:', Array.from(deptToBusinessUnitMap.entries()));
        
        // Fetch salary and revenue data
        const monthStr = `Tháng ${soThangDaChia.toString().padStart(2, '0')}`;
        const monthRevenueStr = `${monthStr}-2025`;
        
        // Fetch FT salary data
        const { data: ftData, error: ftError } = await supabase
          .from('Fulltime')
          .select('dia_diem, tong_thu_nhap')
          .eq('nam', 2025)
          .eq('thang', monthStr)
          .limit(10000);
        
        // Fetch PT salary data
        const { data: ptData, error: ptError } = await supabase
          .from('Parttime')
          .select('"Don vi", "Tong tien"')
          .eq('Nam', 2025)
          .eq('"Thoi gian"', monthStr)
          .limit(10000);
        
        // Fetch revenue data
        const { data: revenueData, error: revenueError } = await supabase
          .from('Doanh_thu')
          .select('"Tên Đơn vị", "Kỳ báo cáo"')
          .eq('"Tháng pro"', monthRevenueStr)
          .limit(10000);
        
        console.log('Direct query results:', { 
          ftData: ftData?.length || 0, 
          ptData: ptData?.length || 0, 
          revenueData: revenueData?.length || 0 
        });
        
        // Debug: Show sample data
        console.log('Sample FT data:', ftData?.slice(0, 3));
        console.log('Sample PT data:', ptData?.slice(0, 3));
        console.log('Sample revenue data:', revenueData?.slice(0, 3));
        console.log('Month string:', monthStr);
        console.log('Month revenue string:', monthRevenueStr);
        
        if (ftError || ptError || revenueError) {
          setError(`Lỗi khi tải dữ liệu: FT=${ftError?.message || 'OK'}, PT=${ptError?.message || 'OK'}, Revenue=${revenueError?.message || 'OK'}`);
          return;
        }
        
        // Process data with business unit mapping
        const kpiMap: Record<string, any> = {};
        
        // Process FT data
        const ftGrouped = new Map<string, number>();
        ftData?.forEach(row => {
          const deptName = row.dia_diem;
          const businessUnit = deptToBusinessUnitMap.get(deptName) || deptName;
          const salary = parseFloat(String(row.tong_thu_nhap || 0).replace(/,/g, ''));
          ftGrouped.set(businessUnit, (ftGrouped.get(businessUnit) || 0) + salary);
          console.log(`FT: ${deptName} -> ${businessUnit}, salary: ${salary}`);
        });
        console.log('FT grouped result:', Array.from(ftGrouped.entries()));
        
        // Process PT data
        const ptGrouped = new Map<string, number>();
        ptData?.forEach(row => {
          const deptName = row['Don vi'];
          const businessUnit = deptToBusinessUnitMap.get(deptName) || deptName;
          const salary = parseFloat(String(row['Tong tien'] || 0).replace(/,/g, ''));
          ptGrouped.set(businessUnit, (ptGrouped.get(businessUnit) || 0) + salary);
          console.log(`PT: ${deptName} -> ${businessUnit}, salary: ${salary}`);
        });
        console.log('PT grouped result:', Array.from(ptGrouped.entries()));
        
        // Process revenue data
        const revenueGrouped = new Map<string, number>();
        revenueData?.forEach(row => {
          const deptName = row['Tên Đơn vị'];
          const revenue = parseFloat(String(row['Kỳ báo cáo'] || 0).replace(/,/g, ''));
          revenueGrouped.set(deptName, (revenueGrouped.get(deptName) || 0) + revenue);
          console.log(`Revenue: ${deptName}, revenue: ${revenue}`);
        });
        console.log('Revenue grouped result:', Array.from(revenueGrouped.entries()));
        
        // Combine all data
        const allBusinessUnits = new Set([...ftGrouped.keys(), ...ptGrouped.keys(), ...revenueGrouped.keys()]);
        console.log('All business units:', Array.from(allBusinessUnits));
        
        allBusinessUnits.forEach(businessUnit => {
          if (businessUnit && !['Medcom', 'Medon'].includes(businessUnit)) {
            const ftSalary = ftGrouped.get(businessUnit) || 0;
            const ptSalary = ptGrouped.get(businessUnit) || 0;
            const totalSalary = ftSalary + ptSalary;
            const revenue = revenueGrouped.get(businessUnit) || 0;
            
            console.log(`Creating KPI entry for ${businessUnit}: FT=${ftSalary}, PT=${ptSalary}, Total=${totalSalary}, Revenue=${revenue}`);
            
            kpiMap[businessUnit] = {
              department_name: businessUnit,
              ft_salary_month: ftSalary,
              pt_salary_month: ptSalary,
              total_salary_month: totalSalary,
              total_revenue_month: revenue,
              salary_revenue_ratio: revenue > 0 ? totalSalary / revenue : 0,
              allowed_salary_revenue_ratio: 0,
              excess_ratio: 0,
              excess_fund: 0,
              additional_salary_fund: 0
            };
          }
        });
        
        console.log('Final kpiMap with business units:', kpiMap);
        setKpiData(kpiMap);
        return;
      }

      if (error) {
        console.error('Error fetching monthly salary data:', error);
        setError(`Lỗi khi tải dữ liệu: ${error.message}`);
        return;
      }

      if (data) {
        console.log('Raw data from SQL function:', data);
        const kpiMap: Record<string, any> = {};
        data.forEach((row: any) => {
          console.log('Processing row:', row);
          kpiMap[row.department_name] = {
            department_name: row.department_name,
            ft_salary_month: row.ft_salary_month || 0,
            pt_salary_month: row.pt_salary_month || 0,
            total_salary_month: row.total_salary_month || 0,
            total_revenue_month: row.total_revenue_month || 0,
            salary_revenue_ratio: row.salary_revenue_ratio || 0,
            allowed_salary_revenue_ratio: 0, // Not available for monthly data
            excess_ratio: 0, // Not available for monthly data
            excess_fund: 0, // Not available for monthly data
            additional_salary_fund: 0 // Not available for monthly data
          };
        });
        console.log('Final kpiMap:', kpiMap);
        setKpiData(kpiMap);
      } else {
        console.log('No data returned from SQL function');
        setKpiData({});
      }
    } catch (err) {
      console.error('Error in fetchKpiData:', err);
      setError('Lỗi không xác định khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSalaryMonthData = async (departmentName: string) => {
    try {
      setSalaryMonthLoading(true);
      
      // Fetch FT salary data
      const { data: ftData, error: ftError } = await supabase
        .from('Fulltime')
        .select('dia_diem, thang, nam, tong_thu_nhap')
        .eq('nam', 2025)
        .eq('dia_diem', departmentName)
        .limit(10000);

      if (ftError) {
        console.error('Error fetching FT salary data:', ftError);
        return;
      }

      // Fetch PT salary data
      const { data: ptData, error: ptError } = await supabase
        .from('Parttime')
        .select('"Don vi", "Thoi gian", "Nam", "Tong tien"')
        .eq('Nam', 2025)
        .eq('"Don vi"', departmentName)
        .limit(10000);

      if (ptError) {
        console.error('Error fetching PT salary data:', ptError);
        return;
      }

      // Combine and process data
      const monthMap = new Map<string, { ft: number; pt: number; total: number }>();
      
      // Process FT data
      ftData?.forEach(row => {
        const month = row.thang?.replace('Tháng ', '').padStart(2, '0') || '01';
        const salary = parseFloat(String(row.tong_thu_nhap || 0).replace(/,/g, ''));
        
        if (!monthMap.has(month)) {
          monthMap.set(month, { ft: 0, pt: 0, total: 0 });
        }
        const existing = monthMap.get(month)!;
        existing.ft += salary;
        existing.total += salary;
      });

      // Process PT data
      ptData?.forEach(row => {
        const month = row['Thoi gian']?.replace('Tháng ', '').padStart(2, '0') || '01';
        const salary = parseFloat(String(row['Tong tien'] || 0).replace(/,/g, ''));
        
        if (!monthMap.has(month)) {
          monthMap.set(month, { ft: 0, pt: 0, total: 0 });
        }
        const existing = monthMap.get(month)!;
        existing.pt += salary;
        existing.total += salary;
      });

      // Convert to array and sort
      const monthData = Array.from(monthMap.entries())
        .map(([month, data]) => ({
          month: `Tháng ${month}`,
          salary: data.total
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      setSalaryMonthData(monthData);
    } catch (err) {
      console.error('Error fetching salary month data:', err);
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
    const filteredEntries = entries.filter(([name]) => !['Medcom', 'Medon'].includes(name));
    
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
  }, [kpiData, sortKey, sortDir]);

  // Calculate totals for province table
  const calculateTotals = () => {
    const entries = Object.entries(sortedKpiData);
    const totals = {
      ft_salary_month: 0,
      pt_salary_month: 0,
      total_salary_month: 0,
      total_revenue_month: 0,
      salary_revenue_ratio: 0,
      allowed_salary_revenue_ratio: 0,
      excess_ratio: 0,
      excess_fund: 0,
      additional_salary_fund: 0
    };

    entries.forEach(([_, data]) => {
      if (data) {
        totals.ft_salary_month += data.ft_salary_month || 0;
        totals.pt_salary_month += data.pt_salary_month || 0;
        totals.total_salary_month += data.total_salary_month || 0;
        totals.total_revenue_month += data.total_revenue_month || 0;
        totals.excess_fund += data.excess_fund || 0;
        totals.additional_salary_fund += data.additional_salary_fund || 0;
      }
    });

    // Calculate ratios
    if (totals.total_revenue_month > 0) {
      totals.salary_revenue_ratio = totals.total_salary_month / totals.total_revenue_month;
    }
    if (totals.salary_revenue_ratio > 0) {
      totals.excess_ratio = totals.salary_revenue_ratio - totals.allowed_salary_revenue_ratio;
    }

    return totals;
  };

  // Render flat rows for province table (no hierarchy)
  const renderFlatRows = (): React.ReactNode[] => {
    const rows = Object.entries(sortedKpiData).map(([departmentName, data]) => {
      if (!data || (data.ft_salary_month === 0 && data.pt_salary_month === 0 && data.total_salary_month === 0)) {
        return null;
      }

      const thangDaChia = soThangDaChia;
      const thangConLai = Math.max(12 - thangDaChia, 0);
      const quyLuongTrungBinh = (thangDaChia > 0 && data.total_salary_month !== undefined) ? (data.total_salary_month / thangDaChia) : null;
      let quyLuongConLai = null;
      // For monthly data, we don't have quy_cung_2025, so we'll set these to null for now
      let tyLeQuyLuong: number | null = null;

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
            <TableCell className="text-right py-1.5 px-2 text-xs">{formatCurrency(data.ft_salary_month ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs">{formatCurrency(data.pt_salary_month ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(data.total_salary_month ?? null)}</TableCell>
            <TableCell className="text-right py-1.5 px-2 text-xs font-semibold">{formatCurrency(data.total_revenue_month ?? null)}</TableCell>
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
                  {(tyLeQuyLuong as number).toFixed(1)}%
                </span>
              ) : '-'}
            </TableCell>
          </TableRow>
          
          {/* Expanded row with salary chart */}
          {expandedRow === departmentName && (
            <TableRow>
              <TableCell colSpan={13} className="p-4">
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
    const totals = calculateTotals();
    const thangDaChia = soThangDaChia;
    const thangConLai = Math.max(12 - thangDaChia, 0);
    const quyLuongTrungBinh = (thangDaChia > 0 && totals.total_salary_month !== undefined) ? (totals.total_salary_month / thangDaChia) : null;
    let quyLuongConLai = null;
    // For monthly data, we don't have quy_cung_2025, so we'll set these to null for now
    let tyLeQuyLuong: number | null = null;

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
              {(tyLeQuyLuong as number).toFixed(1)}%
            </span>
          ) : '-'}
        </TableCell>
      </TableRow>
    );

    return rows;
  };

  useEffect(() => {
    fetchKpiData();
  }, [soThangDaChia]);

  return (
    <Card className="flex-grow flex flex-col h-[600px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          Bảng duyệt quỹ lương các tỉnh tháng {soThangDaChia}
        </CardTitle>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="soThangDaChia" className="text-xs font-medium">
              Số tháng đã chia (tự động):
            </Label>
            <Input
              id="soThangDaChia"
              type="number"
              value={soThangDaChia}
              onChange={(e) => setSoThangDaChia(Number(e.target.value))}
              className="w-20 h-7 text-xs"
              min="1"
              max="12"
              title="Tự động tính: nếu ngày hiện tại < 10 thì = tháng hiện tại - 2, ngược lại = tháng hiện tại - 1"
            />
            <span className="text-xs text-muted-foreground">
              (Tự động: {new Date().getDate() < 10 ? 'tháng hiện tại - 2' : 'tháng hiện tại - 1'})
            </span>
          </div>
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
                  Lương FT tháng {soThangDaChia} {renderSortIcon('ft_salary_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px] cursor-pointer', sortKey === 'pt_salary_month' && 'font-bold')} onClick={() => handleSort('pt_salary_month')}>
                  Lương PT tháng {soThangDaChia} {renderSortIcon('pt_salary_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'total_salary_month' && 'font-bold')} onClick={() => handleSort('total_salary_month')}>
                  Tổng quỹ lương tháng {soThangDaChia} {renderSortIcon('total_salary_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'total_revenue_month' && 'font-bold')} onClick={() => handleSort('total_revenue_month')}>
                  Tổng doanh thu tháng {soThangDaChia} {renderSortIcon('total_revenue_month')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('salary_revenue_ratio')}>
                  QL/DT lũy kế {renderSortIcon('salary_revenue_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'allowed_salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('allowed_salary_revenue_ratio')}>
                  QL/DT được phép {renderSortIcon('allowed_salary_revenue_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'excess_ratio' && 'font-bold')} onClick={() => handleSort('excess_ratio')}>
                  Tỷ lệ vượt quỹ {renderSortIcon('excess_ratio')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'excess_fund' && 'font-bold')} onClick={() => handleSort('excess_fund')}>
                  Quỹ cứng vượt {renderSortIcon('excess_fund')}
                </TableHead>
                <TableHead className={cn('py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px] cursor-pointer', sortKey === 'additional_salary_fund' && 'font-bold')} onClick={() => handleSort('additional_salary_fund')}>
                  Quỹ lương phải bù thêm {renderSortIcon('additional_salary_fund')}
                </TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ lương trung bình đã chia</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[130px]">Quỹ lương còn lại được chia</TableHead>
                <TableHead className="py-1.5 px-2 text-xs font-medium whitespace-nowrap text-right min-w-[120px]">QL còn lại/QL đã chia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={13} className="text-center">Đang tải...</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={13} className="text-center text-red-500">{error}</TableCell></TableRow>
              ) : Object.keys(sortedKpiData).length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center">Không có dữ liệu</TableCell></TableRow>
              ) : (
                renderFlatRows()
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
