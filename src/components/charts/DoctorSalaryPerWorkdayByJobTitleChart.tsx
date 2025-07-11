import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, BarChart3, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList, Line } from 'recharts';
import { Button } from '@/components/ui/button';

interface DoctorSalaryPerWorkdayByJobTitleChartProps {
  selectedYear?: number | null;
}

interface JobTitleSalaryData {
  job_title: string;
  salary_per_workday_this_year: number | null;
  salary_per_workday_last_year: number | null;
  growth_rate?: number | null;
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

// Hàm rút gọn số tiền: 5.677.571 -> 5tr6
const compactCurrency = (value: number | null | undefined) => {
  if (!value || value < 1000) return value ? value.toString() : '';
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${Math.round(value / 100_000) / 10}tr`;
  return value.toString();
};

// Custom datalabel tăng trưởng giữa 2 bar
const GrowthLabel = (props: any) => {
  const { x, y, width, value, fill } = props;
  if (value == null) return null;
  const percent = (value * 100 - 100).toFixed(1);
  const isUp = value >= 1;
  const color = isUp ? '#22c55e' : '#ef4444';
  const triangle = isUp ? '▲' : '▼';
  return (
    <g>
      <text x={x + width / 2} y={y - 20} textAnchor="middle" fontSize={13} fontWeight={600} fill={color}>
        {triangle} {Math.abs(Number(percent))}%
      </text>
    </g>
  );
};

export default function DoctorSalaryPerWorkdayByJobTitleChart({ selectedYear }: DoctorSalaryPerWorkdayByJobTitleChartProps) {
  const [data, setData] = useState<JobTitleSalaryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortType, setSortType] = useState<'growth' | 'current' | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setData([]);
    (async () => {
      try {
        // Gọi đúng tên hàm RPC mới, truyền đủ 2 tham số
        const { data, error } = await supabase.rpc('get_doctor_salary_per_workday_by_jobtitle_yearly', {
          p_year: selectedYear,
          p_prev_year: selectedYear ? selectedYear - 1 : null,
        });
        if (error) throw error;
        setData((data || []).map((item: any) => {
          const salary_per_workday_this_year = item.salary_per_workday_current !== null ? Number(item.salary_per_workday_current) : null;
          const salary_per_workday_last_year = item.salary_per_workday_prev !== null ? Number(item.salary_per_workday_prev) : null;
          let growth_rate = null;
          if (salary_per_workday_this_year && salary_per_workday_last_year && salary_per_workday_last_year !== 0) {
            growth_rate = salary_per_workday_this_year / salary_per_workday_last_year;
          }
          return {
            job_title: String(item.job_title),
            salary_per_workday_this_year,
            salary_per_workday_last_year,
            growth_rate,
          };
        }));
      } catch (err: any) {
        setError(err.message || 'Không thể tải dữ liệu lương/công theo chức danh.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedYear]);

  // Lọc bỏ chức danh không có dữ liệu cả 2 năm
  let filteredData = data.filter(d => (d.salary_per_workday_this_year && d.salary_per_workday_this_year > 0) || (d.salary_per_workday_last_year && d.salary_per_workday_last_year > 0));

  // Sắp xếp theo lựa chọn
  if (sortType === 'growth') {
    filteredData = [...filteredData].sort((a, b) => (b.growth_rate ?? 0) - (a.growth_rate ?? 0));
  } else if (sortType === 'current') {
    filteredData = [...filteredData].sort((a, b) => (b.salary_per_workday_this_year ?? 0) - (a.salary_per_workday_this_year ?? 0));
  }

  if (isLoading) return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Lương/Công Theo Chức Danh (So sánh 2 năm)</CardTitle>
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
  if (filteredData.length === 0) return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Lương/Công Theo Chức Danh (So sánh 2 năm)</CardTitle>
        <CardDescription className="text-xs">Không có dữ liệu cho 2 năm liên tiếp.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex items-center justify-center h-[320px]">
        <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu.</p>
      </CardContent>
    </Card>
  );

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Lương/Công Theo Chức Danh (So sánh 2 năm)</CardTitle>
        <CardDescription className="text-xs">So sánh lương/công trung bình theo chức danh giữa {selectedYear} và {selectedYear ? selectedYear - 1 : 'Năm trước'}.</CardDescription>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant={sortType === 'growth' ? 'default' : 'outline'} onClick={() => setSortType('growth')}>Sắp xếp theo tăng trưởng</Button>
          <Button size="sm" variant={sortType === 'current' ? 'default' : 'outline'} onClick={() => setSortType('current')}>Sắp xếp theo lương/công năm {selectedYear}</Button>
          <Button size="sm" variant={sortType === null ? 'default' : 'outline'} onClick={() => setSortType(null)}>Mặc định</Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="w-full overflow-x-auto">
          <ResponsiveContainer width="100%" height={360}>
            <div style={{ width: Math.max(900, filteredData.length * 80) }}>
              <BarChart width={Math.max(900, filteredData.length * 80)} height={360} data={filteredData} margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <XAxis dataKey="job_title" type="category" fontSize={12} interval={0} angle={-30} textAnchor="end" height={80} />
                <Tooltip formatter={(value: any, name: string) => name === 'Tăng trưởng' ? `${(value * 100).toFixed(1)}%` : currencyLabelFormatter(typeof value === 'number' ? value : Number(value))} labelFormatter={v => `Chức danh: ${v}`} />
                <Legend />
                <Bar dataKey="salary_per_workday_this_year" fill="hsl(var(--chart-2))" name={`Năm ${selectedYear}`} yAxisId="left">
                  <LabelList dataKey="salary_per_workday_this_year" position="top" content={({ value, ...rest }) => {
                    const x = Number(rest.x);
                    const y = typeof rest.y === 'number' ? rest.y : 0;
                    return (
                      <text x={x} y={y - 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">
                        {compactCurrency(typeof value === 'number' ? value : Number(value))}
                      </text>
                    );
                  }} />
                </Bar>
                <Bar dataKey="salary_per_workday_last_year" fill="hsl(var(--chart-4))" name={`Năm ${selectedYear ? selectedYear - 1 : 'Năm trước'}`} yAxisId="left">
                  <LabelList dataKey="salary_per_workday_last_year" position="top" content={({ value, ...rest }) => {
                    const x = Number(rest.x);
                    const y = typeof rest.y === 'number' ? rest.y : 0;
                    return (
                      <text x={x} y={y - 4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#333">
                        {compactCurrency(typeof value === 'number' ? value : Number(value))}
                      </text>
                    );
                  }} />
                  <LabelList dataKey="growth_rate" content={GrowthLabel} />
                </Bar>
                <Line type="monotone" dataKey="growth_rate" yAxisId="right" stroke="#f59e42" strokeWidth={2} dot={{ r: 4 }} name="Tăng trưởng" activeDot={{ r: 6 }} />
              </BarChart>
            </div>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
} 