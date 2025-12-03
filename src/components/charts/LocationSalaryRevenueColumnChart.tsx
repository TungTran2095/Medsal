
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
  ty_le_ql_dt_duoc_phep: number;
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
  ty_le_ql_dt_duoc_phep: {
    label: 'QL/DT được phép (%)',
    color: 'hsl(var(--chart-3))', 
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
      
      if (selectedYear !== null && selectedYear !== undefined) {
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

      console.log('LocationSalaryRevenueColumnChart - RPC args:', JSON.stringify(rpcArgs, null, 2));

      const { data: rawData, error: queryError } = await supabase.rpc(
        'get_salary_revenue_ratio_by_location',
        rpcArgs
      );

      console.log('LocationSalaryRevenueColumnChart - RPC response:', { 
        hasData: !!rawData, 
        dataLength: rawData?.length || 0,
        hasError: !!queryError,
        error: queryError 
      });

      // Xử lý lỗi một cách chi tiết hơn
      if (queryError) {
        console.error('Supabase RPC Error Details:', {
          message: queryError.message,
          details: queryError.details,
          hint: queryError.hint,
          code: queryError.code,
          fullError: JSON.stringify(queryError, Object.getOwnPropertyNames(queryError))
        });
        throw queryError;
      }

      // Kiểm tra nếu không có dữ liệu
      if (!rawData || !Array.isArray(rawData)) {
        console.warn('LocationSalaryRevenueColumnChart - No data returned from RPC');
        setChartData([]);
        return;
      }

      // Xử lý dữ liệu từ SQL function và chuyển đổi tỷ lệ thành phần trăm
      // Lưu ý: ty_le_ql_dt_duoc_phep từ SQL là decimal (0.2 = 20%), chúng ta sẽ giữ nguyên để tính weighted average
      const processedData = (rawData || []).map((item: any) => {
        try {
          return {
            ten_don_vi: item.ten_don_vi || 'Không xác định',
        tong_luong_fulltime: Number(item.tong_luong_fulltime) || 0,
        tong_luong_parttime: Number(item.tong_luong_parttime) || 0,
        tong_luong: Number(item.tong_luong) || 0,
        doanh_thu: Number(item.doanh_thu) || 0,
            ty_le_luong_doanh_thu: (Number(item.ty_le_luong_doanh_thu) || 0) * 100,
            ty_le_fulltime_doanh_thu: item.doanh_thu > 0 ? (Number(item.tong_luong_fulltime) / Number(item.doanh_thu)) * 100 : 0,
            // Giữ nguyên giá trị decimal từ SQL để tính weighted average chính xác
            ty_le_ql_dt_duoc_phep_raw: Number(item.ty_le_ql_dt_duoc_phep) || 0, // Decimal: 0.2 = 20%
            // Giá trị phần trăm để hiển thị (sẽ được cập nhật sau khi gộp và áp dụng giá trị mặc định)
            ty_le_ql_dt_duoc_phep: (Number(item.ty_le_ql_dt_duoc_phep) || 0) * 100,
          };
        } catch (itemError) {
          console.error('Error processing item:', item, itemError);
          return null;
        }
      }).filter((item): item is SalaryRevenueRatioData & { ty_le_ql_dt_duoc_phep_raw: number } => item !== null);

      // Loại bỏ các địa điểm không cần thiết
      const excludedLocations = ['Medim', 'Medlatec Group', 'Med Mê Linh', 'Medcom', 'Medon', 'Med Group', 'Med Campuchia'];
      const filteredByExclusion = processedData.filter(
        item => !excludedLocations.includes(item.ten_don_vi)
      );

      // Gộp các địa điểm theo yêu cầu
      const locationMap = new Map<string, {
        data: SalaryRevenueRatioData;
        totalDoanhThu: number;
        weightedQLDT: number; // Tổng (ty_le_ql_dt_duoc_phep_raw * doanh_thu) để tính trung bình có trọng số
      }>();
      
      filteredByExclusion.forEach(item => {
        let locationKey = item.ten_don_vi;
        
        // Gộp Med Huế và Med Đà Nẵng thành Med Huda
        if (item.ten_don_vi === 'Med Huế' || item.ten_don_vi === 'Med Đà Nẵng') {
          locationKey = 'Med Huda';
        }
        // Gộp Med Đắk Lawsk và Med Bình Định thành Med Bình Đắk
        else if (item.ten_don_vi === 'Med Đắk Lawsk' || item.ten_don_vi === 'Med Bình Định') {
          locationKey = 'Med Bình Đắk';
        }
        // Gộp Med TP.HCM, Med Bình Dương, Med Bình Phước, Med Đồng Nai thành Med Đông Nam Bộ
        else if (['Med TP.HCM', 'Med Bình Dương', 'Med Bình Phước', 'Med Đồng Nai'].includes(item.ten_don_vi)) {
          locationKey = 'Med Đông Nam Bộ';
        }

        if (locationMap.has(locationKey)) {
          const existing = locationMap.get(locationKey)!;
          existing.data.tong_luong_fulltime += item.tong_luong_fulltime;
          existing.data.tong_luong_parttime += item.tong_luong_parttime;
          existing.data.tong_luong += item.tong_luong;
          existing.data.doanh_thu += item.doanh_thu;
          existing.totalDoanhThu += item.doanh_thu;
          // Tính trung bình có trọng số cho QL/DT được phép dựa trên doanh thu (sử dụng giá trị decimal)
          if (item.ty_le_ql_dt_duoc_phep_raw > 0 && item.doanh_thu > 0) {
            existing.weightedQLDT += item.ty_le_ql_dt_duoc_phep_raw * item.doanh_thu;
          }
        } else {
          locationMap.set(locationKey, {
            data: {
              ...item,
              ten_don_vi: locationKey,
              // Loại bỏ ty_le_ql_dt_duoc_phep_raw khỏi data object
              ty_le_ql_dt_duoc_phep: item.ty_le_ql_dt_duoc_phep
            },
            totalDoanhThu: item.doanh_thu,
            weightedQLDT: item.ty_le_ql_dt_duoc_phep_raw > 0 && item.doanh_thu > 0 
              ? item.ty_le_ql_dt_duoc_phep_raw * item.doanh_thu 
              : 0
          });
        }
      });

      // Định nghĩa giá trị mặc định QL/DT được phép cho các địa điểm cụ thể (đơn vị: phần trăm, ví dụ 20 = 20%)
      const defaultQLDTValues: Record<string, number> = {
        'Med Ba Đình': 20,
        'Med Cầu Giấy': 18,
        'Med Thanh Xuân': 18,
        'Med Tây Hồ': 18,
        'Med Bình Đắk': 18,
      };

      // Tính lại các tỷ lệ và QL/DT được phép sau khi gộp
      const finalData = Array.from(locationMap.values()).map(({ data, totalDoanhThu, weightedQLDT }) => {
        // Tính lại tỷ lệ sau khi gộp
        data.ty_le_luong_doanh_thu = data.doanh_thu > 0 
          ? (data.tong_luong / data.doanh_thu) * 100 
          : 0;
        data.ty_le_fulltime_doanh_thu = data.doanh_thu > 0 
          ? (data.tong_luong_fulltime / data.doanh_thu) * 100 
          : 0;
        
        // Tính trung bình có trọng số cho QL/DT được phép (chuyển từ decimal sang phần trăm)
        let calculatedQLDT = 0;
        if (totalDoanhThu > 0 && weightedQLDT > 0) {
          // weightedQLDT là tổng (decimal * doanh_thu), chia cho totalDoanhThu để được decimal, rồi nhân 100 để được phần trăm
          calculatedQLDT = (weightedQLDT / totalDoanhThu) * 100;
        }
        
        // Áp dụng giá trị mặc định cho các địa điểm cụ thể
        if (defaultQLDTValues.hasOwnProperty(data.ten_don_vi)) {
          // Luôn sử dụng giá trị mặc định cho các địa điểm này
          data.ty_le_ql_dt_duoc_phep = defaultQLDTValues[data.ten_don_vi];
        } else {
          // Nếu không có giá trị mặc định, sử dụng giá trị tính được từ database
          data.ty_le_ql_dt_duoc_phep = calculatedQLDT;
        }
        
        return data;
      });

      // Lọc và sắp xếp dữ liệu
      const sortedData = finalData
        .filter(item => item.tong_luong > 0 || item.doanh_thu > 0)
        .sort((a, b) => b.ty_le_luong_doanh_thu - a.ty_le_luong_doanh_thu);

      console.log('LocationSalaryRevenueColumnChart - Final processed data:', sortedData.length, 'items');
      setChartData(sortedData);

    } catch (err: any) {
      console.error("Error fetching salary revenue ratio data:", err);
      console.error("Error type:", typeof err);
      console.error("Error keys:", err ? Object.keys(err) : 'null');
      console.error("Error stringified:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      
      let errorMessage = 'Không thể tải dữ liệu tỷ lệ lương/doanh thu theo địa điểm.';
      
      // Xử lý lỗi chi tiết hơn
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (typeof err === 'object') {
          // Kiểm tra các thuộc tính lỗi phổ biến của Supabase
          if (err.message) {
              errorMessage = `Lỗi: ${err.message}`;
          } else if (err.details) {
              errorMessage = `Lỗi chi tiết: ${err.details}`;
          } else if (err.hint) {
              errorMessage = `Gợi ý: ${err.hint}`;
          } else if (err.code) {
            errorMessage = `Lỗi với mã: ${err.code}`;
          } else {
            // Thử stringify để xem có thông tin gì không
            try {
              const errorStr = JSON.stringify(err, Object.getOwnPropertyNames(err), 2);
              if (errorStr && errorStr !== '{}' && errorStr !== 'null') {
                // Nếu error object rỗng hoặc không có thông tin hữu ích, hiển thị thông báo chung
                if (errorStr === '{}') {
                  errorMessage = 'Lỗi không xác định từ server. Vui lòng kiểm tra console để biết thêm chi tiết.';
                  // Không set error, chỉ log và hiển thị dữ liệu rỗng
                  console.warn('Empty error object received. Setting empty data instead of error.');
                  setChartData([]);
                  setIsLoading(false);
                  return;
              } else {
                  errorMessage = `Lỗi: ${errorStr}`;
                }
              }
            } catch (stringifyError) {
              const errorString = String(err);
              if (errorString && errorString !== '[object Object]') {
                errorMessage = errorString;
              }
            }
          }
        }
      }
      
      // Chỉ set error nếu có thông báo lỗi hữu ích
      if (errorMessage && errorMessage !== 'Không thể tải dữ liệu tỷ lệ lương/doanh thu theo địa điểm.') {
      setError(errorMessage);
      } else {
        // Nếu không có thông báo lỗi rõ ràng, chỉ log và hiển thị dữ liệu rỗng
        console.warn('No clear error message. Setting empty data.');
        setChartData([]);
      }
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
      ...chartData.map(item => Math.max(item.ty_le_luong_doanh_thu, item.ty_le_fulltime_doanh_thu, item.ty_le_ql_dt_duoc_phep))
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
          Dữ liệu cho {filterDescription}. Hiển thị tỷ lệ tổng lương, lương Fulltime và QL/DT được phép so với doanh thu.
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
                                    const tyLeQLDT = data.ty_le_ql_dt_duoc_phep.toFixed(1);
                                    return `${label} (Tổng: ${tyLeTong}%, FT: ${tyLeFT}%, QL/DT: ${tyLeQLDT}%)`;
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
                    <Line 
                        type="monotone" 
                        dataKey="ty_le_ql_dt_duoc_phep" 
                        stroke="var(--color-ty_le_ql_dt_duoc_phep)" 
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ fill: 'var(--color-ty_le_ql_dt_duoc_phep)', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: 'var(--color-ty_le_ql_dt_duoc_phep)', strokeWidth: 2 }}
                        name={chartConfig.ty_le_ql_dt_duoc_phep.label}
                    />
                </DynamicLineChart>
                </ResponsiveContainer>
            </ChartContainer>
      </CardContent>
    </Card>
  );
}

