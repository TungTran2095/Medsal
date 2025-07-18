
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, PieChart as PieChartIcon } from 'lucide-react';
import { Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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

const DynamicPieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[280px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>,
});

interface SalaryProportionPieChartProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartmentsForDiadiem?: string[]; 
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

interface PieDataEntry {
  name: string;
  value: number;
  color: string;
}

interface FetchError {
  type: 'rpcMissing' | 'generic';
  message: string;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))'];

const pieChartConfig = {
  "Lương Full-time": {
    label: "Lương Full-time",
    color: COLORS[0],
  },
  "Lương Part-time": {
    label: "Lương Part-time",
    color: COLORS[1],
  },
} satisfies ChartConfig;

export default function SalaryProportionPieChart({ selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2 }: SalaryProportionPieChartProps) {
  const [pieData, setPieData] = useState<PieDataEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setPieData([]);

    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) monthSegment = "tất cả các tháng";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
    } else {
      monthSegment = "tất cả các tháng";
    }

    let locationSegment = "tất cả";
    let appliedFilters: string[] = [];
    if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
      appliedFilters.push(selectedDepartmentsForDiadiem.length <= 2 ? selectedDepartmentsForDiadiem.join(' & ') : `${selectedDepartmentsForDiadiem.length} địa điểm (Loại/Pban)`);
    }
    if (selectedNganhDoc && selectedNganhDoc.length > 0) {
      appliedFilters.push(selectedNganhDoc.length <= 2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (selectedDonVi2 && selectedDonVi2.length > 0) {
      appliedFilters.push(selectedDonVi2.length <= 2 ? selectedDonVi2.join(' & ') : `${selectedDonVi2.length} đơn vị 2`);
    }
    if(appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    
    setFilterDescription(`${monthSegment} của ${yearSegment} tại ${locationSegment}`);

    const rpcArgsBase = {
      filter_year: selectedYear,
      filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
      filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
    };
    const rpcArgsFt = { ...rpcArgsBase, filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null };
    const rpcArgsPt = { ...rpcArgsBase, filter_donvi2: (selectedDonVi2 && selectedDonVi2.length > 0) ? selectedDonVi2 : null };


    try {
      const [ftSalaryRes, ptSalaryRes] = await Promise.allSettled([
        supabase.rpc('get_total_salary_fulltime', rpcArgsFt),
        supabase.rpc('get_total_salary_parttime', rpcArgsPt),
      ]);

      let ftSal = 0;
      let ptSal = 0;
      let currentError: FetchError | null = null;

      const processResult = (res: PromiseSettledResult<any>, salaryType: 'Full-time' | 'Part-time', tableName: string, columnName: string, missingParamCheck?: string) => {
        const functionName = salaryType === 'Full-time' ? 'get_total_salary_fulltime' : 'get_total_salary_parttime';
        if (res.status === 'rejected' || (res.status === 'fulfilled' && res.value.error)) {
          const rpcError = res.status === 'fulfilled' ? res.value.error : res.reason;
          const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
          
          const isFunctionMissingError = rpcError.code === '42883' || (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName)) || (rpcMessageText.includes(functionName) && rpcMessageText.includes('does not exist'));
          const isTableMissingError = rpcMessageText.includes(`relation "${tableName.toLowerCase()}" does not exist`);
          const isColumnMissingError = rpcMessageText.includes(`column ${columnName.toLowerCase()} does not exist`) || rpcMessageText.includes(`column "${columnName.toLowerCase()}" does not exist`);
          const isParamMissingError = missingParamCheck && rpcMessageText.includes(missingParamCheck) && rpcMessageText.includes("does not exist");

          if (isFunctionMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Hàm RPC '${functionName}' cho Lương ${salaryType} bị thiếu. Kiểm tra README.md.` };
          if (isParamMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Tham số '${missingParamCheck}' cho Lương ${salaryType} bị thiếu trong RPC '${functionName}'. Cập nhật hàm RPC.` };
          if (isTableMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Bảng '${tableName}' cho Lương ${salaryType} không tồn tại.`};
          if (isColumnMissingError) return { type: 'rpcMissing' as 'rpcMissing', message: `Cột lương ('${columnName}') trong bảng '${tableName}' cho Lương ${salaryType} không tồn tại.`};
          
          return { type: 'generic' as 'generic', message: `Lỗi tải Lương ${salaryType}: ${rpcError.message || 'Lỗi RPC không xác định'}` };
        }
        const rawValue = res.status === 'fulfilled' ? res.value.data : 0;
        return typeof rawValue === 'string' ? parseFloat(rawValue.replace(/,/g, '')) : (typeof rawValue === 'number' ? rawValue : 0);
      };

      const ftSalResult = processResult(ftSalaryRes, 'Full-time', 'Fulltime', 'tong_thu_nhap', 'filter_nganh_docs');
      if (typeof ftSalResult === 'object') currentError = ftSalResult; else ftSal = ftSalResult;

      const ptSalResult = processResult(ptSalaryRes, 'Part-time', 'Parttime', '"Tong tien"', 'filter_donvi2');
      if (typeof ptSalResult === 'object' && !currentError) currentError = ptSalResult; else ptSal = ptSalResult;

      if (currentError) {
        setError(currentError);
        return;
      }

      if (ftSal === 0 && ptSal === 0) {
        setPieData([]);
      } else {
        setPieData([
          { name: 'Lương Full-time', value: ftSal, color: COLORS[0] },
          { name: 'Lương Part-time', value: ptSal, color: COLORS[1] },
        ].filter(entry => entry.value > 0));
      }

    } catch (err: any) {
      console.error("Error fetching data for salary proportion pie chart:", err);
      setError({ type: 'generic', message: 'Lỗi không xác định khi tải dữ liệu tỷ trọng lương.' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
    if (percent < 0.05) return null;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="hsl(var(--card-foreground))" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs font-medium">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };


  if (isLoading) {
    return (
      <Card className="h-[350px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><PieChartIcon className="h-4 w-4" />Tỷ Trọng Lương</CardTitle>
          <CardDescription className="text-xs truncate">Đang tải dữ liệu tỷ trọng lương...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] pt-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-[350px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Tỷ Trọng Lương
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive whitespace-pre-line">{error.message}</p>
          {(error.type === 'rpcMissing' || error.message.includes("Tham số")) && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
              Vui lòng đảm bảo các hàm RPC và các bảng/cột/tham số liên quan đã được tạo/cập nhật đúng theo README.md.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (pieData.length === 0) {
    return (
     <Card className="h-[350px]">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><PieChartIcon className="h-4 w-4" />Tỷ Trọng Lương</CardTitle>
          <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[280px]">
         <p className="text-sm text-muted-foreground">Không có dữ liệu lương để hiển thị tỷ trọng.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-[350px]">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><PieChartIcon className="h-4 w-4" />Tỷ Trọng Lương Full-time vs Part-time</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Phân bổ tổng quỹ lương cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 -mt-2">
        <ChartContainer config={pieChartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicPieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={100}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={<ChartTooltipContent
                    nameKey="name"
                    formatter={(value, name, props) => {
                        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value as number);
                    }}
                    indicator="dot"
                   />}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconSize={10}
                formatter={(value, entry) => {
                  const { color } = entry;
                  return <span style={{ color }} className="text-xs">{value}</span>;
                }}
              />
            </DynamicPieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
