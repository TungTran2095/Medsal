import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, LineChart as LineChartIcon, Divide } from 'lucide-react';
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
  salaryPerWorkday: {
    label: 'Lương/Công Bác Sĩ',
    color: 'hsl(var(--chart-2))',
    icon: Divide,
  },
} satisfies ChartConfig;

interface MonthlyDoctorSalaryPerWorkdayEntry {
  month_label: string;
  year_val: number;
  name: string;
  salary_per_workday?: number | null;
  salary_per_workday_prev?: number | null;
}

interface MonthlyDoctorSalaryPerWorkdayChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

const currencyLabelFormatter = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return '';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export default function MonthlyDoctorSalaryPerWorkdayChart({ selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc }: MonthlyDoctorSalaryPerWorkdayChartProps) {
  const [chartData, setChartData] = useState<MonthlyDoctorSalaryPerWorkdayEntry[]>([]);
  const [prevYearChartData, setPrevYearChartData] = useState<MonthlyDoctorSalaryPerWorkdayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);
    setPrevYearChartData([]);

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

    // TODO: Đảm bảo đã có hàm RPC get_monthly_doctor_salary_per_workday_trend trong Supabase
    const rpcArgs = {
      p_filter_year: selectedYear,
      p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
      p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
    };

    try {
      const functionName = 'get_monthly_doctor_salary_per_workday_trend';
      // Lấy dữ liệu năm hiện tại và năm trước
      const [curRes, prevRes] = await Promise.all([
        supabase.rpc(functionName, {
          p_filter_year: selectedYear,
          p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
          p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
        }),
        selectedYear ? supabase.rpc(functionName, {
          p_filter_year: selectedYear - 1,
          p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
          p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
        }) : { data: [], error: null }
      ]);
      if (curRes.error) throw curRes.error;
      if (prevRes.error) throw prevRes.error;
      const processedCur = (curRes.data || []).map((item: any) => ({
        month_label: String(item.month_label),
        year_val: Number(item.year_val),
        name: String(item.month_label),
        salary_per_workday: (item.salary_per_workday === null || item.salary_per_workday === undefined) ? null : Number(item.salary_per_workday),
      }));
      const processedPrev = (prevRes.data || []).map((item: any) => ({
        month_label: String(item.month_label),
        year_val: Number(item.year_val),
        name: String(item.month_label),
        salary_per_workday_prev: (item.salary_per_workday === null || item.salary_per_workday === undefined) ? null : Number(item.salary_per_workday),
      }));
      setChartData(processedCur);
      setPrevYearChartData(processedPrev);
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu lương/công bác sĩ theo tháng.');
      console.error("Error fetching monthly doctor salary per workday trend:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc]);

  // Gộp dữ liệu 2 năm theo tháng
  const mergedChartData = useMemo(() => {
    const map = new Map<string, any>();
    chartData.forEach(item => {
      if (item.salary_per_workday && item.salary_per_workday > 0) {
        map.set(item.name, { ...item });
      }
    });
    prevYearChartData.forEach(item => {
      if (item.salary_per_workday_prev && item.salary_per_workday_prev > 0) {
        if (map.has(item.name)) {
          map.get(item.name).salary_per_workday_prev = item.salary_per_workday_prev;
        } else {
          map.set(item.name, { ...item });
        }
      }
    });
    // Trả về mảng đã sort theo tháng
    return Array.from(map.values()).sort((a, b) => {
      const monthA = parseInt(String(a.name).replace(/\D/g, ''), 10);
      const monthB = parseInt(String(b.name).replace(/\D/g, ''), 10);
      return monthA - monthB;
    });
  }, [chartData, prevYearChartData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const yAxisFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value);
  };

  // Lọc bỏ các tháng có lương/công = 0
  const filteredChartData = mergedChartData.filter((item: MonthlyDoctorSalaryPerWorkdayEntry) => item.salary_per_workday && item.salary_per_workday > 0);

  // Custom label cho recharts
  const renderSalaryLabel = (props: any) => {
    const { x, y, value } = props;
    if (!value || value <= 0) return <></>;
    return (
      <text x={x} y={y - 8} textAnchor="middle" fontSize={11} fill="#888">
        {currencyLabelFormatter(value)}
      </text>
    );
  };

  if (isLoading) { return ( <Card className="h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Biến Động Lương/Công Bác Sĩ</CardTitle> <CardDescription className="text-xs truncate">Đang tải dữ liệu...</CardDescription> </CardHeader> <CardContent className="flex items-center justify-center h-[280px] pt-2"> <Loader2 className="h-8 w-8 animate-spin text-primary" /> </CardContent> </Card> ); }
  if (error) { return ( <Card className="border-destructive/50 h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1"> <AlertTriangle className="h-4 w-4" /> Lỗi Biểu Đồ </CardTitle> </CardHeader> <CardContent className="pt-2"> <p className="text-xs text-destructive whitespace-pre-line">{error}</p> {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && ( <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line"> Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê trong thông báo lỗi và đảm bảo các hàm RPC, bảng và cột liên quan đã được thiết lập đúng theo README.md. </p> )} </CardContent> </Card> ); }
  if (mergedChartData.length === 0) { return ( <Card className="h-full"> <CardHeader className="pb-2 pt-3"> <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Biến Động Lương/Công Bác Sĩ</CardTitle> <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}</CardDescription> </CardHeader> <CardContent className="pt-2 flex items-center justify-center h-[280px]"> <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và bộ lọc đã chọn.</p> </CardContent> </Card> ); }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Biến Động Lương/Công Bác Sĩ</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Lương/Công Bác Sĩ cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig as any} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicComposedChart data={mergedChartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis 
                yAxisId="left" 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={yAxisFormatter} 
              />
              <Tooltip content={<ChartTooltipContent config={chartConfig as any} />} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="salary_per_workday"
                stroke={chartConfig.salaryPerWorkday.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                name={`Lương/Công Bác Sĩ (${selectedYear})`}
                isAnimationActive={false}
                label={renderSalaryLabel}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="salary_per_workday_prev"
                stroke="#8884d8"
                strokeDasharray="5 3"
                dot={{ r: 2 }}
                activeDot={false}
                name={`Lương/Công Bác Sĩ (${selectedYear ? selectedYear - 1 : 'Năm trước'})`}
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