
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, LineChart as LineChartIcon, AlertTriangle } from 'lucide-react';
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
  },
} satisfies ChartConfig;

interface MonthlyData {
  month_label: string; // Will come from time.Thang_x
  year_val: number;    // Will come from Fulltime.nam
  total_salary: number;
  name: string;        // This will be the actual X-axis dataKey value, derived from month_label
}

interface MonthlySalaryTrendChartProps {
  selectedYear?: number | null;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function MonthlySalaryTrendChart({ selectedYear }: MonthlySalaryTrendChartProps) {
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các năm");

  const fetchMonthlyTrend = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm có sẵn";
    setFilterDescription(description);

    try {
      const rpcArgs: { p_filter_year?: number } = {};
      if (selectedYear !== null) {
        rpcArgs.p_filter_year = selectedYear;
      }

      const functionName = 'get_monthly_salary_trend_fulltime';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';

        const isFunctionMissingError =
          rpcError.code === '42883' || // undefined_function
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) || // PostgREST could not find the function
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist')) ||
          rpcMessageText.includes('relation "time" does not exist'); // If time table is missing

        if (isFunctionMissingError) {
           let setupErrorMessage = `${CRITICAL_SETUP_ERROR_PREFIX} Hàm RPC Supabase '${functionName}' hoặc bảng 'time' phụ thuộc của nó bị thiếu hoặc cấu hình sai.`;
           if (rpcMessageText.includes('relation "time" does not exist')) {
            setupErrorMessage += " Cụ thể, bảng 'time' không tồn tại. Vui lòng tạo bảng này với các cột cần thiết (ví dụ: year_numeric, month_numeric, Thang_x).";
           } else {
            setupErrorMessage += " Vui lòng tạo/cập nhật hàm này trong SQL Editor của Supabase bằng script trong README.md và đảm bảo bảng 'time' tồn tại và có cấu trúc đúng.";
           }
           throw new Error(setupErrorMessage);
        }
        throw rpcError;
      }

      if (data) {
        // Data from RPC: { month_label: string, year_val: number, total_salary: number }
        const formattedData = data.map((item: any) => ({
          month_label: item.month_label,
          year_val: item.year_val,
          total_salary: Number(item.total_salary) || 0,
          name: item.month_label, // Use Thang_x directly as the X-axis label
        }));
        setChartData(formattedData);
      } else {
        setChartData([]);
      }

    } catch (err: any) {
      let uiErrorMessage = err.message || 'Không thể tải xu hướng lương hàng tháng qua RPC.';
      setError(uiErrorMessage);
      console.error("Error fetching monthly salary trend via RPC. Details:", {
          message: err.message,
          name: err.name,
          code: err.code,
          stack: err.stack,
          originalErrorObject: err
      });
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchMonthlyTrend();
  }, [fetchMonthlyTrend]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold">Xu Hướng Lương Theo Tháng</CardTitle>
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
              Vui lòng tham khảo tệp `README.md`, cụ thể là phần "Required SQL Functions", để biết hướng dẫn cách tạo/sửa hàm Supabase hoặc bảng `time` bị thiếu. Kiểm tra kỹ lỗi sao chép khi chạy SQL và đảm bảo bảng `time` được cấu hình đúng với các cột giả định (ví dụ: `year_numeric`, `month_numeric`, `Thang_x`).
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
          <CardTitle className="text-base font-semibold text-muted-foreground">Xu Hướng Lương Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[250px]">
         <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu lương cho kỳ đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card  className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold">Xu Hướng Lương Theo Tháng</CardTitle>
        <CardDescription className="text-xs">
          Tổng lương ('tong_thu_nhap') mỗi tháng cho {filterDescription}. Trục X lấy từ cột 'Thang_x' của bảng 'time'.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name" // 'name' is now directly item.month_label (time.Thang_x)
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
                    formatter={(value, name, props) => { // name here is 'total_salary'
                        const payloadValue = props.payload?.total_salary;
                        if (typeof payloadValue === 'number') {
                           return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0  }).format(payloadValue);
                        }
                        return String(value);
                    }}
                     labelFormatter={(label, payload) => { // label here is the value of XAxis dataKey ('name')
                        if (payload && payload.length > 0 && payload[0].payload) {
                          const year = payload[0].payload.year_val;
                          return `${label}, ${year}`; // Display "Thang_x, YYYY"
                        }
                        return label;
                      }}
                />}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Line
                type="monotone"
                dataKey="total_salary"
                stroke="var(--color-totalSalary)"
                strokeWidth={2}
                dot={false}
                name={chartConfig.totalSalary.label}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
