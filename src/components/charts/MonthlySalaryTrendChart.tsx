
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, TrendingUp, Banknote, Percent, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

const DynamicComposedChart = dynamic(() => import('recharts').then(mod => mod.ComposedChart), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[280px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>,
});


const chartConfig = {
  totalRevenue: {
    label: 'Doanh Thu',
    color: 'hsl(var(--chart-1))',
    icon: TrendingUp,
  },
  totalCombinedSalary: {
    label: 'Tổng Lương',
    color: 'hsl(var(--chart-2))',
    icon: Banknote,
  },
  salaryRevenueRatio: {
    label: 'Tỷ Lệ QL/DT',
    color: 'hsl(var(--chart-3))',
    icon: Percent,
  },
} satisfies ChartConfig;

interface MonthlyTrendDataEntry {
  month_label: string;
  year_val: number;
  total_salary?: number;
  total_revenue?: number;
}

interface CombinedMonthlyTrendData {
  month_label: string;
  year_val: number;
  name: string;
  totalRevenue?: number | null;
  totalCombinedSalary?: number | null;
  salaryRevenueRatio?: number | null;
}

interface CombinedMonthlyTrendChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[]; 
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function CombinedMonthlyTrendChart({ selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2 }: CombinedMonthlyTrendChartProps) {
  const [chartData, setChartData] = useState<CombinedMonthlyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);

    let description;
    const yearPart = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm có sẵn";
    let monthPart = "tất cả các tháng";
    if (selectedMonths && selectedMonths.length > 0) {
        if (selectedMonths.length === 12) monthPart = "tất cả các tháng";
        else if (selectedMonths.length === 1) monthPart = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
        else monthPart = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
    }
    
    let locationSegment = "tất cả";
    let appliedFilters: string[] = [];
    if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
      appliedFilters.push(selectedDepartmentsForDiadiem.length <= 2 ? selectedDepartmentsForDiadiem.join(' & ') : `${selectedDepartmentsForDiadiem.length} địa điểm (Loại/Pban)`);
    }
    if (selectedNganhDoc && selectedNganhDoc.length > 0) {
      appliedFilters.push(selectedNganhDoc.length <= 2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (selectedDonVi2 && selectedDonVi2.length > 0) {
      appliedFilters.push(selectedDonVi2.length <= 2 ? selectedDonVi2.join(' & ') : `${selectedDonVi2.length} đơn vị 2`);
    }
    if(appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    
    description = `${monthPart} của ${yearPart} tại ${locationSegment}`;
    setFilterDescription(description);


    const rpcArgsBase = { 
      p_filter_year: selectedYear,
      p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
    };
    const rpcArgsFt = {...rpcArgsBase, p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null };
    const rpcArgsPt = {...rpcArgsBase, p_filter_donvi2: (selectedDonVi2 && selectedDonVi2.length > 0) ? selectedDonVi2 : null };
    const rpcArgsRevenue = {...rpcArgsBase}; // Revenue doesn't use nganh_doc/donvi2


    let errorsOccurred: string[] = [];

    try {
      const [
        ftSalaryRes,
        ptSalaryRes,
        revenueRes,
      ] = await Promise.allSettled([
        supabase.rpc('get_monthly_salary_trend_fulltime', rpcArgsFt),
        supabase.rpc('get_monthly_salary_trend_parttime', rpcArgsPt),
        supabase.rpc('get_monthly_revenue_trend', rpcArgsRevenue),
      ]);

      const processResponse = (
        res: PromiseSettledResult<any>,
        dataType: string,
        functionName: string,
        mainDataTableName: 'Fulltime' | 'Parttime' | 'Doanh_thu',
        salaryColumnName: string = 'tong_thu_nhap',
        missingParamCheck?: string
      ): { data: MonthlyTrendDataEntry[], error?: string } => {
        if (res.status === 'fulfilled' && !res.value.error) {
          return { data: (res.value.data || []) as MonthlyTrendDataEntry[] };
        } else {
          const rpcError = res.status === 'fulfilled' ? res.value.error : res.reason;
          const rpcMessageText = rpcError?.message ? String(rpcError.message).toLowerCase() : '';

          let isCriticalSetupError =
            rpcError?.code === '42883' ||
            (rpcError?.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
            (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
          
          const isParamMissingError = missingParamCheck && rpcMessageText.includes(missingParamCheck) && rpcMessageText.includes("does not exist");
          if (isParamMissingError) isCriticalSetupError = true;


          let setupErrorDetails = "";
          if (isParamMissingError) {
             setupErrorDetails += ` Tham số '${missingParamCheck}' dường như bị thiếu trong hàm RPC '${functionName}'.`;
          }

          // ... (keep existing detailed error checks for tables/columns)
          let expectedNamColumn = 'nam';
          let expectedThangColumn = 'thang';
          if (mainDataTableName === 'Parttime') { expectedNamColumn = '"Nam"'; expectedThangColumn = '"Thoi gian"'; }
          else if (mainDataTableName === 'Doanh_thu') { expectedNamColumn = '"Năm"'; expectedThangColumn = '"Tháng"'; }

          if (rpcMessageText.includes('relation "time" does not exist')) { setupErrorDetails += " Bảng 'Time' không tồn tại."; isCriticalSetupError = true; }
          if (rpcMessageText.includes(`relation "${mainDataTableName.toLowerCase()}" does not exist`)) { setupErrorDetails += ` Bảng '${mainDataTableName}' không tồn tại.`; isCriticalSetupError = true; }
          // ... (other specific column checks)

          if (isCriticalSetupError) {
            let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
            // ... (keep existing guidance messages)
            detailedGuidance += `\n5. Đảm bảo RPC '${functionName}' đã được cập nhật để chấp nhận tham số lọc mới (ví dụ: p_filter_nganh_docs, p_filter_donvi2) nếu có.`;
            return { data: [], error: detailedGuidance };
          }

          const baseMessage = `Lỗi tải dữ liệu ${dataType}`;
          const messageDetail = rpcError?.message ? `: ${rpcError.message}` : (res.status === 'rejected' ? `: ${String(res.reason)}` : ". (Lỗi RPC không xác định)");
          return { data: [], error: `${baseMessage}${messageDetail}` };
        }
      };

      const ftSalaryResult = processResponse(ftSalaryRes, "lương full-time", 'get_monthly_salary_trend_fulltime', 'Fulltime', 'tong_thu_nhap', 'p_filter_nganh_docs');
      if (ftSalaryResult.error) errorsOccurred.push(ftSalaryResult.error);

      const ptSalaryResult = processResponse(ptSalaryRes, "lương part-time", 'get_monthly_salary_trend_parttime', 'Parttime', '"Tong tien"', 'p_filter_donvi2');
      if (ptSalaryResult.error) errorsOccurred.push(ptSalaryResult.error);

      const revenueResult = processResponse(revenueRes, "doanh thu", 'get_monthly_revenue_trend', 'Doanh_thu', '"Kỳ báo cáo"');
      if (revenueResult.error) errorsOccurred.push(revenueResult.error);

      if (errorsOccurred.length > 0) {
        setError(errorsOccurred.join('\n\n---\n\n'));
        setIsLoading(false);
        return;
      }

      const mergedDataMap = new Map<string, CombinedMonthlyTrendData>();
      const addToMap = (data: MonthlyTrendDataEntry[], type: 'ft_salary' | 'pt_salary' | 'revenue') => {
        data.forEach(item => {
          const key = `${item.year_val}-${item.month_label}`;
          const existing = mergedDataMap.get(key) || { month_label: item.month_label, year_val: item.year_val, name: item.month_label, totalRevenue: 0, totalCombinedSalary: 0, };
          if (type === 'revenue' && item.total_revenue !== undefined) existing.totalRevenue = (existing.totalRevenue || 0) + (Number(item.total_revenue) || 0);
          else if ((type === 'ft_salary' || type === 'pt_salary') && item.total_salary !== undefined) existing.totalCombinedSalary = (existing.totalCombinedSalary || 0) + (Number(item.total_salary) || 0);
          mergedDataMap.set(key, existing);
        });
      };
      addToMap(ftSalaryResult.data, 'ft_salary');
      addToMap(ptSalaryResult.data, 'pt_salary');
      addToMap(revenueResult.data, 'revenue');

      const processedData = Array.from(mergedDataMap.values()).map(item => ({ ...item, totalRevenue: item.totalRevenue === 0 ? null : item.totalRevenue, totalCombinedSalary: item.totalCombinedSalary === 0 ? null : item.totalCombinedSalary, salaryRevenueRatio: (item.totalRevenue && item.totalRevenue !== 0) ? (item.totalCombinedSalary || 0) / item.totalRevenue : null, }));
      const baseSortedData = processedData.filter(item => (typeof item.totalRevenue === 'number' && item.totalRevenue !== 0) || (typeof item.totalCombinedSalary === 'number' && item.totalCombinedSalary !== 0)).sort((a, b) => { if (a.year_val !== b.year_val) return a.year_val - b.year_val; const monthANum = parseInt(String(a.month_label).replace(/\D/g, ''), 10); const monthBNum = parseInt(String(b.month_label).replace(/\D/g, ''), 10); if (!isNaN(monthANum) && !isNaN(monthBNum)) return monthANum - monthBNum; return String(a.month_label).localeCompare(String(b.month_label)); });
      let finalChartDataToDisplay = baseSortedData;
      if (selectedMonths && selectedMonths.length > 0) { finalChartDataToDisplay = baseSortedData.filter(item => { const monthNumber = parseInt(String(item.month_label).replace(/\D/g, ''), 10); return !isNaN(monthNumber) && selectedMonths.includes(monthNumber); }); }
      setChartData(finalChartDataToDisplay);

    } catch (err: any) {
      setError(err.message || 'Không thể xử lý dữ liệu xu hướng hàng tháng.');
      console.error("Error processing combined monthly trend data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currencyLabelFormatter = (value: number) => { if (value === null || value === undefined) return ''; return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value); };
  const percentageLabelFormatter = (value: number) => { if (value === null || value === undefined) return ''; return `${(value * 100).toFixed(0)}%`; };

  if (isLoading) { return ( <Card className="h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu xu hướng...</CardDescription> </CardHeader> <CardContent className="flex items-center justify-center h-[280px] pt-2"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { const errorMessages = error.split('\n\n---\n\n'); return ( <Card className="border-destructive/50 h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1"> <AlertTriangle className="h-4 w-4" /> Lỗi Xu Hướng Hàng Tháng </CardTitle> </CardHeader> <CardContent className="pt-2"> {errorMessages.map((msg, index) => ( <div key={index} className="mb-2"> <CardDescription className="text-xs text-destructive whitespace-pre-line">{msg}</CardDescription> {(msg.includes(CRITICAL_SETUP_ERROR_PREFIX)) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê và đảm bảo các hàm RPC đã được cập nhật để hỗ trợ các tham số lọc mới. </p> )} </div> ))} </CardContent> </Card> ); }
  if (chartData.length === 0) { return ( <Card className="h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center h-[280px]"> <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và địa điểm đã chọn.</p> </CardContent> </Card> ); }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Doanh Thu, Lương & Tỷ Lệ</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Doanh thu, tổng lương và tỷ lệ QL/DT cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicComposedChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tickFormatter={() => ''} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickFormatter={() => ''} domain={[0, 'auto']} />
              <Tooltip content={<ChartTooltipContent indicator="line" formatter={(value, name, props) => { const dataKey = props.dataKey as keyof typeof chartConfig; const payloadValue = props.payload?.[dataKey]; if (typeof payloadValue === 'number') { if (dataKey === 'salaryRevenueRatio') return `${(payloadValue * 100).toFixed(1)}%`; return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(payloadValue); } return String(value); }} labelFormatter={(label, payload) => (payload && payload.length > 0 && payload[0].payload) ? `${label}, ${payload[0].payload.year_val}` : label} itemSorter={(item) => { if (item.dataKey === 'totalRevenue') return 0; if (item.dataKey === 'totalCombinedSalary') return 1; if (item.dataKey === 'salaryRevenueRatio') return 2; return 3; }} />} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{paddingBottom: "10px"}} content={({ payload }) => ( <div className="flex items-center justify-center gap-2 mb-1 flex-wrap"> {payload?.filter(p => chartConfig[p.dataKey as keyof typeof chartConfig]) .sort((a,b) => { const orderA = chartConfig[a.dataKey as keyof typeof chartConfig] ? (a.dataKey === 'totalRevenue' ? 0 : a.dataKey === 'totalCombinedSalary' ? 1 : 2) : 3; const orderB = chartConfig[b.dataKey as keyof typeof chartConfig] ? (b.dataKey === 'totalRevenue' ? 0 : b.dataKey === 'totalCombinedSalary' ? 1 : 2) : 3; return orderA - orderB; }) .map((entry: any) => { const configKey = entry.dataKey as keyof typeof chartConfig; const Icon = chartConfig[configKey]?.icon; return ( <div key={`item-${entry.dataKey}`} className="flex items-center gap-0.5 cursor-pointer text-xs"> {Icon && <Icon className="h-3 w-3" style={{ color: entry.color }} />} <span style={{ color: entry.color }}>{chartConfig[configKey]?.label}</span> </div> ); })} </div> ) } />
              <Line connectNulls yAxisId="left" type="monotone" dataKey="totalRevenue" stroke="var(--color-totalRevenue)" strokeWidth={2} dot={false} name={chartConfig.totalRevenue.label} label={{ formatter: currencyLabelFormatter, fontSize: 9, position: 'top', dy: -5, className: 'fill-muted-foreground' }} />
              <Line connectNulls yAxisId="left" type="monotone" dataKey="totalCombinedSalary" stroke="var(--color-totalCombinedSalary)" strokeWidth={2} dot={false} name={chartConfig.totalCombinedSalary.label} label={{ formatter: currencyLabelFormatter, fontSize: 9, position: 'top', dy: -5, className: 'fill-muted-foreground' }} />
              <Line connectNulls yAxisId="right" type="monotone" dataKey="salaryRevenueRatio" stroke="var(--color-salaryRevenueRatio)" strokeWidth={2} dot={{ r: 3, strokeWidth: 1, className:'fill-background' }} name={chartConfig.salaryRevenueRatio.label} label={{ formatter: percentageLabelFormatter, fontSize: 9, position: 'top', dy: -5, className: 'fill-muted-foreground' }} />
            </DynamicComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
