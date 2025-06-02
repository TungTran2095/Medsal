
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, TrendingUp, Banknote, Percent, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
import {
  ComposedChart,
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
  total_salary?: number;
  total_revenue?: number;
}

interface CombinedMonthlyTrendData {
  month_label: string;
  year_val: number;
  name: string;
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
        mainDataTableName: string // e.g., 'Fulltime', 'Parttime', 'Doanh_thu'
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

          let setupErrorDetails = "";

          if (rpcMessageText.includes('relation "time" does not exist')) {
            setupErrorDetails += " Bảng 'Time' (viết hoa T) không tồn tại.";
            isCriticalSetupError = true;
          }
          if (rpcMessageText.includes(`relation "${mainDataTableName.toLowerCase()}" does not exist`)) {
              setupErrorDetails += ` Bảng '${mainDataTableName}' không tồn tại.`;
              isCriticalSetupError = true;
          }

          const namColumnMissingPattern = new RegExp(`column "?(${mainDataTableName.toLowerCase()}|pt|dr)"?\\."?nam"? does not exist|column "?nam"? of relation "${mainDataTableName.toLowerCase()}" does not exist|column "?nam"? does not exist`, 'i');
          if (namColumnMissingPattern.test(rpcMessageText) && (rpcMessageText.includes(mainDataTableName.toLowerCase()) || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột 'nam' (INTEGER, dùng cho năm) dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }
          
          const thangColumnMissingPattern = new RegExp(`column "?(${mainDataTableName.toLowerCase()}|pt|dr)"?\\."?thang"? does not exist|column "?thang"? of relation "${mainDataTableName.toLowerCase()}" does not exist|column "?thang"? does not exist`, 'i');
          if (thangColumnMissingPattern.test(rpcMessageText) && (rpcMessageText.includes(mainDataTableName.toLowerCase()) || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột 'thang' (TEXT, ví dụ 'Tháng 01') dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }

          if (isCriticalSetupError) {
            let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc các bảng phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
            detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo các mục sau theo README.md:`;
            detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng trong Supabase.`;
            detailedGuidance += `\n2. Bảng 'Time' (viết hoa T) tồn tại với các cột: "Năm" (INTEGER), "thangpro" (INTEGER, 1-12), và "Thang_x" (TEXT).`;
            detailedGuidance += `\n3. Bảng '${mainDataTableName}' tồn tại với cột 'nam' (INTEGER) cho năm và cột 'thang' (TEXT, ví dụ 'Tháng 01') cho tháng.`;
            
            if (mainDataTableName === 'Doanh_thu') {
                detailedGuidance += `\n4. Bảng 'Doanh_thu' cũng cần cột "Kỳ báo cáo" (số liệu) và "Tên đơn vị" (TEXT).`;
            } else if (mainDataTableName === 'Fulltime' || mainDataTableName === 'Parttime') {
                detailedGuidance += `\n4. Bảng '${mainDataTableName}' cũng cần cột 'tong_thu_nhap' (số liệu).`;
            }
            return { data: [], error: detailedGuidance };
          }
          
          const baseMessage = `Lỗi tải dữ liệu ${dataType}`;
          const messageDetail = rpcError?.message ? `: ${rpcError.message}` : (res.status === 'rejected' ? `: ${String(res.reason)}` : ". (Không có thông báo lỗi cụ thể từ RPC)");
          return { data: [], error: `${baseMessage}${messageDetail}${messageDetail.endsWith('.') ? ' Kiểm tra cấu hình RPC hoặc bảng trong Supabase.' : ''}` };
        }
      };
      
      const ftSalaryResult = processResponse(ftSalaryRes, "lương full-time", 'get_monthly_salary_trend_fulltime', 'Fulltime');
      if (ftSalaryResult.error) errorsOccurred.push(ftSalaryResult.error);

      const ptSalaryResult = processResponse(ptSalaryRes, "lương part-time", 'get_monthly_salary_trend_parttime', 'Parttime');
      if (ptSalaryResult.error) errorsOccurred.push(ptSalaryResult.error);
      
