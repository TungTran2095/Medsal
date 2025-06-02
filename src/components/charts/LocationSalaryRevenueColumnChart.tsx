
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, BarChartHorizontal, TrendingUp, Percent } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis, 
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
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
import { ScrollArea } from '@/components/ui/scroll-area';

interface LocationRatioData {
  location_name: string;
  ft_salary_ratio_component: number;
  pt_salary_ratio_component: number;
  total_ratio: number; 
}

interface LocationSalaryRevenueChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
}

const chartConfig = {
  ft_salary_ratio_component: {
    label: 'Lương FT / Doanh Thu',
    color: 'hsl(var(--chart-4))',
    icon: TrendingUp,
  },
  pt_salary_ratio_component: {
    label: 'Lương PT / Doanh Thu',
    color: 'hsl(var(--chart-5))',
    icon: Percent,
  },
} satisfies ChartConfig;

const MIN_CATEGORY_HEIGHT = 40; 
const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";
const Y_AXIS_WIDTH = 110;


const CustomSegmentLabel = (props: any) => {
  const { x, y, width, height, value } = props;
  if (value === 0 || value === null || value === undefined) return null;

  const formattedValue = `${(value * 100).toFixed(0)}%`;
  const textWidth = formattedValue.length * 5; 
  if (width < textWidth + 4) return null; 

  return (
    <text x={x + width / 2} y={y + height / 2} fill="hsl(var(--primary-foreground))" textAnchor="middle" dominantBaseline="middle" fontSize="9">
      {formattedValue}
    </text>
  );
};

const CustomTotalLabel = (props: any) => {
  const { x, y, width, height, index, chartData } = props; 
  
  const currentDataPoint = chartData[index];
  if (!currentDataPoint || currentDataPoint.total_ratio === null || currentDataPoint.total_ratio === undefined) return null;

  const totalValue = currentDataPoint.total_ratio;
  if (totalValue === 0 && currentDataPoint.ft_salary_ratio_component === 0 && currentDataPoint.pt_salary_ratio_component === 0) return null;

  return (
    <text x={x + width + 5} y={y + height / 2} fill="hsl(var(--foreground))" textAnchor="start" dominantBaseline="middle" fontSize="10" fontWeight="500">
      {`${(totalValue * 100).toFixed(0)}%`}
    </text>
  );
};


