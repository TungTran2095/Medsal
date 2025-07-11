import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DoctorSalaryPerWorkdayByJobTitleTrendChartProps {
  selectedYear?: number | null;
}

interface TrendData {
  month_label: string;
  job_title: string;
  salary_per_workday: number;
}

const currencyLabelFormatter = (value: number | null | undefined) => {
  if (value === null || value === undefined || value === 0) return '';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

export default function DoctorSalaryPerWorkdayByJobTitleTrendChart({ selectedYear }: DoctorSalaryPerWorkdayByJobTitleTrendChartProps) {
  const [data, setData] = useState<TrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobTitles, setJobTitles] = useState<string[]>([]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setData([]);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_doctor_salary_per_workday_by_jobtitle_trend', { p_filter_year: selectedYear });
        if (error) throw error;
        setData(data || []);
        // Lấy danh sách chức danh duy nhất
        const titles = Array.from(new Set((data || []).map((item: any) => item.job_title))).sort();
        setJobTitles(titles as string[]);
      } catch (err: any) {
        setError(err.message || 'Không thể tải dữ liệu lương/công theo chức danh.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedYear]);

  // Chuẩn hóa dữ liệu cho Recharts: mỗi tháng là 1 object, mỗi key là job_title
  const chartData = React.useMemo(() => {
    const months = Array.from(new Set(data.map(d => d.month_label))).sort();
    return months.map(month => {
      const row: any = { month_label: month };
      data.filter(d => d.month_label === month).forEach(d => {
        row[d.job_title] = d.salary_per_workday;
      });
      return row;
    });
  }, [data]);

  if (isLoading) return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Biến Động Lương/Công Bác Sĩ theo Chức Danh</CardTitle>
        <CardDescription className="text-xs">Đang tải dữ liệu...</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center h-[320px] pt-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </CardContent>
    </Card>
  );
  if (error) return (
    <Card className="border-destructive/50 h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Lỗi Biểu Đồ </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
      </CardContent>
    </Card>
  );
  if (chartData.length === 0) return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Biến Động Lương/Công Bác Sĩ theo Chức Danh</CardTitle>
        <CardDescription className="text-xs">Không có dữ liệu cho năm này.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex items-center justify-center h-[320px]">
        <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Biến Động Lương/Công Bác Sĩ theo Chức Danh</CardTitle>
        <CardDescription className="text-xs">Theo từng tháng, phân loại theo chức danh công việc.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month_label" fontSize={12} />
            <YAxis tickFormatter={currencyLabelFormatter} fontSize={12} />
            <Tooltip formatter={(value: any) => currencyLabelFormatter(typeof value === 'number' ? value : Number(value))} />
            <Legend />
            {jobTitles.map((title, idx) => (
              <Bar key={title} dataKey={title} fill={`hsl(var(--chart-${(idx % 6) + 1}))`} name={title} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
} 