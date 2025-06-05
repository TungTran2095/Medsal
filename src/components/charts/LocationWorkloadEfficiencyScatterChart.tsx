
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, ScatterChart as ScatterChartIcon, Banknote, TrendingUp } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Scatter, ZAxis } from 'recharts';
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

const DynamicScatterChart = dynamic(() => import('recharts').then(mod => mod.ScatterChart), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[350px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Đang tải biểu đồ...</p></div>,
});

const chartConfig = {
  ft_salary_per_ft_workday: {
    label: 'Lương FT/Công',
    color: 'hsl(var(--chart-1))',
    icon: Banknote,
  },
  revenue_per_ft_workday: {
    label: 'Doanh Thu/Công (FT)',
    color: 'hsl(var(--chart-2))',
    icon: TrendingUp,
  },
} satisfies ChartConfig;

interface LocationWorkloadData {
  location_name: string;
  ft_salary_per_ft_workday: number | null;
  revenue_per_ft_workday: number | null;
}

interface LocationWorkloadEfficiencyScatterChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

const currencyLabelFormatter = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
};


export default function LocationWorkloadEfficiencyScatterChart({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: LocationWorkloadEfficiencyScatterChartProps) {
  const [chartData, setChartData] = useState<LocationWorkloadData[]>([]);
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
      p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
      p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
      p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
    };

    try {
      const functionName = 'get_ft_workload_efficiency_by_location';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        let isCriticalSetupError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        let setupErrorDetails = "";
        if (rpcMessageText.includes('relation "fulltime" does not exist')) { setupErrorDetails += " Bảng 'Fulltime' không tồn tại."; isCriticalSetupError = true; }
        if (rpcMessageText.includes('relation "doanh_thu" does not exist')) { setupErrorDetails += " Bảng 'Doanh_thu' không tồn tại."; isCriticalSetupError = true; }
        // Check for missing workday columns in Fulltime if error indicates
        const workdayColumns = ['ngay_thuong_chinh_thuc', 'ngay_thuong_thu_viec', 'nghi_tuan', 'le_tet', 'ngay_thuong_chinh_thuc2', 'ngay_thuong_thu_viec3', 'nghi_tuan4', 'le_tet5', 'nghi_nl'];
        for (const col of workdayColumns) {
            if (rpcMessageText.includes(`column f.${col} does not exist`)) {
                setupErrorDetails += ` Cột '${col}' không tồn tại trong bảng 'Fulltime'.`;
                isCriticalSetupError = true;
                break;
            }
        }

        if (isCriticalSetupError) {
          let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc các bảng/cột phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
          detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo các mục sau theo README.md:`;
          detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng trong Supabase.`;
          detailedGuidance += `\n2. Các bảng 'Fulltime' (với các cột lương, công, địa điểm, ngành dọc) và 'Doanh_thu' (với các cột doanh thu, tên đơn vị) tồn tại với đúng tên và các cột cần thiết.`;
          throw new Error(detailedGuidance);
        }
        throw rpcError;
      }

      const processedData = (rpcData || []).map((item: any) => ({
        location_name: String(item.location_name),
        ft_salary_per_ft_workday: (item.ft_salary_per_ft_workday === null || item.ft_salary_per_ft_workday === undefined) ? null : Number(item.ft_salary_per_ft_workday),
        revenue_per_ft_workday: (item.revenue_per_ft_workday === null || item.revenue_per_ft_workday === undefined) ? null : Number(item.revenue_per_ft_workday),
      })).filter(d => d.ft_salary_per_ft_workday !== null && d.revenue_per_ft_workday !== null && d.ft_salary_per_ft_workday > 0 && d.revenue_per_ft_workday > 0); // Filter out nulls and non-positive values
      
      setChartData(processedData);

    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu hiệu suất theo địa điểm.');
      console.error("Error fetching location workload efficiency:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const axisFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value);
  };

  if (isLoading) { return ( <Card className="h-[400px] mt-3"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><ScatterChartIcon className="h-4 w-4" />Lương FT/Công vs. Doanh Thu/Công (Theo Địa Điểm)</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu...</CardDescription> </CardHeader> <CardContent className="flex items-center justify-center h-full pt-2"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { return ( <Card className="border-destructive/50 h-[400px] mt-3"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1"> <AlertTriangle className="h-4 w-4" /> Lỗi Biểu Đồ Phân Tán </CardTitle> </CardHeader> <CardContent className="pt-2"> <p className="text-xs text-destructive whitespace-pre-line">{error}</p> {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê trong thông báo lỗi và đảm bảo các hàm RPC, bảng và cột liên quan đã được thiết lập đúng theo README.md. </p> )} </CardContent> </Card> ); }
  if (chartData.length === 0) { return ( <Card className="h-[400px] mt-3"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><ScatterChartIcon className="h-4 w-4" />Lương FT/Công vs. Doanh Thu/Công (Theo Địa Điểm)</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center h-full"> <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và bộ lọc đã chọn, hoặc các giá trị bằng 0.</p> </CardContent> </Card> ); }

  return (
    <Card className="h-[400px] mt-3">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><ScatterChartIcon className="h-4 w-4" />Lương FT/Công vs. Doanh Thu/Công (Theo Địa Điểm)</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Hiệu suất theo địa điểm cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="revenue_per_ft_workday" 
                name={chartConfig.revenue_per_ft_workday.label} 
                tickFormatter={axisFormatter} 
                className="text-xs"
                label={{ value: chartConfig.revenue_per_ft_workday.label, position: 'insideBottom', offset: -15, className:'text-xs fill-muted-foreground' }}
              />
              <YAxis 
                type="number" 
                dataKey="ft_salary_per_ft_workday" 
                name={chartConfig.ft_salary_per_ft_workday.label} 
                tickFormatter={axisFormatter} 
                className="text-xs"
                label={{ value: chartConfig.ft_salary_per_ft_workday.label, angle: -90, position: 'insideLeft', offset: 0, className:'text-xs fill-muted-foreground' }}
              />
              <ZAxis type="category" dataKey="location_name" name="Địa điểm" />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={
                  <ChartTooltipContent
                    labelKey="location_name"
                    formatter={(value, name, props) => {
                       if (props.dataKey === 'ft_salary_per_ft_workday') {
                        return `${currencyLabelFormatter(value as number)} (${chartConfig.ft_salary_per_ft_workday.label})`;
                       }
                       if (props.dataKey === 'revenue_per_ft_workday') {
                        return `${currencyLabelFormatter(value as number)} (${chartConfig.revenue_per_ft_workday.label})`;
                       }
                      return String(value);
                    }}
                    itemSorter={(item) => (item.dataKey === 'revenue_per_ft_workday' ? 0 : 1)}
                    indicator="dot"
                  />
                }
              />
              <Scatter 
                name="Hiệu suất Địa điểm" 
                data={chartData} 
                fill="hsl(var(--chart-3))" 
              />
            </DynamicScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