export default function LocationSalaryRevenueColumnChart({ selectedYear, selectedMonths }: LocationSalaryRevenueChartProps) {
  const [chartData, setChartData] = useState<LocationRatioData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    let finalFilterDescription: string;
    const yearSegment = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    
    let monthSegment: string;
    if (selectedMonths && selectedMonths.length > 0) {
      if (selectedMonths.length === 12) {
        monthSegment = "tất cả các tháng";
      } else if (selectedMonths.length === 1) {
        monthSegment = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
      } else {
        monthSegment = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
      }
    } else {
      monthSegment = "tất cả các tháng";
    }

    if (selectedYear) {
      finalFilterDescription = `${monthSegment} của ${yearSegment}`;
    } else {
      if (selectedMonths && selectedMonths.length > 0 && selectedMonths.length < 12) {
        finalFilterDescription = `${monthSegment} (trong mọi năm)`;
      } else {
        finalFilterDescription = "tất cả các kỳ";
      }
    }
    setFilterDescription(finalFilterDescription);

    const rpcArgs = {
      p_filter_year: selectedYear,
      p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
    };

    try {
      const functionName = 'get_salary_revenue_ratio_components_by_location';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        let isCriticalSetupError =
            rpcError.code === '42883' || 
            (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
            (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));
        
        let setupErrorDetails = "";
        if (rpcMessageText.includes('relation "fulltime" does not exist')) { setupErrorDetails += " Bảng 'Fulltime' không tồn tại."; isCriticalSetupError = true; }
        if (rpcMessageText.includes('relation "parttime" does not exist')) { setupErrorDetails += " Bảng 'Parttime' không tồn tại."; isCriticalSetupError = true; }
        if (rpcMessageText.includes('relation "doanh_thu" does not exist')) { setupErrorDetails += " Bảng 'Doanh_thu' không tồn tại."; isCriticalSetupError = true; }
        
        if (isCriticalSetupError) {
          let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc các bảng/cột phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
            detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo các mục sau theo README.md:`;
            detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng trong Supabase.`;
            detailedGuidance += `\n2. Các bảng 'Fulltime', 'Parttime', 'Doanh_thu' tồn tại với đúng tên (phân biệt chữ hoa chữ thường) và các cột cần thiết (ví dụ: 'dia_diem', 'Don vi', 'Tên đơn vị', 'tong_thu_nhap', 'Tong tien', 'Kỳ báo cáo', các cột năm/tháng).`;
           throw new Error(detailedGuidance);
        }
        throw rpcError;
      }
      
      const allProcessedData = (rpcData || []).map((item: any) => ({
        location_name: item.location_name,
        ft_salary_ratio_component: Number(item.ft_salary_ratio_component) || 0,
        pt_salary_ratio_component: Number(item.pt_salary_ratio_component) || 0,
        total_ratio: (Number(item.ft_salary_ratio_component) || 0) + (Number(item.pt_salary_ratio_component) || 0),
      }));

      const filteredData = allProcessedData
        .filter(item => item.total_ratio >= 0.02 && item.total_ratio <= 1.5)
        .sort((a,b) => b.total_ratio - a.total_ratio); 

      setChartData(filteredData);

    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu tỷ lệ theo địa điểm.');
      console.error("Error fetching location salary/revenue ratio:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartContainerHeight = useMemo(() => {
    return Math.max(chartData.length * MIN_CATEGORY_HEIGHT, 250);
  }, [chartData.length]);

  const xAxisDomainMax = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return 0.1; 
    }
    const maxRatioInData = Math.max(0.01, ...chartData.map(item => item.total_ratio));
    const dataEndTick = Math.max(0.1, Math.ceil(maxRatioInData * 20) / 20);
    const finalDomain = Math.min(1.6, dataEndTick + Math.max(0.05, dataEndTick * 0.15));
    return finalDomain;
  }, [chartData]);

  const barChartMarginBottom = chartData.length > 5 ? 20 : 10;


  if (isLoading) {
    return (
      <Card className="h-[350px] flex flex-col">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChartHorizontal className="h-4 w-4" />Quỹ Lương/Doanh Thu theo Địa Điểm</CardTitle>
          <CardDescription className="text-xs">Đang tải dữ liệu...</CardDescription>
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
            Lỗi Chart Địa Điểm
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2 flex-grow">
           <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
            {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê ở trên trong cơ sở dữ liệu Supabase và tệp README.md.
                  Đảm bảo rằng hàm RPC \`get_salary_revenue_ratio_components_by_location\` và các bảng/cột liên quan được tạo và đặt tên chính xác.
                </p>
            )}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card className="h-[350px] flex flex-col">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChartHorizontal className="h-4 w-4" />Quỹ Lương/Doanh Thu theo Địa Điểm</CardTitle>
          <CardDescription className="text-xs">Cho: {filterDescription}. Chỉ hiển thị các đơn vị có tỷ lệ từ 2% đến 150%.</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center flex-grow">
         <p className="text-sm text-muted-foreground">Không có dữ liệu cho kỳ đã chọn hoặc theo bộ lọc tỷ lệ.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-[350px] flex flex-col">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChartHorizontal className="h-4 w-4" />Quỹ Lương/Doanh Thu theo Địa Điểm</CardTitle>
        <CardDescription className="text-xs">
          Tỷ lệ (Lương FT + Lương PT) / Doanh thu cho mỗi địa điểm (2% - 150%). Sắp xếp từ cao đến thấp. Cho: {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden">
         <ScrollArea className="h-full w-full"> 
            <ChartContainer 
              config={chartConfig} 
              className="h-full w-full" 
              style={{ height: `${chartContainerHeight}px`}} 
            >
                <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                    layout="vertical"
                    data={chartData} 
                    margin={{ top: 15, right: 60, left: 20, bottom: barChartMarginBottom }} 
                    barCategoryGap="20%" 
                    barGap={4} 
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis 
                        type="number"
                        domain={[0, xAxisDomainMax]} 
                        tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={8}
                        className="text-xs"
                    />
                    <YAxis 
                        type="category"
                        dataKey="location_name" 
                        width={Y_AXIS_WIDTH} 
                        tickLine={false} 
                        axisLine={false} 
                        tickMargin={5} 
                        className="text-xs"
                        interval={0} 
                    />
                    <Tooltip
                    content={<ChartTooltipContent
                        formatter={(value, name, props) => {
                            const dataKey = props.dataKey as keyof typeof chartConfig;
                            const payloadValue = props.payload?.[dataKey];
                            if (typeof payloadValue === 'number') {
                                return `${(payloadValue * 100).toFixed(1)}%`;
                            }
                            return String(value); 
                        }}
                        labelFormatter={(label, payload) => {
                           if (payload && payload.length > 0 && payload[0].payload) {
                             const total = (payload[0].payload.total_ratio * 100).toFixed(1);
                             return `${label} (Tổng: ${total}%)`;
                           }
                           return label;
                        }}
                        itemSorter={(item) => (item.dataKey === 'ft_salary_ratio_component' ? 0 : 1)}
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
                            {payload?.sort((a,b) => (a.dataKey === 'ft_salary_ratio_component' ? -1 : 1))
                                .map((entry: any) => {
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
                    <Bar 
                        dataKey="ft_salary_ratio_component" 
                        stackId="a" 
                        fill="var(--color-ft_salary_ratio_component)" 
                        name={chartConfig.ft_salary_ratio_component.label}
                        radius={[4, 0, 0, 4]} 
                        barSize={Math.max(15, MIN_CATEGORY_HEIGHT * 0.6)} 
                    >
                        <LabelList 
                            dataKey="ft_salary_ratio_component" 
                            position="center" 
                            content={<CustomSegmentLabel />} 
                        />
                    </Bar>
                    <Bar 
                        dataKey="pt_salary_ratio_component" 
                        stackId="a" 
                        fill="var(--color-pt_salary_ratio_component)" 
                        name={chartConfig.pt_salary_ratio_component.label}
                        radius={[0, 4, 4, 0]}
                        barSize={Math.max(15, MIN_CATEGORY_HEIGHT * 0.6)}
                    >
                        <LabelList 
                            dataKey="pt_salary_ratio_component" 
                            position="center" 
                            content={<CustomSegmentLabel />} 
                        />
                        <LabelList 
                            dataKey="total_ratio" 
                            position="right" 
                            content={<CustomTotalLabel chartData={chartData}/>}
                        />
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

