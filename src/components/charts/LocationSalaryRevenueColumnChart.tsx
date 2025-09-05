
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart } from 'recharts';
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

const DynamicLineChart = dynamic(() => import('recharts').then(mod => mod.LineChart), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-[250px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>,
});

interface SalaryRevenueRatioData {
  ten_don_vi: string;
  tong_luong_fulltime: number;
  tong_luong_parttime: number;
  tong_luong: number;
  doanh_thu: number;
  ty_le_luong_doanh_thu: number;
  ty_le_fulltime_doanh_thu: number;
}

interface TargetRevenueChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[]; 
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

const chartConfig = {
  ty_le_luong_doanh_thu: {
    label: 'Tỷ lệ tổng lương/doanh thu (%)',
    color: 'hsl(var(--chart-1))', 
    icon: TrendingUp,
  },
  ty_le_fulltime_doanh_thu: {
    label: 'Tỷ lệ lương Fulltime/doanh thu (%)',
    color: 'hsl(var(--chart-2))', 
    icon: TrendingUp,
  },
} satisfies ChartConfig;

const MIN_CATEGORY_HEIGHT = 40;
const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";
const Y_AXIS_WIDTH = 110;

// Loại bỏ custom components không cần thiết cho line chart

export default function LocationSalaryRevenueColumnChart({ selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2 }: TargetRevenueChartProps) {
  const [chartData, setChartData] = useState<SalaryRevenueRatioData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let finalFilterDescription: string;
    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) monthSegment = "tất cả các tháng";
      else if (selectedMonths.length === 1) monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      else monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
    } else { monthSegment = "tất cả các tháng"; }
    
    let locationSegment = "tất cả";
    let appliedFilters: string[] = [];
    if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
      appliedFilters.push(selectedDepartmentsForDiadiem.length <= 2 ? selectedDepartmentsForDiadiem.join(' & ') : `${selectedDepartmentsForDiadiem.length} địa điểm (Loại/Pban)`);
    }
    if (selectedNganhDoc && selectedNganhDoc.length > 0) { 
      appliedFilters.push(selectedNganhDoc.length <=2 ? selectedNganhDoc.join(' & ') : `${selectedNganhDoc.length} ngành dọc`);
    }
    if (selectedDonVi2 && selectedDonVi2.length > 0) { 
      appliedFilters.push(selectedDonVi2.length <=2 ? selectedDonVi2.join(' & ') : `${selectedDonVi2.length} đơn vị 2`);
    }

    if (appliedFilters.length > 0) locationSegment = appliedFilters.join(' và ');
    
    finalFilterDescription = selectedYear 
      ? `${monthSegment} của ${yearSegment} tại ${locationSegment}` 
      : (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) 
        ? `${monthSegment} (mọi năm) tại ${locationSegment}` 
        : `tất cả các kỳ tại ${locationSegment}`;
    setFilterDescription(finalFilterDescription);

    try {
      // Sử dụng SQL function để lấy dữ liệu tỷ lệ lương/doanh thu
      const rpcArgs: { 
        p_filter_year?: number; 
        p_filter_months?: number[] | null; 
        p_filter_locations?: string[] | null; 
        p_filter_nganh_docs?: string[] | null;
        p_filter_donvi2?: string[] | null;
      } = {};
      
      if (selectedYear !== null) {
        rpcArgs.p_filter_year = selectedYear;
      }
      if (selectedMonths && selectedMonths.length > 0) {
        rpcArgs.p_filter_months = selectedMonths;
      } else {
        rpcArgs.p_filter_months = null;
      }
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        rpcArgs.p_filter_locations = selectedDepartmentsForDiadiem;
      } else {
        rpcArgs.p_filter_locations = null;
      }
      if (selectedNganhDoc && selectedNganhDoc.length > 0) {
        rpcArgs.p_filter_nganh_docs = selectedNganhDoc;
      } else {
        rpcArgs.p_filter_nganh_docs = null;
      }
      if (selectedDonVi2 && selectedDonVi2.length > 0) {
        rpcArgs.p_filter_donvi2 = selectedDonVi2;
      } else {
        rpcArgs.p_filter_donvi2 = null;
      }

      console.log('LocationSalaryRevenueColumnChart - RPC args:', rpcArgs);

      const { data: rawData, error: queryError } = await supabase.rpc(
        'get_salary_revenue_ratio_by_location',
        rpcArgs
      );

      if (queryError) {
        throw queryError;
      }

      // Xử lý dữ liệu từ SQL function và chuyển đổi tỷ lệ thành phần trăm
      const processedData = (rawData || []).map((item: any) => ({
        ten_don_vi: item.ten_don_vi,
        tong_luong_fulltime: Number(item.tong_luong_fulltime) || 0,
        tong_luong_parttime: Number(item.tong_luong_parttime) || 0,
        tong_luong: Number(item.tong_luong) || 0,
        doanh_thu: Number(item.doanh_thu) || 0,
        ty_le_luong_doanh_thu: (Number(item.ty_le_luong_doanh_thu) || 0) * 100, // Chuyển thành phần trăm
        ty_le_fulltime_doanh_thu: item.doanh_thu > 0 ? (Number(item.tong_luong_fulltime) / Number(item.doanh_thu)) * 100 : 0, // Tính tỷ lệ Fulltime/doanh thu
      }));

      // Lọc và sắp xếp dữ liệu theo tỷ lệ lương/doanh thu
      const filteredData = processedData
        .filter(item => item.tong_luong > 0 || item.doanh_thu > 0)
        .sort((a, b) => b.ty_le_luong_doanh_thu - a.ty_le_luong_doanh_thu);

      setChartData(filteredData);

    } catch (err: any) {
      let errorMessage = 'Không thể tải dữ liệu tỷ lệ lương/doanh thu theo địa điểm.';
      
      console.error("Error fetching salary revenue ratio data:", err);
      
      if (err && typeof err === 'object') {
          if (err.message) {
              errorMessage = `Lỗi: ${err.message}`;
          } else if (err.details) {
              errorMessage = `Lỗi chi tiết: ${err.details}`;
          } else if (err.code) {
              errorMessage = `Lỗi query với mã: ${err.code}`;
          } else if (err.hint) {
              errorMessage = `Gợi ý: ${err.hint}`;
          } else {
              // Kiểm tra xem có phải lỗi bảng không tồn tại không
              const errorString = err.toString();
              if (errorString.includes('does not exist') || errorString.includes('relation') || errorString.includes('column')) {
                  errorMessage = 'Bảng hoặc cột không tồn tại trong database. Vui lòng kiểm tra cấu trúc database.';
              } else {
                  try {
                      const stringifiedError = JSON.stringify(err);
                      if (stringifiedError !== '{}' && stringifiedError !== 'null') {
                          errorMessage = `Lỗi không xác định: ${stringifiedError}`;
                      }
                  } catch (e) {
                      errorMessage = `Lỗi không xác định: ${errorString}`;
                  }
              }
          }
      } else if (typeof err === 'string') {
          errorMessage = err;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2]); 

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bỏ logic tính toán chiều cao cố định để chart tự động điều chỉnh

  const yAxisDomainMax = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return 100;
    }
    const maxValue = Math.max(
      ...chartData.map(item => Math.max(item.ty_le_luong_doanh_thu, item.ty_le_fulltime_doanh_thu))
    );
    return Math.ceil(maxValue * 1.1);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="h-[350px] flex flex-col">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Tỷ lệ lương/doanh thu theo địa điểm</CardTitle>
          <CardDescription className="text-xs truncate">Đang tải dữ liệu...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-grow pt-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-[350px] flex flex-col">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Chart Tỷ Lệ Lương/Doanh Thu
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 flex-grow">
           <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card className="h-[350px] flex flex-col">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Tỷ lệ lương/doanh thu theo địa điểm</CardTitle>
          <CardDescription className="text-xs truncate" title={filterDescription}>Cho: {filterDescription}.</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center flex-grow">
         <p className="text-sm text-muted-foreground">Không có dữ liệu cho kỳ/địa điểm đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-[350px] flex flex-col">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Tỷ lệ lương/doanh thu theo địa điểm</CardTitle>
        <CardDescription className="text-xs truncate" title={filterDescription}>
          Dữ liệu cho {filterDescription}. Hiển thị tỷ lệ tổng lương và lương Fulltime so với doanh thu.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden">
            <ChartContainer
              config={chartConfig}
              className="h-full w-full"
            >
                <ResponsiveContainer width="100%" height="100%">
                <DynamicLineChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
                >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                        dataKey="ten_don_vi" 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={5} 
                        className="text-xs" 
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                    />
                    <YAxis 
                        type="number" 
                        domain={[0, yAxisDomainMax]} 
                        tickFormatter={(value) => `${value.toFixed(0)}%`}
                        axisLine={false} 
                        tickLine={false} 
                        tickMargin={8} 
                        className="text-xs" 
                    />
                    <Tooltip 
                        content={<ChartTooltipContent 
                            formatter={(value, name, props) => {
                                const dataKey = props.dataKey as keyof typeof chartConfig;
                                const payloadValue = props.payload?.[dataKey];
                                if (typeof payloadValue === 'number') {
                                    return `${payloadValue.toFixed(1)}%`;
                                }
                                return String(value);
                            }} 
                            labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0 && payload[0].payload) {
                                    const data = payload[0].payload;
                                    const tyLeTong = data.ty_le_luong_doanh_thu.toFixed(1);
                                    const tyLeFT = data.ty_le_fulltime_doanh_thu.toFixed(1);
                                    return `${label} (Tổng: ${tyLeTong}%, FT: ${tyLeFT}%)`;
                                }
                                return label;
                            }} 
                            indicator="dot" 
                        />} 
                    />
                    <Legend 
                        verticalAlign="top" 
                        align="center" 
                        height={30} 
                        wrapperStyle={{paddingBottom: "5px"}} 
                        content={({ payload }) => (
                            <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                                {payload?.map((entry: any) => {
                                    const configKey = entry.dataKey as keyof typeof chartConfig;
                                    const Icon = chartConfig[configKey]?.icon;
                                    return (
                                        <div key={`item-${entry.dataKey}`} className="flex items-center gap-0.5 cursor-pointer text-xs">
                                            {Icon && <Icon className="h-3 w-3" style={{ color: entry.color }} />}
                                            <span style={{ color: entry.color }}>{chartConfig[configKey]?.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )} 
                    />
                    <Line 
                        type="monotone" 
                        dataKey="ty_le_luong_doanh_thu" 
                        stroke="var(--color-ty_le_luong_doanh_thu)" 
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-ty_le_luong_doanh_thu)', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: 'var(--color-ty_le_luong_doanh_thu)', strokeWidth: 2 }}
                        name={chartConfig.ty_le_luong_doanh_thu.label}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="ty_le_fulltime_doanh_thu" 
                        stroke="var(--color-ty_le_fulltime_doanh_thu)" 
                        strokeWidth={3}
                        dot={{ fill: 'var(--color-ty_le_fulltime_doanh_thu)', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: 'var(--color-ty_le_fulltime_doanh_thu)', strokeWidth: 2 }}
                        name={chartConfig.ty_le_fulltime_doanh_thu.label}
                    />
                </DynamicLineChart>
                </ResponsiveContainer>
            </ChartContainer>
      </CardContent>
    </Card>
  );
}

