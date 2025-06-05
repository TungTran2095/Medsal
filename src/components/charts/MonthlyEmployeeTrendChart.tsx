
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Users, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
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

const DynamicLineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[280px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>,
});

const chartConfig = {
  employeeCount: {
    label: 'Số Lượng NV Full-time',
    color: 'hsl(var(--chart-1))',
    icon: Users,
  },
} satisfies ChartConfig;

interface MonthlyEmployeeDataEntry {
  month_label: string;
  year_val: number;
  employee_count: number;
}

interface MonthlyEmployeeTrendChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[]; 
  selectedNganhDoc?: string[];
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function MonthlyEmployeeTrendChart({ selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc }: MonthlyEmployeeTrendChartProps) {
  const [chartData, setChartData] = useState<MonthlyEmployeeDataEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);

    const yearPart = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm";
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
    if(appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    
    const description = `${monthPart} của ${yearPart} tại ${locationSegment}`;
    setFilterDescription(description);

    const rpcArgs = { 
      p_filter_year: selectedYear,
      p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
      p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
    };

    try {
      const functionName = 'get_monthly_employee_trend_fulltime';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        let isCriticalSetupError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        let setupErrorDetails = "";
        if (rpcMessageText.includes('relation "time" does not exist')) { setupErrorDetails += " Bảng 'Time' không tồn tại."; isCriticalSetupError = true; }
        if (rpcMessageText.includes('relation "fulltime" does not exist')) { setupErrorDetails += " Bảng 'Fulltime' không tồn tại."; isCriticalSetupError = true; }
        // Check for missing parameters if applicable
        if (rpcMessageText.includes('p_filter_locations') && rpcMessageText.includes('does not exist')) { setupErrorDetails += " Hàm RPC có thể chưa được cập nhật để nhận 'p_filter_locations TEXT[]'."; isCriticalSetupError = true;}
        if (rpcMessageText.includes('p_filter_nganh_docs') && rpcMessageText.includes('does not exist')) { setupErrorDetails += " Hàm RPC có thể chưa được cập nhật để nhận 'p_filter_nganh_docs TEXT[]'."; isCriticalSetupError = true;}


        if (isCriticalSetupError) {
          let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc các bảng/cột phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
          detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo các mục sau theo README.md:`;
          detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng trong Supabase và đã được cập nhật để nhận các tham số lọc cần thiết (ví dụ: 'p_filter_locations TEXT[]', 'p_filter_nganh_docs TEXT[]').`;
          detailedGuidance += `\n2. Các bảng 'Fulltime' (với các cột 'nam', 'thang', 'ma_nhan_vien', 'dia_diem', 'nganh_doc') và 'Time' (với các cột 'Năm', 'Thang_x', 'thangpro') tồn tại với đúng tên và các cột cần thiết.`;
          throw new Error(detailedGuidance);
        }
        throw rpcError;
      }

      const processedData = (rpcData || []).map((item: any) => ({
        month_label: String(item.month_label),
        year_val: Number(item.year_val),
        name: String(item.month_label), // For XAxis dataKey
        employee_count: Number(item.employee_count) || 0,
      }));
      
      const baseSortedData = processedData.sort((a, b) => {
        if (a.year_val !== b.year_val) return a.year_val - b.year_val;
        const monthANum = parseInt(String(a.month_label).replace(/\D/g, ''), 10);
        const monthBNum = parseInt(String(b.month_label).replace(/\D/g, ''), 10);
        if (!isNaN(monthANum) && !isNaN(monthBNum)) return monthANum - monthBNum;
        return String(a.month_label).localeCompare(String(b.month_label));
      });

      let finalChartDataToDisplay = baseSortedData;
      if (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) {
        finalChartDataToDisplay = baseSortedData.filter(item => {
          const monthNumber = parseInt(String(item.month_label).replace(/\D/g, ''), 10);
          return !isNaN(monthNumber) && selectedMonths.includes(monthNumber);
        });
      }
      setChartData(finalChartDataToDisplay);

    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu xu hướng số lượng nhân viên.');
      console.error("Error fetching monthly employee trend:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const yAxisFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return value.toLocaleString('vi-VN');
  };

  if (isLoading) { return ( <Card className="h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Biến Động Số Lượng NV Full-time</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu...</CardDescription> </CardHeader> <CardContent className="flex items-center justify-center h-[280px] pt-2"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { return ( <Card className="border-destructive/50 h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1"> <AlertTriangle className="h-4 w-4" /> Lỗi Biểu Đồ Số Lượng NV </CardTitle> </CardHeader> <CardContent className="pt-2"> <p className="text-xs text-destructive whitespace-pre-line">{error}</p> {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê trong thông báo lỗi và đảm bảo các hàm RPC, bảng và cột liên quan đã được thiết lập đúng theo README.md. </p> )} </CardContent> </Card> ); }
  if (chartData.length === 0) { return ( <Card className="h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Biến Động Số Lượng NV Full-time</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center h-[280px]"> <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và bộ lọc đã chọn.</p> </CardContent> </Card> ); }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Biến Động Số Lượng NV Full-time</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Số lượng nhân viên full-time theo tháng cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicLineChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={yAxisFormatter} 
                className="text-xs" 
                domain={['auto', 'auto']}
                allowDataOverflow={true}
              />
              <Tooltip 
                content={
                  <ChartTooltipContent 
                    indicator="line" 
                    formatter={(value, name, props) => {
                      const dataKey = props.dataKey as keyof typeof chartConfig;
                      const payloadValue = props.payload?.[dataKey];
                      if (typeof payloadValue === 'number') {
                        return `${payloadValue.toLocaleString('vi-VN')} NV`;
                      }
                      return String(value);
                    }}
                    labelFormatter={(label, payload) => (payload && payload.length > 0 && payload[0].payload) ? `${label}, ${payload[0].payload.year_val}` : label} 
                  />
                } 
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                wrapperStyle={{paddingBottom: "10px"}} 
                content={({ payload }) => (
                  <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                    {payload?.map((entry: any) => {
                      const configKey = entry.dataKey as keyof typeof chartConfig;
                      const Icon = chartConfig[configKey]?.icon;
                      return (
                        <div key={`item-${entry.dataKey}`} className="flex items-center gap-0.5 cursor-pointer text-xs">
                          {Icon && <Icon className="h-3 w-3" style={{ color: entry.color }} />}
                          <span style={{ color: entry.color }}>{chartConfig[configKey]?.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              />
              <Line 
                connectNulls 
                type="monotone" 
                dataKey="employee_count" 
                stroke="var(--color-employeeCount)" 
                strokeWidth={2} 
                dot={{ r: 3, strokeWidth: 1, className:'fill-background' }} 
                name={chartConfig.employeeCount.label} 
                label={{ 
                    formatter: (value: number) => value > 0 ? value.toLocaleString('vi-VN') : '', 
                    fontSize: 9, 
                    position: 'top', 
                    dy: -5, 
                    className: 'fill-muted-foreground' 
                }} 
              />
            </DynamicLineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
