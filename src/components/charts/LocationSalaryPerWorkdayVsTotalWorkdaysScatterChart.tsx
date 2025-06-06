
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, ScatterChart as ScatterChartIcon, Banknote, CalendarDays } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Scatter, ZAxis, LabelList } from 'recharts';
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
  total_ft_workdays: {
    label: 'Tổng Số Công (FT)',
    color: 'hsl(var(--chart-4))', // Using a different chart color
    icon: CalendarDays,
  },
} satisfies ChartConfig;

interface LocationSalaryWorkdayVsTotalWorkdaysData {
  location_name: string;
  ft_salary_per_ft_workday: number | null;
  total_ft_workdays: number | null;
}

interface LocationSalaryPerWorkdayVsTotalWorkdaysScatterChartProps {
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

const numberLabelFormatter = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short'
  }).format(value);
};

const CustomScatterDataLabel = (props: any) => {
  const { x, y, payload } = props;
  if (!payload || !payload.location_name) return null;
  return (
    <text x={x} y={y} dy={-7} fill="hsl(var(--muted-foreground))" fontSize={9} textAnchor="middle">
      {payload.location_name}
    </text>
  );
};

export default function LocationSalaryPerWorkdayVsTotalWorkdaysScatterChart({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: LocationSalaryPerWorkdayVsTotalWorkdaysScatterChartProps) {
  const [chartData, setChartData] = useState<LocationSalaryWorkdayVsTotalWorkdaysData[]>([]);
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
      const functionName = 'get_ft_workload_efficiency_by_location'; // Using the modified RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        let isCriticalSetupError =
          rpcError.code === '42883' ||
          (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
          (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        let setupErrorDetails = "";
        if (rpcMessageText.includes('relation "fulltime" does not exist')) { setupErrorDetails += " Bảng 'Fulltime' không tồn tại."; isCriticalSetupError = true; }
        if (!rpcMessageText.includes('column "total_ft_workdays" of relation') && rpcMessageText.includes("returned record type does not match expected record type")) {
             setupErrorDetails += " Hàm RPC 'get_ft_workload_efficiency_by_location' có thể chưa được cập nhật để trả về 'total_ft_workdays'.";
             isCriticalSetupError = true;
        } else if (rpcMessageText.includes('column "total_ft_workdays" of relation')) { // Less likely if above is true, but a fallback.
             setupErrorDetails += " Cấu trúc trả về của RPC thiếu cột 'total_ft_workdays'.";
             isCriticalSetupError = true;
        }


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
          detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng trong Supabase và đã được CẬP NHẬT để trả về cột 'total_ft_workdays'.`;
          detailedGuidance += `\n2. Bảng 'Fulltime' (với các cột lương, công, địa điểm, ngành dọc) tồn tại với đúng tên và các cột cần thiết.`;
          throw new Error(detailedGuidance);
        }
        throw rpcError;
      }

      const processedData = (rpcData || []).map((item: any) => ({
        location_name: String(item.location_name),
        ft_salary_per_ft_workday: (item.ft_salary_per_ft_workday === null || item.ft_salary_per_ft_workday === undefined) ? null : Number(item.ft_salary_per_ft_workday),
        total_ft_workdays: (item.total_ft_workdays === null || item.total_ft_workdays === undefined) ? null : Number(item.total_ft_workdays),
      })).filter(d => d.ft_salary_per_ft_workday !== null && d.total_ft_workdays !== null && d.ft_salary_per_ft_workday > 0 && d.total_ft_workdays > 0);
      
      setChartData(processedData);

    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu cho biểu đồ Lương/Công vs Tổng Công.');
      console.error("Error fetching data for salary/workday vs total workdays scatter chart:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const yAxisFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value);
  };
  const xAxisFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value);
  };

  if (isLoading) { return ( <Card className="h-[400px] mt-3"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><ScatterChartIcon className="h-4 w-4" />Lương FT/Công vs. Tổng Công (Theo Địa Điểm)</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu...</CardDescription> </CardHeader> <CardContent className="flex items-center justify-center h-full pt-2"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { return ( <Card className="border-destructive/50 h-[400px] mt-3"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1"> <AlertTriangle className="h-4 w-4" /> Lỗi Biểu Đồ Lương/Công vs Tổng Công </CardTitle> </CardHeader> <CardContent className="pt-2"> <p className="text-xs text-destructive whitespace-pre-line">{error}</p> {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê trong thông báo lỗi và đảm bảo hàm RPC `get_ft_workload_efficiency_by_location` đã được cập nhật để trả về `total_ft_workdays`. </p> )} </CardContent> </Card> ); }
  if (chartData.length === 0) { return ( <Card className="h-[400px] mt-3"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><ScatterChartIcon className="h-4 w-4" />Lương FT/Công vs. Tổng Công (Theo Địa Điểm)</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center h-full"> <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và bộ lọc đã chọn, hoặc các giá trị bằng 0.</p> </CardContent> </Card> ); }

  return (
    <Card className="h-[400px] mt-3">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <Banknote className="h-4 w-4 text-primary" /> 
            <span className="text-primary mr-0.5">/</span>
            <CalendarDays className="h-4 w-4 text-primary" />
             Lương FT/Công vs. Tổng Số Công (Theo Địa Điểm)
        </CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Hiệu suất và quy mô công theo địa điểm cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                dataKey="total_ft_workdays" 
                name={chartConfig.total_ft_workdays.label} 
                tickFormatter={xAxisFormatter} 
                className="text-xs"
                label={{ value: chartConfig.total_ft_workdays.label, position: 'insideBottom', offset: -15, className:'text-xs fill-muted-foreground' }}
              />
              <YAxis 
                type="number" 
                dataKey="ft_salary_per_ft_workday" 
                name={chartConfig.ft_salary_per_ft_workday.label} 
                tickFormatter={yAxisFormatter} 
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
                       if (props.dataKey === 'total_ft_workdays') {
                        return `${numberLabelFormatter(value as number)} ngày (${chartConfig.total_ft_workdays.label})`;
                       }
                      return String(value);
                    }}
                    itemSorter={(item) => (item.dataKey === 'total_ft_workdays' ? 0 : 1)} // X-axis first
                    indicator="dot"
                  />
                }
              />
              <Scatter 
                name="Lương/Công vs Tổng Công" 
                data={chartData} 
                fill="hsl(var(--chart-5))" // Using a different chart color
              >
                <LabelList dataKey="location_name" content={<CustomScatterDataLabel />} />
              </Scatter>
            </DynamicScatterChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```