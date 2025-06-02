
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, LineChart as LineChartIcon, AlertTriangle, TrendingUp, Banknote } from 'lucide-react';
import {
  LineChart,
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
  totalSalary: {
    label: 'Tổng Lương',
    color: 'hsl(var(--chart-1))',
    icon: Banknote,
  },
  totalRevenue: {
    label: 'Tổng Doanh Thu',
    color: 'hsl(var(--chart-2))',
    icon: TrendingUp,
  },
} satisfies ChartConfig;

interface MonthlyTrendData {
  month_label: string; // From time.Thang_x
  year_val: number;
  total_salary?: number; // Optional as it might not exist for some months if revenue does
  total_revenue?: number; // Optional as it might not exist for some months if salary does
  name: string; // X-axis dataKey (derived from month_label)
}

interface MonthlySalaryTrendChartProps {
  selectedYear?: number | null;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function MonthlySalaryTrendChart({ selectedYear }: MonthlySalaryTrendChartProps) {
  const [chartData, setChartData] = useState<MonthlyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các năm có sẵn");

  const fetchMonthlyTrends = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm có sẵn";
    setFilterDescription(description);

    try {
      const rpcArgs: { p_filter_year?: number } = {};
      if (selectedYear !== null) {
        rpcArgs.p_filter_year = selectedYear;
      }

      const [salaryRes, revenueRes] = await Promise.allSettled([
        supabase.rpc('get_monthly_salary_trend_fulltime', rpcArgs),
        supabase.rpc('get_monthly_revenue_trend', rpcArgs),
      ]);

      let salaryData: any[] = [];
      let revenueData: any[] = [];
      let rpcErrorOccurred = false;

      if (salaryRes.status === 'fulfilled' && !salaryRes.value.error) {
        salaryData = salaryRes.value.data || [];
      } else if (salaryRes.status === 'rejected' || salaryRes.value.error) {
        const rpcError = salaryRes.status === 'fulfilled' ? salaryRes.value.error : salaryRes.reason;
        const functionName = 'get_monthly_salary_trend_fulltime';
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist')) ||
          rpcMessageText.includes('relation "time" does not exist');

        if (isFunctionMissingError) {
           let setupErrorMessage = `${CRITICAL_SETUP_ERROR_PREFIX} Hàm RPC Supabase '${functionName}' hoặc bảng 'time' bị thiếu/sai cấu hình.`;
           if (rpcMessageText.includes('relation "time" does not exist')) {
            setupErrorMessage += " Cụ thể, bảng 'time' không tồn tại.";
           }
           setError(setupErrorMessage);
        } else {
          setError(`Lỗi tải dữ liệu lương: ${rpcError.message}`);
        }
        console.error(`Error fetching monthly salary trend via RPC for ${functionName}:`, rpcError);
        rpcErrorOccurred = true;
      }

      if (revenueRes.status === 'fulfilled' && !revenueRes.value.error) {
        revenueData = revenueRes.value.data || [];
      } else if (revenueRes.status === 'rejected' || revenueRes.value.error) {
        const rpcError = revenueRes.status === 'fulfilled' ? revenueRes.value.error : revenueRes.reason;
        const functionName = 'get_monthly_revenue_trend';
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';

         const isFunctionMissingError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist')) ||
          rpcMessageText.includes('relation "time" does not exist') ||
          rpcMessageText.includes('relation "doanh_thu" does not exist');

        if (isFunctionMissingError) {
           let setupErrorMessage = `${CRITICAL_SETUP_ERROR_PREFIX} Hàm RPC Supabase '${functionName}' hoặc bảng phụ thuộc ('time', 'Doanh_thu') bị thiếu/sai cấu hình.`;
           if (rpcMessageText.includes('relation "time" does not exist')) {
            setupErrorMessage += " Cụ thể, bảng 'time' không tồn tại.";
           } else if (rpcMessageText.includes('relation "doanh_thu" does not exist')){
            setupErrorMessage += " Cụ thể, bảng 'Doanh_thu' không tồn tại.";
           }
           setError(prevError => prevError ? `${prevError}\n${setupErrorMessage}` : setupErrorMessage); // Append if salary error already exists
        } else {
          setError(prevError => prevError ? `${prevError}\nLỗi tải dữ liệu doanh thu: ${rpcError.message}` : `Lỗi tải dữ liệu doanh thu: ${rpcError.message}`);
        }
        console.error(`Error fetching monthly revenue trend via RPC for ${functionName}:`, rpcError);
        rpcErrorOccurred = true;
      }
      
      if (rpcErrorOccurred && !error) { // If individual RPCs failed but didn't set a critical setup error
        // Fallback error message if specific errors weren't critical type.
        if(!error) setError("Đã có lỗi xảy ra khi tải dữ liệu cho biểu đồ xu hướng.");
      }


      // Merge data
      const mergedDataMap = new Map<string, MonthlyTrendData>();

      salaryData.forEach(item => {
        const key = `${item.year_val}-${item.month_label}`;
        mergedDataMap.set(key, {
          ...mergedDataMap.get(key),
          month_label: item.month_label,
          year_val: item.year_val,
          total_salary: Number(item.total_salary) || 0,
          name: item.month_label,
        });
      });

      revenueData.forEach(item => {
        const key = `${item.year_val}-${item.month_label}`;
        mergedDataMap.set(key, {
          ...mergedDataMap.get(key),
          month_label: item.month_label,
          year_val: item.year_val,
          total_revenue: Number(item.total_revenue) || 0,
          name: item.month_label, // Ensure name is set even if only revenue exists for a month
        });
      });
      
      // Sort data: Need to convert month_label (Thang_x) to a sortable numeric month if not already sorted by time table's month_numeric
      // The SQL query for both functions *should* already be ordering by time.month_numeric.
      // If Thang_x is like "Tháng 01", "Tháng 02", it might sort okay as string.
      // If it's "Jan", "Feb", it will need numeric month for sorting.
      // For now, assuming SQL sort is sufficient. If not, will need to map Thang_x back to month_numeric here.
      const finalChartData = Array.from(mergedDataMap.values())
        .sort((a, b) => {
          if (a.year_val !== b.year_val) {
            return a.year_val - b.year_val;
          }
          // This is a basic sort for "Tháng XX" format. A robust solution would use month_numeric from time table if available.
          const monthA = parseInt(a.month_label.replace(/\D/g, ''));
          const monthB = parseInt(b.month_label.replace(/\D/g, ''));
          return monthA - monthB;
        });


      if (finalChartData.length > 0) {
        setChartData(finalChartData);
      } else if (!rpcErrorOccurred && !error) { // Only set to empty if no errors occurred during fetch
        setChartData([]);
      }


    } catch (err: any) {
      // Catch-all for unexpected errors during merging or processing
      if (!error) { // Avoid overwriting specific RPC errors
        setError(err.message || 'Không thể tải dữ liệu xu hướng hàng tháng.');
      }
      console.error("Error processing monthly trend data:", err);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, error]); // Added error to dependency to prevent re-fetch loops on error

