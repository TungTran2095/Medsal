
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, TrendingUp, Banknote, Percent, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

const chartConfig = {
  totalRevenue: {
    label: 'Doanh Thu',
    color: 'hsl(var(--chart-1))',
    icon: TrendingUp,
  },
  totalCombinedSalary: {
    label: 'Tổng Lương (FT+PT)',
    color: 'hsl(var(--chart-2))',
    icon: Banknote,
  },
  salaryRevenueRatio: {
    label: 'Tỷ Lệ QL/DT',
    color: 'hsl(var(--chart-3))',
    icon: Percent,
  },
} satisfies ChartConfig;

interface MonthlyTrendDataEntry {
  month_label: string;
  year_val: number;
  total_salary?: number; // Used by salary trend functions
  total_revenue?: number; // Used by revenue trend function
}

interface CombinedMonthlyTrendData {
  month_label: string; // This is Time."Thang_x"
  year_val: number;
  name: string; // This is also Time."Thang_x", used by Recharts XAxis dataKey
  totalRevenue?: number;
  totalCombinedSalary?: number;
  salaryRevenueRatio?: number;
}

interface CombinedMonthlyTrendChartProps {
  selectedYear?: number | null;
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function CombinedMonthlyTrendChart({ selectedYear }: CombinedMonthlyTrendChartProps) {
  const [chartData, setChartData] = useState<CombinedMonthlyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các năm có sẵn");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);

    const description = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm có sẵn";
    setFilterDescription(description);

    const rpcArgs = { p_filter_year: selectedYear };
    let errorsOccurred: string[] = [];

    try {
      const [
        ftSalaryRes,
        ptSalaryRes,
        revenueRes,
      ] = await Promise.allSettled([
        supabase.rpc('get_monthly_salary_trend_fulltime', rpcArgs),
        supabase.rpc('get_monthly_salary_trend_parttime', rpcArgs),
        supabase.rpc('get_monthly_revenue_trend', rpcArgs),
      ]);

      const processResponse = (
        res: PromiseSettledResult<any>,
        dataType: string, 
        functionName: string, 
        mainDataTableName: 'Fulltime' | 'Parttime' | 'Doanh_thu',
        salaryColumnName: string = 'tong_thu_nhap' 
      ): { data: MonthlyTrendDataEntry[], error?: string } => {
        if (res.status === 'fulfilled' && !res.value.error) {
          return { data: (res.value.data || []) as MonthlyTrendDataEntry[] };
        } else {
          const rpcError = res.status === 'fulfilled' ? res.value.error : res.reason;
          const rpcMessageText = rpcError?.message ? String(rpcError.message).toLowerCase() : '';
          
          let isCriticalSetupError =
            rpcError?.code === '42883' || 
            (rpcError?.code === 'PGRST202' && rpcMessageText.includes(functionName.toLowerCase())) || 
            (rpcMessageText.includes(functionName.toLowerCase()) && rpcMessageText.includes('does not exist'));

          let setupErrorDetails = "";
          let expectedNamColumn = 'nam';
          let expectedThangColumn = 'thang';
          let expectedThangColumnExample = "'Tháng 01'";

          if (mainDataTableName === 'Parttime') {
            expectedNamColumn = '"Nam"';
            expectedThangColumn = '"Thoi gian"';
          } else if (mainDataTableName === 'Doanh_thu') {
            expectedNamColumn = '"Năm"';
            expectedThangColumn = '"Tháng"';
          }


          if (rpcMessageText.includes('relation "time" does not exist')) {
            setupErrorDetails += " Bảng 'Time' (viết hoa T) không tồn tại.";
            isCriticalSetupError = true;
          }
          
          const mainTableLc = mainDataTableName.toLowerCase();
          if (rpcMessageText.includes(`relation "${mainTableLc}" does not exist`)) {
              setupErrorDetails += ` Bảng '${mainDataTableName}' không tồn tại.`;
              isCriticalSetupError = true;
          }
          
          const namColLcForPattern = expectedNamColumn.replace(/"/g, '').toLowerCase();
          const namColumnMissingPattern = new RegExp(`column "?(${mainTableLc}|f|pt|dr)"?\\."?${namColLcForPattern}"? does not exist|column "?${expectedNamColumn.replace(/"/g, '')}"? of relation "${mainTableLc}" does not exist|column "?${expectedNamColumn}"? does not exist`, 'i');
          if (namColumnMissingPattern.test(rpcMessageText) && (rpcMessageText.includes(mainTableLc) || rpcMessageText.includes(' f.') || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột ${expectedNamColumn} (kiểu số nguyên, dùng cho năm) dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }
          
          const thangColLcForPattern = expectedThangColumn.replace(/"/g, '').toLowerCase();
          const thangColumnMissingPattern = new RegExp(`column "?(${mainTableLc}|f|pt|dr)"?\\."?${thangColLcForPattern}"? does not exist|column "?${expectedThangColumn.replace(/"/g, '')}"? of relation "${mainTableLc}" does not exist|column "?${expectedThangColumn}"? does not exist`, 'i');
          if (thangColumnMissingPattern.test(rpcMessageText) && (rpcMessageText.includes(mainTableLc) || rpcMessageText.includes(' f.') || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột ${expectedThangColumn} (TEXT, ví dụ ${expectedThangColumnExample}, dùng để nối với Time."Thang_x") dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }
          
          const dataColLc = salaryColumnName.toLowerCase();
          const dataColPattern = new RegExp(`column "?(${mainTableLc}|f|pt|dr)"?\\."?${dataColLc.replace(' ', '\\s')}"? does not exist|column "?${dataColLc.replace(' ', '\\s')}"? of relation "${mainTableLc}" does not exist|column "?${dataColLc.replace(' ', '\\s')}"? does not exist`, 'i');
          if (dataColPattern.test(rpcMessageText) && (rpcMessageText.includes(mainTableLc) || rpcMessageText.includes(' f.') || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột dữ liệu '${salaryColumnName}' dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }


          if (isCriticalSetupError) {
            let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc các bảng phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
            detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo các mục sau theo README.md:`;
            detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng trong Supabase.`;
            detailedGuidance += `\n2. Bảng 'Time' (viết hoa T) tồn tại với các cột: "Năm" (kiểu số nguyên/int8), "thangpro" (TEXT, ví dụ: '01', '12', dùng để sắp xếp tháng), và "Thang_x" (TEXT, ví dụ: 'Tháng 01', dùng cho trục X và nối với cột tháng của các bảng dữ liệu).`;
            
            if (mainDataTableName === 'Fulltime') {
                detailedGuidance += `\n3. Bảng 'Fulltime' tồn tại với cột 'nam' (kiểu số nguyên) cho năm và cột 'thang' (TEXT, ví dụ 'Tháng 01') cho tháng.`;
                detailedGuidance += `\n4. Bảng 'Fulltime' cũng cần cột 'tong_thu_nhap' (số liệu).`;
            } else if (mainDataTableName === 'Parttime') {
                detailedGuidance += `\n3. Bảng 'Parttime' tồn tại với cột '"Nam"' (kiểu số nguyên) cho năm và cột '"Thoi gian"' (TEXT, ví dụ 'Tháng 01') cho tháng.`;
                detailedGuidance += `\n4. Bảng 'Parttime' cũng cần cột '${salaryColumnName}' (số liệu, thường là "Tong tien").`;
            } else if (mainDataTableName === 'Doanh_thu') {
                detailedGuidance += `\n3. Bảng 'Doanh_thu' tồn tại với cột '"Năm"' (kiểu số nguyên) cho năm và cột '"Tháng"' (TEXT, ví dụ 'Tháng 01') cho tháng.`;
                detailedGuidance += `\n4. Bảng 'Doanh_thu' cũng cần cột '${salaryColumnName}' (số liệu, thường là "Kỳ báo cáo") và "Tên đơn vị" (TEXT).`;
            }
            return { data: [], error: detailedGuidance };
          }
          
          const baseMessage = `Lỗi tải dữ liệu ${dataType}`;
          const messageDetail = rpcError?.message ? `: ${rpcError.message}` : (res.status === 'rejected' ? `: ${String(res.reason)}` : ". (Không có thông báo lỗi cụ thể từ RPC)");
          return { data: [], error: `${baseMessage}${messageDetail}${!messageDetail.endsWith('.') ? '. Kiểm tra cấu hình RPC hoặc bảng trong Supabase.' : ''}` };
        }
      };
      
      const ftSalaryResult = processResponse(ftSalaryRes, "lương full-time", 'get_monthly_salary_trend_fulltime', 'Fulltime', 'tong_thu_nhap');
      if (ftSalaryResult.error) errorsOccurred.push(ftSalaryResult.error);

      const ptSalaryResult = processResponse(ptSalaryRes, "lương part-time", 'get_monthly_salary_trend_parttime', 'Parttime', '"Tong tien"');
      if (ptSalaryResult.error) errorsOccurred.push(ptSalaryResult.error);
      
      const revenueResult = processResponse(revenueRes, "doanh thu", 'get_monthly_revenue_trend', 'Doanh_thu', '"Kỳ báo cáo"');
      if (revenueResult.error) errorsOccurred.push(revenueResult.error);

      if (errorsOccurred.length > 0) {
        setError(errorsOccurred.join('\n\n---\n\n'));
        setIsLoading(false);
        return;
      }

      const mergedDataMap = new Map<string, CombinedMonthlyTrendData>();

      const addToMap = (data: MonthlyTrendDataEntry[], type: 'ft_salary' | 'pt_salary' | 'revenue') => {
        data.forEach(item => {
          const key = `${item.year_val}-${item.month_label}`; 
          const existing = mergedDataMap.get(key) || {
            month_label: item.month_label,
            year_val: item.year_val,
            name: item.month_label, 
            totalRevenue: 0,
            totalCombinedSalary: 0,
          };

          if (type === 'revenue' && item.total_revenue !== undefined) {
            existing.totalRevenue = (existing.totalRevenue || 0) + (Number(item.total_revenue) || 0);
          } else if ((type === 'ft_salary' || type === 'pt_salary') && item.total_salary !== undefined) {
            existing.totalCombinedSalary = (existing.totalCombinedSalary || 0) + (Number(item.total_salary) || 0);
          }
          mergedDataMap.set(key, existing);
        });
      };

      addToMap(ftSalaryResult.data, 'ft_salary');
      addToMap(ptSalaryResult.data, 'pt_salary');
      addToMap(revenueResult.data, 'revenue');
      
      const finalChartData = Array.from(mergedDataMap.values())
        .map(item => ({
          ...item,
          salaryRevenueRatio: (item.totalRevenue && item.totalRevenue !== 0) ? (item.totalCombinedSalary || 0) / item.totalRevenue : undefined,
        }))
        .sort((a, b) => { 
          if (a.year_val !== b.year_val) return a.year_val - b.year_val;
          const monthANum = parseInt(String(a.month_label).replace(/\D/g, ''), 10);
          const monthBNum = parseInt(String(b.month_label).replace(/\D/g, ''), 10);
          if (!isNaN(monthANum) && !isNaN(monthBNum)) {
            return monthANum - monthBNum;
          }
          return String(a.month_label).localeCompare(String(b.month_label));
        });

      if (finalChartData.length > 0) {
        setChartData(finalChartData);
      }

    } catch (err: any) {
      setError(err.message || 'Không thể xử lý dữ liệu xu hướng hàng tháng.');
      console.error("Error processing combined monthly trend data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Đang tải dữ liệu xu hướng...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[280px] pt-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const errorMessages = error.split('\n\n---\n\n');
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-destructive flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Xu Hướng Hàng Tháng
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {errorMessages.map((msg, index) => (
            <div key={index} className="mb-2">
              <CardDescription className="text-xs text-destructive whitespace-pre-line">{msg}</CardDescription>
              {(msg.includes(CRITICAL_SETUP_ERROR_PREFIX)) && (
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">
                  Đây là một lỗi cấu hình quan trọng. Vui lòng kiểm tra kỹ các mục đã liệt kê ở trên trong cơ sở dữ liệu Supabase và tệp README.md.
                  Đảm bảo rằng tất cả các bảng và hàm RPC được đặt tên chính xác (có phân biệt chữ hoa chữ thường cho tên bảng như 'Time', 'Fulltime', 'Parttime', 'Doanh_thu') và có đúng các cột được yêu cầu.
                  Đặc biệt, kiểm tra cột năm ('nam' hoặc '"Nam"' hoặc '"Năm"') và cột tháng ('thang' hoặc '"Thoi gian"' hoặc '"Tháng"') trong các bảng dữ liệu, và cấu trúc bảng 'Time' ('"Năm"', 'thangpro', '"Thang_x"').
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
     <Card className="h-full">
       <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle>
          <CardDescription className="text-xs">Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[280px]">
         <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Doanh Thu, Lương & Tỷ Lệ</CardTitle>
        <CardDescription className="text-xs">
          Doanh thu, tổng lương (Full-time + Part-time) và tỷ lệ QL/DT mỗi tháng cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs"
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                domain={[0, 'auto']} 
              />
              <Tooltip
                content={<ChartTooltipContent
                    indicator="line"
                    formatter={(value, name, props) => {
                        const dataKey = props.dataKey as keyof typeof chartConfig;
                        const payloadValue = props.payload?.[dataKey];

                        if (typeof payloadValue === 'number') {
                           if (dataKey === 'salaryRevenueRatio') {
                             return `${(payloadValue * 100).toFixed(1)}%`;
                           }
                           return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0  }).format(payloadValue);
                        }
                        return String(value); 
                    }}
                    labelFormatter={(label, payload) => (payload && payload.length > 0 && payload[0].payload) ? `${label}, ${payload[0].payload.year_val}` : label}
                    itemSorter={(item) => {
                        if (item.dataKey === 'totalRevenue') return 0;
                        if (item.dataKey === 'totalCombinedSalary') return 1;
                        if (item.dataKey === 'salaryRevenueRatio') return 2;
                        return 3;
                    }}
                />}
              />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{paddingBottom: "10px"}}
                content={({ payload }) => (
                    <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                      {payload?.filter(p => chartConfig[p.dataKey as keyof typeof chartConfig])
                        .sort((a,b) => {
                            const orderA = chartConfig[a.dataKey as keyof typeof chartConfig] ? (a.dataKey === 'totalRevenue' ? 0 : a.dataKey === 'totalCombinedSalary' ? 1 : 2) : 3;
                            const orderB = chartConfig[b.dataKey as keyof typeof chartConfig] ? (b.dataKey === 'totalRevenue' ? 0 : b.dataKey === 'totalCombinedSalary' ? 1 : 2) : 3;
                            return orderA - orderB;
                        })
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
                  )
                }
              />
              <Line yAxisId="left" type="monotone" dataKey="totalRevenue" stroke="var(--color-totalRevenue)" strokeWidth={2} dot={false} name={chartConfig.totalRevenue.label} connectNulls />
              <Line yAxisId="left" type="monotone" dataKey="totalCombinedSalary" stroke="var(--color-totalCombinedSalary)" strokeWidth={2} dot={false} name={chartConfig.totalCombinedSalary.label} connectNulls />
              <Line yAxisId="right" type="monotone" dataKey="salaryRevenueRatio" stroke="var(--color-salaryRevenueRatio)" strokeWidth={2} dot={{ r: 3, strokeWidth: 1 }} name={chartConfig.salaryRevenueRatio.label} connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

