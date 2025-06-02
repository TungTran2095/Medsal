
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, BarChart3 } from 'lucide-react';
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

interface LocationRatioStackedBarChartProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
}

interface ChartDataEntry {
  location_name: string;
  ft_salary_ratio_component: number;
  pt_salary_ratio_component: number;
  total_ratio: number; // For tooltip and potentially labels
}

const chartConfig = {
  ft_salary_ratio_component: {
    label: 'Lương FT / Doanh Thu',
    color: 'hsl(var(--chart-4))', 
  },
  pt_salary_ratio_component: {
    label: 'Lương PT / Doanh Thu',
    color: 'hsl(var(--chart-5))', 
  },
} satisfies ChartConfig;

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";
const MIN_CATEGORY_WIDTH = 80; // Minimum width per category on X-axis for readability

export default function LocationSalaryRevenueRatioStackedBarChart({ selectedMonths, selectedYear }: LocationRatioStackedBarChartProps) {
  const [chartData, setChartData] = useState<ChartDataEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);

    let description;
    let yearDesc = selectedYear ? `Năm ${selectedYear}` : "Tất cả các năm";
    let monthDesc = (selectedMonths && selectedMonths.length > 0)
      ? `Tháng ${selectedMonths.join(', ')}`
      : "Tất cả các tháng";

    if (selectedYear && selectedMonths && selectedMonths.length > 0) {
      description = `${monthDesc}, ${yearDesc}`;
    } else if (selectedYear) {
      description = yearDesc;
    } else if (selectedMonths && selectedMonths.length > 0) {
      description = `${monthDesc} (mọi năm)`;
    } else {
      description = "tất cả các kỳ";
    }
    setFilterDescription(description);

    const rpcArgs = {
      p_filter_year: selectedYear,
      p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
    };
    const functionName = 'get_salary_revenue_ratio_components_by_location';

    try {
      const { data, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        const rpcMessageText = rpcError.message ? String(rpcError.message).toLowerCase() : '';
        const isFunctionMissingError =
            rpcError.code === '42883' ||
            (rpcError.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) ||
            (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

        let setupErrorDetails = "";
        if (isFunctionMissingError) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Hàm RPC '${functionName}' bị thiếu hoặc sai. Hãy đảm bảo nó tồn tại trong Supabase và khớp với định nghĩa trong README.md (bao gồm cả tham số và kiểu trả về).`;
        } else if (rpcMessageText.includes('relation "fulltime" does not exist')) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Bảng 'Fulltime' không tồn tại.`;
        } else if (rpcMessageText.includes('column f.dia_diem does not exist') || rpcMessageText.includes('column dia_diem of relation "fulltime" does not exist')) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Cột 'dia_diem' không tồn tại trong bảng 'Fulltime'.`;
        } else if (rpcMessageText.includes('relation "parttime" does not exist')) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Bảng 'Parttime' không tồn tại.`;
        } else if (rpcMessageText.includes('column pt."Don vi" does not exist') || rpcMessageText.includes('column "Don vi" of relation "parttime" does not exist')) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Cột '"Don vi"' không tồn tại trong bảng 'Parttime'.`;
        } else if (rpcMessageText.includes('relation "doanh_thu" does not exist')) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Bảng 'Doanh_thu' không tồn tại.`;
        } else if (rpcMessageText.includes('column dr."Tên đơn vị" does not exist') || rpcMessageText.includes('column "Tên đơn vị" of relation "doanh_thu" does not exist')) {
            setupErrorDetails = `${CRITICAL_SETUP_ERROR_PREFIX} Cột '"Tên đơn vị"' không tồn tại trong bảng 'Doanh_thu'.`;
        }


        if (setupErrorDetails) {
          setError(setupErrorDetails + "\nVui lòng kiểm tra README.md để biết chi tiết về cấu trúc bảng và hàm RPC cần thiết.");
        } else {
          setError(`Lỗi tải dữ liệu theo địa điểm: ${rpcError.message}. Kiểm tra cấu hình RPC và các bảng liên quan.`);
        }
        return;
      }

      if (data) {
        const processedData = data.map((item: any) => ({
          location_name: item.location_name,
          ft_salary_ratio_component: Number(item.ft_salary_ratio_component) || 0,
          pt_salary_ratio_component: Number(item.pt_salary_ratio_component) || 0,
          total_ratio: (Number(item.ft_salary_ratio_component) || 0) + (Number(item.pt_salary_ratio_component) || 0),
        })).filter(item => item.total_ratio > 0); 
        setChartData(processedData);
      }

    } catch (err: any) {
      setError('Không thể xử lý dữ liệu tỷ lệ theo địa điểm.');
      console.error("Error processing location ratio data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const percentageFormatter = (value: number) => {
    if (value === null || value === undefined || Number.isNaN(value) || value === 0) return ''; // Don't show label for 0
    return `${(value * 100).toFixed(0)}%`;
  };
  
  const yAxisTickFormatter = (value: number) => `${(value * 100).toFixed(0)}%`;
  const chartWidth = Math.max(300, chartData.length * MIN_CATEGORY_WIDTH);


  if (isLoading) {
    return (
      <Card className="h-[350px]">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />QL/DT theo Địa Điểm</CardTitle>
          <CardDescription className="text-xs">Đang tải dữ liệu...</CardDescription>
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
            Lỗi QL/DT theo Địa Điểm
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive whitespace-pre-line">{error}</p>
           {(error.includes(CRITICAL_SETUP_ERROR_PREFIX)) && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
              Vui lòng kiểm tra hàm RPC `get_salary_revenue_ratio_components_by_location` và các bảng/cột liên quan (`Fulltime`.`dia_diem`, `Parttime`.`"Don vi"`, `Doanh_thu`.`"Tên đơn vị"`, các cột lương, doanh thu, năm, tháng) đã được tạo đúng theo README.md.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card className="h-[350px]">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />QL/DT theo Địa Điểm</CardTitle>
          <CardDescription className="text-xs">Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[280px]">
         <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-[350px] flex flex-col">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Quỹ lương/Doanh thu theo Địa điểm</CardTitle>
        <CardDescription className="text-xs">
          Tỷ trọng QL/DT (Lương FT + Lương PT so với Doanh thu) cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-grow overflow-hidden">
        <ScrollArea className="h-full w-full pb-4">
          <ChartContainer config={chartConfig} className="h-[260px]" style={{ width: `${chartWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="location_name" 
                  type="category" 
                  className="text-xs" 
                  interval={0} 
                  angle={chartData.length > 5 ? -30 : 0}
                  textAnchor={chartData.length > 5 ? "end" : "middle"}
                  height={chartData.length > 5 ? 50 : 30} // Adjust height for angled labels
                  dy={chartData.length > 5 ? 5 : 0}
                />
                <YAxis type="number" tickFormatter={yAxisTickFormatter} domain={[0, 'auto']} className="text-xs" />
                
                <Tooltip
                  content={<ChartTooltipContent
                    formatter={(value, name, props) => {
                        const key = name as keyof typeof chartConfig;
                        const itemConfig = chartConfig[key];
                        const formattedValue = percentageFormatter(value as number);
                        if (!itemConfig || !formattedValue) return null;
                        return (
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 shrink-0 rounded-[2px]" style={{backgroundColor: itemConfig?.color}}/>
                                {itemConfig?.label || name}:
                                <span className="ml-auto font-semibold">{formattedValue}</span>
                            </div>
                        );
                    }}
                    labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0 && payload[0].payload) {
                            const total = payload[0].payload.total_ratio;
                            return (
                                <>
                                    <div className="font-semibold">{label}</div>
                                    <div className="text-xs">Tổng tỷ lệ: {percentageFormatter(total)}</div>
                                </>
                            );
                        }
                        return label;
                    }}
                    cursor={{fill: 'hsl(var(--muted))', opacity: 0.5}}
                    itemSorter={(itemA, itemB) => { 
                        if (itemA.dataKey === 'ft_salary_ratio_component') return -1;
                        if (itemB.dataKey === 'ft_salary_ratio_component') return 1;
                        return 0;
                    }}
                   />}
                />
                <Legend
                    verticalAlign="top"
                    height={30}
                    wrapperStyle={{paddingBottom: "5px"}}
                    content={({ payload }) => (
                        <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                        {payload?.map((entry: any) => {
                            const configKey = entry.dataKey as keyof typeof chartConfig;
                            if(!chartConfig[configKey]) return null;
                            return (
                            <div key={`item-${entry.dataKey}`} className="flex items-center gap-0.5 cursor-pointer text-xs">
                                <span className="w-2 h-2 rounded-sm" style={{backgroundColor: entry.color}} />
                                <span style={{ color: entry.color }}>{chartConfig[configKey]?.label}</span>
                            </div>
                            );
                        })}
                        </div>
                    )}
                />
                <Bar dataKey="ft_salary_ratio_component" stackId="a" fill="var(--color-ft_salary_ratio_component)" name={chartConfig.ft_salary_ratio_component.label} radius={[0, 0, 4, 4]}>
                  <LabelList
                    dataKey="ft_salary_ratio_component"
                    position="center"
                    formatter={percentageFormatter}
                    className="text-xs fill-primary-foreground"
                  />
                </Bar>
                <Bar dataKey="pt_salary_ratio_component" stackId="a" fill="var(--color-pt_salary_ratio_component)" name={chartConfig.pt_salary_ratio_component.label} radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="pt_salary_ratio_component"
                    position="center"
                    formatter={percentageFormatter}
                    className="text-xs fill-primary-foreground"
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