      const revenueResult = processResponse(revenueRes, "doanh thu", 'get_monthly_revenue_trend', 'Doanh_thu');
      if (revenueResult.error) errorsOccurred.push(revenueResult.error);

      if (errorsOccurred.length > 0) {
        setError(errorsOccurred.join('\n\n---\n\n')); // Separate multiple critical errors clearly
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
            name: item.month_label, // This is Time."Thang_x"
            totalRevenue: 0,
            totalCombinedSalary: 0,
          };

          if (type === 'revenue' && item.total_revenue !== undefined) {
            existing.totalRevenue = (existing.totalRevenue || 0) + (Number(item.total_revenue) || 0);
          } else if (type === 'ft_salary' && item.total_salary !== undefined) {
            existing.totalCombinedSalary = (existing.totalCombinedSalary || 0) + (Number(item.total_salary) || 0);
          } else if (type === 'pt_salary' && item.total_salary !== undefined) {
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
          salaryRevenueRatio: (item.totalRevenue && item.totalRevenue !== 0) ? (item.totalCombinedSalary || 0) / item.totalRevenue : undefined,
        }))
        .sort((a, b) => {
          if (a.year_val !== b.year_val) return a.year_val - b.year_val;
          const monthANum = parseInt(String(a.month_label).replace(/\D/g, ''), 10);
          const monthBNum = parseInt(String(b.month_label).replace(/\D/g, ''), 10);
          if (!isNaN(monthANum) && !isNaN(monthBNum)) {
            return monthANum - monthBNum;
          }
          return String(a.month_label).localeCompare(String(b.month_label));
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
    // Split error messages by the separator for better display if multiple critical errors occurred
    const errorMessages = error.split('\n\n---\n\n');
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Xu Hướng Hàng Tháng
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {errorMessages.map((msg, index) => (
            <div key={index} className="mb-2">
              <CardDescription className="text-xs text-destructive whitespace-pre-line">{msg}</CardDescription>
              {(msg.includes(CRITICAL_SETUP_ERROR_PREFIX)) && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê ở trên trong cơ sở dữ liệu Supabase và tệp README.md.
                  Đảm bảo rằng tất cả các bảng và hàm RPC được đặt tên chính xác (có phân biệt chữ hoa chữ thường cho tên bảng như 'Time', 'Fulltime', 'Parttime', 'Doanh_thu') và có đúng các cột được yêu cầu.
                </p>
              )}
            </div>
          ))}
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
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}> {/* Adjusted margins */}
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
                domain={[0, 'auto']} 
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
                    itemSorter={(item) => { // Ensure consistent legend/tooltip order
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
                wrapperStyle={{paddingBottom: "10px"}}
                content={({ payload }) => (
                    <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                      {payload?.filter(p => chartConfig[p.dataKey as keyof typeof chartConfig]) // Filter out items not in config
                        .sort((a,b) => { // Sort legend items to match itemSorter in tooltip
                            const orderA = chartConfig[a.dataKey as keyof typeof chartConfig] ? (a.dataKey === 'totalRevenue' ? 0 : a.dataKey === 'totalCombinedSalary' ? 1 : 2) : 3;
                            const orderB = chartConfig[b.dataKey as keyof typeof chartConfig] ? (b.dataKey === 'totalRevenue' ? 0 : b.dataKey === 'totalCombinedSalary' ? 1 : 2) : 3;
                            return orderA - orderB;
                        })
                        .map((entry: any) => {
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
                  )
                }
              />
              <Line yAxisId="left" type="monotone" dataKey="totalRevenue" stroke="var(--color-totalRevenue)" strokeWidth={2} dot={false} name={chartConfig.totalRevenue.label} connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="totalCombinedSalary" stroke="var(--color-totalCombinedSalary)" strokeWidth={2} dot={false} name={chartConfig.totalCombinedSalary.label} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="salaryRevenueRatio" stroke="var(--color-salaryRevenueRatio)" strokeWidth={2} dot={{ r: 3, strokeWidth: 1 }} name={chartConfig.salaryRevenueRatio.label} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