  useEffect(() => {
    fetchMonthlyTrends();
  }, [fetchMonthlyTrends]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold">Xu Hướng Lương & Doanh Thu Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Đang tải dữ liệu xu hướng...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px] pt-2">
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
           <CardDescription className="text-xs text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {error.startsWith(CRITICAL_SETUP_ERROR_PREFIX) && (
            <p className="text-xs text-muted-foreground mt-1">
              Vui lòng tham khảo tệp `README.md` để biết hướng dẫn tạo/sửa hàm Supabase hoặc bảng (`time`, `Doanh_thu`) bị thiếu/sai. Kiểm tra lỗi sao chép khi chạy SQL và đảm bảo bảng `time` được cấu hình đúng với các cột giả định (ví dụ: `year_numeric`, `month_numeric`, `Thang_x`).
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card  className="h-full">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground">Xu Hướng Lương & Doanh Thu Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[250px]">
         <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card  className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold">Xu Hướng Lương & Doanh Thu Theo Tháng</CardTitle>
        <CardDescription className="text-xs">
          Tổng lương và doanh thu mỗi tháng cho {filterDescription}. Trục X lấy từ cột 'Thang_x' của bảng 'time'.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name" // 'name' is item.month_label (time.Thang_x)
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value)}
              />
              <Tooltip
                content={<ChartTooltipContent
                    indicator="line"
                    formatter={(value, name, props) => {
                        const payloadValue = name === 'totalSalary' ? props.payload?.total_salary : props.payload?.total_revenue;
                        if (typeof payloadValue === 'number') {
                           return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0  }).format(payloadValue);
                        }
                        return String(value); // Fallback if payloadValue is undefined
                    }}
                     labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0 && payload[0].payload) {
                          const year = payload[0].payload.year_val;
                          return `${label}, ${year}`;
                        }
                        return label;
                      }}
                     itemSorter={(item) => (item.name === 'totalSalary' ? 0 : 1)} // Ensure salary appears before revenue
                />}
              />
              <Legend
                verticalAlign="top"
                height={36}
                content={(props) => {
                  const { payload } = props;
                  return (
                    <div className="flex items-center justify-center gap-4 mb-1">
                      {payload?.map((entry: any, index: number) => {
                         const configKey = entry.dataKey as keyof typeof chartConfig;
                         const Icon = chartConfig[configKey]?.icon;
                         return (
                          <div
                            key={`item-${index}`}
                            className="flex items-center gap-1.5 cursor-pointer text-xs"
                            onClick={() => props.onClick?.(entry, index)}
                          >
                            {Icon && <Icon className="h-3 w-3" style={{ color: entry.color }}/>}
                            <span style={{ color: entry.color }}>{chartConfig[configKey]?.label}</span>
                          </div>
                         );
                      })}
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="total_salary"
                stroke="var(--color-totalSalary)"
                strokeWidth={2}
                dot={false}
                name={chartConfig.totalSalary.label}
                connectNulls // Connect line over missing data points
              />
              <Line
                type="monotone"
                dataKey="total_revenue"
                stroke="var(--color-totalRevenue)"
                strokeWidth={2}
                dot={false}
                name={chartConfig.totalRevenue.label}
                connectNulls // Connect line over missing data points
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
