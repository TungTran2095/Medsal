
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, TrendingUp, Banknote, Percent, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
import {
  ComposedChart, // Changed from LineChart to ComposedChart for multiple Y-axes
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
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

const chartConfig = {
  totalRevenue: {
    label: 'Doanh Thu',
    color: 'hsl(var(--chart-1))',
    icon: TrendingUp,
  },
  totalCombinedSalary: {
    label: 'Tổng Lương (FT+PT)',
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
  total_salary?: number; // Used by individual salary RPCs
  total_revenue?: number; // Used by revenue RPC
}

interface CombinedMonthlyTrendData {
  month_label: string;
  year_val: number;
  name: string; // For XAxis dataKey, derived from month_label
  totalRevenue?: number;
  totalCombinedSalary?: number;
  salaryRevenueRatio?: number;
}

interface CombinedMonthlyTrendChartProps {
  selectedYear?: number | null;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function CombinedMonthlyTrendChart({ selectedYear }: CombinedMonthlyTrendChartProps) {
  const [chartData, setChartData] = useState<CombinedMonthlyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các năm có sẵn");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);

    const description = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm có sẵn";
    setFilterDescription(description);

    const rpcArgs = { p_filter_year: selectedYear };
    let errorsOccurred: string[] = [];

    try {
      const [
        ftSalaryRes,
        ptSalaryRes,
        revenueRes,
      ] = await Promise.allSettled([
        supabase.rpc('get_monthly_salary_trend_fulltime', rpcArgs),
        supabase.rpc('get_monthly_salary_trend_parttime', rpcArgs),
        supabase.rpc('get_monthly_revenue_trend', rpcArgs),
      ]);

      const processResponse = (
        res: PromiseSettledResult<any>,
        dataType: string,
        functionName: string,
        dependentTables: string[]
      ): { data: MonthlyTrendDataEntry[], error?: string } => {
        if (res.status === 'fulfilled' && !res.value.error) {
          return { data: (res.value.data || []) as MonthlyTrendDataEntry[] };
        } else {
          const rpcError = res.status === 'fulfilled' ? res.value.error : res.reason;
          const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
          
          let isFunctionMissingError =
            rpcError.code === '42883' || // undefined_function
            (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
            (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

          let tableMissingErrorMsg = "";
          if (rpcMessageText.includes('relation "time" does not exist')) {
            tableMissingErrorMsg = " Bảng 'time' không tồn tại.";
            isFunctionMissingError = true; // Treat as setup error
          }
          dependentTables.forEach(table => {
            if (rpcMessageText.includes(`relation "${table.toLowerCase()}" does not exist`)) {
                tableMissingErrorMsg += ` Bảng '${table}' không tồn tại.`;
                isFunctionMissingError = true; // Treat as setup error
            }
          });

          if (isFunctionMissingError) {
            return { data: [], error: `${CRITICAL_SETUP_ERROR_PREFIX} Hàm RPC '${functionName}' hoặc bảng phụ thuộc ('time'${dependentTables.length > 0 ? `, ${dependentTables.join(', ')}` : ''}) bị thiếu/sai cấu hình.${tableMissingErrorMsg}` };
          }
          const baseMessage = `Lỗi tải dữ liệu ${dataType}`;
          const messageDetail = rpcError?.message ? `: ${rpcError.message}` : ".";
          return { data: [], error: `${baseMessage}${messageDetail}` };
        }
      };
      
      const ftSalaryResult = processResponse(ftSalaryRes, "lương full-time", 'get_monthly_salary_trend_fulltime', ['Fulltime']);
      if (ftSalaryResult.error) errorsOccurred.push(ftSalaryResult.error);

      const ptSalaryResult = processResponse(ptSalaryRes, "lương part-time", 'get_monthly_salary_trend_parttime', ['Parttime']);
      if (ptSalaryResult.error) errorsOccurred.push(ptSalaryResult.error);
      
      const revenueResult = processResponse(revenueRes, "doanh thu", 'get_monthly_revenue_trend', ['Doanh_thu']);
      if (revenueResult.error) errorsOccurred.push(revenueResult.error);

      if (errorsOccurred.length > 0) {
        setError(errorsOccurred.join('\n'));
        setIsLoading(false);
        return;
      }

      const mergedDataMap = new Map<string, CombinedMonthlyTrendData>();

      const addToMap = (data: MonthlyTrendDataEntry[], type: 'ft_salary' | 'pt_salary' | 'revenue') => {
        data.forEach(item => {
          const key = `${item.year_val}-${item.month_label}`;
          const existing = mergedDataMap.get(key) || {
            month_label: item.month_label,
            year_val: item.year_val,
            name: item.month_label,
            totalRevenue: 0,
            totalCombinedSalary: 0,
          };

          if (type === 'revenue') {
            existing.totalRevenue = (existing.totalRevenue || 0) + (Number(item.total_revenue) || 0);
          } else if (type === 'ft_salary') {
            existing.totalCombinedSalary = (existing.totalCombinedSalary || 0) + (Number(item.total_salary) || 0);
          } else if (type === 'pt_salary') {
            existing.totalCombinedSalary = (existing.totalCombinedSalary || 0) + (Number(item.total_salary) || 0);
          }
          mergedDataMap.set(key, existing);
        });
      };

      addToMap(ftSalaryResult.data, 'ft_salary');
      addToMap(ptSalaryResult.data, 'pt_salary');
      addToMap(revenueResult.data, 'revenue');
      
      const finalChartData = Array.from(mergedDataMap.values())
        .map(item => ({
          ...item,
          salaryRevenueRatio: (item.totalRevenue && item.totalRevenue !== 0) ? (item.totalCombinedSalary || 0) / item.totalRevenue : undefined, // undefined if revenue is 0 or null
        }))
        .sort((a, b) => {
          if (a.year_val !== b.year_val) return a.year_val - b.year_val;
          const monthA = parseInt(a.month_label.replace(/\D/g, ''));
          const monthB = parseInt(b.month_label.replace(/\D/g, ''));
          return monthA - monthB;
        });

      if (finalChartData.length > 0) {
        setChartData(finalChartData);
      }

    } catch (err: any) {
      setError(err.message || 'Không thể xử lý dữ liệu xu hướng hàng tháng.');
      console.error("Error processing combined monthly trend data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Đang tải dữ liệu xu hướng...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] pt-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Xu Hướng Hàng Tháng
          </CardTitle>
           <CardDescription className="text-xs text-destructive whitespace-pre-line">{error}</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && (
            <p className="text-xs text-muted-foreground mt-1">
              Vui lòng tham khảo tệp `README.md` để biết hướng dẫn tạo/sửa hàm Supabase hoặc bảng (`time`, `Fulltime`, `Parttime`, `Doanh_thu`) bị thiếu/sai. Kiểm tra lỗi sao chép khi chạy SQL và đảm bảo bảng `time` được cấu hình đúng.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card className="h-full">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[280px]">
         <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Doanh Thu, Lương & Tỷ Lệ</CardTitle>
        <CardDescription className="text-xs">
          Doanh thu, tổng lương (Full-time + Part-time) và tỷ lệ QL/DT mỗi tháng cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                domain={[0, 'auto']} // Ensure ratio starts at 0%
              />
              <Tooltip
                content={<ChartTooltipContent
                    indicator="line"
                    formatter={(value, name, props) => {
                        const dataKey = props.dataKey as keyof typeof chartConfig;
                        const payloadValue = props.payload?.[dataKey];

                        if (typeof payloadValue === 'number') {
                           if (dataKey === 'salaryRevenueRatio') {
                             return `${(payloadValue * 100).toFixed(1)}%`;
                           }
                           return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0  }).format(payloadValue);
                        }
                        return String(value); 
                    }}
                    labelFormatter={(label, payload) => (payload && payload.length > 0 && payload[0].payload) ? `${label}, ${payload[0].payload.year_val}` : label}
                    itemSorter={(item) => {
                        if (item.dataKey === 'totalRevenue') return 0;
                        if (item.dataKey === 'totalCombinedSalary') return 1;
                        if (item.dataKey === 'salaryRevenueRatio') return 2;
                        return 3;
                    }}
                />}
              />
              <Legend
                verticalAlign="top"
                height={36}
                content={({ payload }) => (
                    <div className="flex items-center justify-center gap-3 mb-1">
                      {payload?.map((entry: any) => {
                         const configKey = entry.dataKey as keyof typeof chartConfig;
                         const Icon = chartConfig[configKey]?.icon;
                         if (!chartConfig[configKey]) return null; // Skip if not in config
                         return (
                          <div key={`item-${entry.dataKey}`} className="flex items-center gap-1 cursor-pointer text-xs">
                            {Icon && <Icon className="h-3 w-3" style={{ color: entry.color }} />}
                            <span style={{ color: entry.color }}>{chartConfig[configKey]?.label}</span>
                          </div>
                         );
                      })}
                    </div>
                  )
                }
              />
              <Line yAxisId="left" type="monotone" dataKey="totalRevenue" stroke="var(--color-totalRevenue)" strokeWidth={2} dot={false} name={chartConfig.totalRevenue.label} connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="totalCombinedSalary" stroke="var(--color-totalCombinedSalary)" strokeWidth={2} dot={false} name={chartConfig.totalCombinedSalary.label} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="salaryRevenueRatio" stroke="var(--color-salaryRevenueRatio)" strokeWidth={2} dot={false} name={chartConfig.salaryRevenueRatio.label} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
