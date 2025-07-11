"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, LineChart as LineChartIcon, Users } from 'lucide-react';
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
  loading: () => <div className="flex items-center justify-center h-[280px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Đang tải biểu đồ...</p></div>,
});

const chartConfig = {
  backOfficeRatio: {
    label: 'Tỷ lệ nhân viên khối back',
    color: 'hsl(var(--chart-2))',
    icon: Users,
  },
} satisfies ChartConfig;

interface MonthlyRatioData {
  year: number;
  month_label: string;
  back_office_count: number;
  total_count: number;
  back_office_ratio: number;
}

interface ChartDataPoint {
  month: string;
  currentYear: number;
  previousYear: number;
  currentYearLabel: string;
  previousYearLabel: string;
}

interface BackOfficeEmployeeRatioTrendChartProps {
  selectedYear?: number | null;
}

interface ChartError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function BackOfficeEmployeeRatioTrendChart({ selectedYear }: BackOfficeEmployeeRatioTrendChartProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ChartError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tỷ lệ nhân viên khối back theo tháng");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const yearToUse = selectedYear || new Date().getFullYear();
    setFilterDescription(`tỷ lệ nhân viên khối back theo tháng (${yearToUse} vs ${yearToUse - 1})`);

    try {
      const functionName = 'get_back_office_employee_ratio_by_month';
      const { data, error: rpcError } = await supabase.rpc(functionName, {
        p_filter_year: yearToUse
      });

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        if (isFunctionMissingError) {
          throw {
            type: 'rpcMissing' as 'rpcMissing',
            message: `Hàm RPC '${functionName}' bị thiếu. Vui lòng tạo theo README.md.`
          };
        }
        throw { type: 'generic' as 'generic', message: rpcError.message || 'Đã xảy ra lỗi RPC không xác định.'};
      }

      if (!data || data.length === 0) {
        setChartData([]);
        return;
      }

      const typedData = data as MonthlyRatioData[];
      
      // Group data by month and create chart data points
      const monthMap = new Map<string, { current: number; previous: number }>();
      
      typedData.forEach(item => {
        const monthKey = item.month_label;
        if (!monthMap.has(monthKey)) {
          monthMap.set(monthKey, { current: 0, previous: 0 });
        }
        
        const monthData = monthMap.get(monthKey)!;
        if (item.year === yearToUse) {
          monthData.current = item.back_office_ratio;
        } else if (item.year === yearToUse - 1) {
          monthData.previous = item.back_office_ratio;
        }
      });

      // Convert to chart data format and sort by month
      const chartDataPoints: ChartDataPoint[] = Array.from(monthMap.entries())
        .map(([month, data]) => ({
          month,
          currentYear: data.current,
          previousYear: data.previous,
          currentYearLabel: `${yearToUse}`,
          previousYearLabel: `${yearToUse - 1}`
        }))
        .sort((a, b) => {
          const monthA = parseInt(a.month.replace(/\D/g, ''));
          const monthB = parseInt(b.month.replace(/\D/g, ''));
          return monthA - monthB;
        });

      setChartData(chartDataPoints);

    } catch (err: any) {
      if (err.type === 'rpcMissing') {
        setError(err);
      } else {
        setError({ type: 'generic', message: err.message || 'Không thể tải dữ liệu tỷ lệ nhân viên khối back theo tháng.' });
      }
      console.error("Error fetching back office employee ratio trend:", err);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const yAxisFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return `${value.toFixed(1)}%`;
  };

  // Custom label cho recharts
  const renderRatioLabel = (props: any) => {
    const { x, y, value } = props;
    if (!value || value <= 0) return <></>;
    return (
      <text x={x} y={y - 8} textAnchor="middle" fontSize={11} fill="#888">
        {`${value.toFixed(1)}%`}
      </text>
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <LineChartIcon className="h-4 w-4" />
            Xu hướng tỷ lệ nhân viên khối back
          </CardTitle>
          <CardDescription className="text-xs truncate">
            Đang tải dữ liệu...
          </CardDescription>
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
            Lỗi Biểu Đồ
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p>
          {(error.message.includes(CRITICAL_SETUP_ERROR_PREFIX)) && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
              Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê trong thông báo lỗi và đảm bảo các hàm RPC, bảng và cột liên quan đã được thiết lập đúng theo README.md.
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
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5">
            <LineChartIcon className="h-4 w-4" />
            Xu hướng tỷ lệ nhân viên khối back
          </CardTitle>
          <CardDescription className="text-xs truncate" title={filterDescription}>
            Cho: {filterDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 flex items-center justify-center h-[280px]">
          <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và bộ lọc đã chọn.</p>
        </CardContent>
      </Card>
    );
  }

  const currentYear = selectedYear || new Date().getFullYear();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
          <LineChartIcon className="h-4 w-4" />
          Xu hướng tỷ lệ nhân viên khối back
        </CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Tỷ lệ nhân viên khối back cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig as any} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicComposedChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="month" 
                tickLine={false} 
                axisLine={false} 
                tickMargin={8} 
                className="text-xs"
                tickFormatter={(value) => value.replace('Tháng ', 'T')}
              />
              <Tooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="currentYear"
                stroke={chartConfig.backOfficeRatio.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={`Tỷ lệ nhân viên khối back (${currentYear})`}
                isAnimationActive={false}
                label={renderRatioLabel}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="previousYear"
                stroke="#8884d8"
                strokeDasharray="5 3"
                dot={{ r: 2 }}
                activeDot={false}
                name={`Tỷ lệ nhân viên khối back (${currentYear - 1})`}
                isAnimationActive={false}
                label={undefined}
              />
            </DynamicComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
} 