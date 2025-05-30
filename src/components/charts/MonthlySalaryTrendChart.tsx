
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
    label: 'Tổng Lương', // Translated
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig;

interface MonthlyData {
  month: number;
  year: number;
  total_salary: number;
  name: string; 
}

interface MonthlySalaryTrendChartProps {
  selectedYears?: number[];
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function MonthlySalaryTrendChart({ selectedYears }: MonthlySalaryTrendChartProps) {
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các năm");

  const fetchMonthlyTrend = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let description = (selectedYears && selectedYears.length > 0) 
      ? `Năm ${selectedYears.join(', ')}` 
      : "tất cả các năm có sẵn";
    setFilterDescription(description);
    
    try {
      const rpcArgs: { p_filter_years?: number[] } = {};
      rpcArgs.p_filter_years = selectedYears && selectedYears.length > 0 ? selectedYears : undefined;


      const functionName = 'get_monthly_salary_trend_fulltime';
      const { data, error: rpcError } = await supabase.rpc(
        functionName,
        rpcArgs
      );

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        
        const isFunctionMissingError =
          rpcError.code === '42883' || 
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) || 
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        if (isFunctionMissingError) {
          throw new Error(`${CRITICAL_SETUP_ERROR_PREFIX} Hàm RPC Supabase '${functionName}' bị thiếu. Biểu đồ này không thể hiển thị dữ liệu nếu không có nó. Vui lòng tạo hàm này trong SQL Editor của Supabase bằng script trong phần 'Required SQL Functions' của README.md.`);
        }
        throw rpcError; 
      }

      if (data) {
        const formattedData = data.map((item: any) => ({
          ...item,
          name: `${String(item.month).padStart(2, '0')}/${item.year}`, // Format as MM/YYYY
          total_salary: Number(item.total_salary) || 0,
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
  }, [selectedYears]);

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
              Vui lòng tham khảo tệp `README.md`, cụ thể là phần "Required SQL Functions", để biết hướng dẫn cách tạo hàm Supabase bị thiếu. Kiểm tra kỹ lỗi sao chép khi chạy SQL.
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
          Tổng lương ('tong_thu_nhap') mỗi tháng cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="name" 
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
                    formatter={(value) => {
                        if (typeof value === 'number') {
                           return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0  }).format(value);
                        }
                        return String(value);
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
                name={chartConfig.totalSalary.label} // Use translated label
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
