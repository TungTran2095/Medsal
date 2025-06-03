
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, TrendingUp, Banknote, Percent, AlertTriangle, LineChart as LineChartIcon } from 'lucide-react';
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
  loading: () => <div className="flex items-center justify-center h-[280px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading chart...</p></div>,
});


const chartConfig = {
  totalRevenue: {
    label: 'Doanh Thu',
    color: 'hsl(var(--chart-1))',
    icon: TrendingUp,
  },
  totalCombinedSalary: {
    label: 'Tổng Lương',
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
  total_salary?: number;
  total_revenue?: number;
}

interface CombinedMonthlyTrendData {
  month_label: string;
  year_val: number;
  name: string;
  totalRevenue?: number | null;
  totalCombinedSalary?: number | null;
  salaryRevenueRatio?: number | null;
}

interface CombinedMonthlyTrendChartProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartments?: string[]; // Added
}

const CRITICAL_SETUP_ERROR_PREFIX = "LỖI CÀI ĐẶT QUAN TRỌNG:";

export default function CombinedMonthlyTrendChart({ selectedYear, selectedMonths, selectedDepartments }: CombinedMonthlyTrendChartProps) {
  const [chartData, setChartData] = useState<CombinedMonthlyTrendData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("tất cả các kỳ và địa điểm");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setChartData([]);

    const departmentNames = selectedDepartments?.map(depId => depId.split('__')[1]).filter(Boolean) || [];

    let description;
    const yearPart = selectedYear ? `Năm ${selectedYear}` : "tất cả các năm có sẵn";
    let monthPart = "tất cả các tháng";
    if (selectedMonths && selectedMonths.length > 0) {
        if (selectedMonths.length === 12) {
            monthPart = "tất cả các tháng";
        } else if (selectedMonths.length === 1) {
            monthPart = `Tháng ${String(selectedMonths[0]).padStart(2, '0')}`;
        } else {
            monthPart = `các tháng ${selectedMonths.map(m => String(m).padStart(2, '0')).join(', ')}`;
        }
    }
    
    let locationPart = "tất cả địa điểm";
    if(departmentNames.length > 0) {
        if(departmentNames.length <=2) {
            locationPart = departmentNames.join(' & ');
        } else {
            locationPart = `${departmentNames.length} địa điểm`;
        }
    }
    description = `${monthPart} của ${yearPart} tại ${locationPart}`;
    setFilterDescription(description);


    const rpcArgs = { 
      p_filter_year: selectedYear,
      p_filter_locations: departmentNames.length > 0 ? departmentNames : null,
    };
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
          if (rpcMessageText.includes(`relation "${mainTableLc}" does not exist`) || rpcMessageText.includes(`relation "${mainDataTableName}" does not exist`)) {
              setupErrorDetails += ` Bảng '${mainDataTableName}' không tồn tại.`;
              isCriticalSetupError = true;
          }
          
          if (rpcMessageText.includes('column f.dia_diem does not exist') && mainDataTableName === 'Fulltime') {
            setupErrorDetails += ` Cột 'dia_diem' (địa điểm) dường như bị thiếu trong bảng 'Fulltime'.`; isCriticalSetupError = true;
          }
          if (rpcMessageText.includes('column pt."don vi" does not exist') && mainDataTableName === 'Parttime') { // Note: "don vi" might be case sensitive in error message
            setupErrorDetails += ` Cột '"Don vi"' (địa điểm) dường như bị thiếu trong bảng 'Parttime'.`; isCriticalSetupError = true;
          }
          if (rpcMessageText.includes('column dr."tên đơn vị" does not exist') && mainDataTableName === 'Doanh_thu') { // Note: "tên đơn vị" might be case sensitive
            setupErrorDetails += ` Cột '"Tên đơn vị"' (địa điểm) dường như bị thiếu trong bảng 'Doanh_thu'.`; isCriticalSetupError = true;
          }


          const namColLcForPattern = expectedNamColumn.replace(/"/g, '').toLowerCase();
          const namColumnMissingPattern = new RegExp(`column "?(${mainTableLc}|f|pt|dr)"?\\."?${namColLcForPattern}"? does not exist|column "?${expectedNamColumn.replace(/"/g, '')}"? of relation "(${mainTableLc}|${mainDataTableName})" does not exist|column "?${expectedNamColumn.replace(/"/g, '')}"? does not exist`, 'i');

          if (namColumnMissingPattern.test(rpcMessageText) && (rpcMessageText.includes(mainTableLc) || rpcMessageText.includes(` ${mainDataTableName.charAt(0).toLowerCase()}.`) || rpcMessageText.includes(' f.') || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột ${expectedNamColumn} (kiểu số nguyên, dùng cho năm) dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }

          const thangColLcForPattern = expectedThangColumn.replace(/"/g, '').toLowerCase();
          const thangColumnMissingPattern = new RegExp(`column "?(${mainTableLc}|f|pt|dr)"?\\."?${thangColLcForPattern}"? does not exist|column "?${expectedThangColumn.replace(/"/g, '')}"? of relation "(${mainTableLc}|${mainDataTableName})" does not exist|column "?${expectedThangColumn.replace(/"/g, '')}"? does not exist`, 'i');
          if (thangColumnMissingPattern.test(rpcMessageText) && (rpcMessageText.includes(mainTableLc) || rpcMessageText.includes(` ${mainDataTableName.charAt(0).toLowerCase()}.`) || rpcMessageText.includes(' f.') || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột ${expectedThangColumn} (TEXT, ví dụ ${expectedThangColumnExample}, dùng để nối với Time."Thang_x") dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }

          const dataColLc = salaryColumnName.replace(/"/g, '').toLowerCase();
          const dataColPattern = new RegExp(`column "?(${mainTableLc}|f|pt|dr)"?\\."?${dataColLc.replace(' ', '\\s')}"? does not exist|column "?${salaryColumnName.replace(/"/g, '')}"? of relation "(${mainTableLc}|${mainDataTableName})" does not exist|column "?${salaryColumnName.replace(/"/g, '')}"? does not exist`, 'i');
          if (dataColPattern.test(rpcMessageText) && (rpcMessageText.includes(mainTableLc) || rpcMessageText.includes(` ${mainDataTableName.charAt(0).toLowerCase()}.`) || rpcMessageText.includes(' f.') || rpcMessageText.includes(' pt.') || rpcMessageText.includes(' dr.'))) {
             setupErrorDetails += ` Cột dữ liệu '${salaryColumnName}' dường như bị thiếu trong bảng '${mainDataTableName}'.`;
             isCriticalSetupError = true;
          }


          if (isCriticalSetupError) {
            let detailedGuidance = `${CRITICAL_SETUP_ERROR_PREFIX} Lỗi với hàm RPC '${functionName}' hoặc các bảng phụ thuộc. Chi tiết:${setupErrorDetails.trim()}`;
            detailedGuidance += `\n\nVui lòng kiểm tra và đảm bảo các mục sau theo README.md:`;
            detailedGuidance += `\n1. Hàm RPC '${functionName}' được tạo đúng và đã được cập nhật để nhận tham số 'p_filter_locations TEXT[]'.`;
            detailedGuidance += `\n2. Bảng 'Time' (viết hoa T) tồn tại với các cột: "Năm" (INT8/INTEGER), "thangpro" (TEXT, ví dụ: '01', '12', dùng để sắp xếp tháng), và "Thang_x" (TEXT, ví dụ: 'Tháng 01', dùng cho trục X và nối với cột tháng của các bảng dữ liệu).`;

            if (mainDataTableName === 'Fulltime') {
                detailedGuidance += `\n3. Bảng 'Fulltime' tồn tại với cột 'nam' (INTEGER) cho năm, 'thang' (TEXT, ví dụ 'Tháng 01') cho tháng, và 'dia_diem' (TEXT) cho địa điểm.`;
                detailedGuidance += `\n4. Bảng 'Fulltime' cũng cần cột '${salaryColumnName}' (số liệu).`;
            } else if (mainDataTableName === 'Parttime') {
                detailedGuidance += `\n3. Bảng 'Parttime' tồn tại với cột '"Nam"' (INTEGER) cho năm, '"Thoi gian"' (TEXT, ví dụ 'Tháng 01') cho tháng, và '"Don vi"' (TEXT) cho địa điểm.`;
                detailedGuidance += `\n4. Bảng 'Parttime' cũng cần cột '${salaryColumnName}' (số liệu).`;
            } else if (mainDataTableName === 'Doanh_thu') {
                detailedGuidance += `\n3. Bảng 'Doanh_thu' tồn tại với cột '"Năm"' (INTEGER) cho năm, '"Tháng"' (TEXT, ví dụ 'Tháng 01') cho tháng, và '"Tên đơn vị"' (TEXT) cho địa điểm.`;
                detailedGuidance += `\n4. Bảng 'Doanh_thu' cũng cần cột '${salaryColumnName}' (số liệu).`;
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

      const processedData = Array.from(mergedDataMap.values())
        .map(item => ({
          ...item,
          totalRevenue: item.totalRevenue === 0 ? null : item.totalRevenue,
          totalCombinedSalary: item.totalCombinedSalary === 0 ? null : item.totalCombinedSalary,
          salaryRevenueRatio: (item.totalRevenue && item.totalRevenue !== 0) ? (item.totalCombinedSalary || 0) / item.totalRevenue : null,
        }));

      const baseSortedData = processedData
        .filter(item => {
          const isRevenuePresent = typeof item.totalRevenue === 'number' && item.totalRevenue !== 0;
          const isSalaryPresent = typeof item.totalCombinedSalary === 'number' && item.totalCombinedSalary !== 0;
          return isRevenuePresent || isSalaryPresent;
        })
        .sort((a, b) => {
          if (a.year_val !== b.year_val) return a.year_val - b.year_val;
          const monthANum = parseInt(String(a.month_label).replace(/\D/g, ''), 10);
          const monthBNum = parseInt(String(b.month_label).replace(/\D/g, ''), 10);
          if (!isNaN(monthANum) && !isNaN(monthBNum)) {
            return monthANum - monthBNum;
          }
          return String(a.month_label).localeCompare(String(b.month_label));
        });

      let finalChartDataToDisplay = baseSortedData;
      if (selectedMonths && selectedMonths.length > 0) {
          finalChartDataToDisplay = baseSortedData.filter(item => {
              const monthNumber = parseInt(String(item.month_label).replace(/\D/g, ''), 10);
              return !isNaN(monthNumber) && selectedMonths.includes(monthNumber);
          });
      }

      setChartData(finalChartDataToDisplay);


    } catch (err: any) {
      setError(err.message || 'Không thể xử lý dữ liệu xu hướng hàng tháng.');
      console.error("Error processing combined monthly trend data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartments]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currencyLabelFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('vi-VN', { notation: 'compact', compactDisplay: 'short' }).format(value);
  };

  const percentageLabelFormatter = (value: number) => {
    if (value === null || value === undefined) return '';
    return `${(value * 100).toFixed(0)}%`;
  };


  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Theo Tháng</CardTitle>
          <CardDescription className="text-xs truncate">Đang tải dữ liệu xu hướng...</CardDescription>
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
                  Đảm bảo rằng tất cả các bảng và hàm RPC đã được cập nhật để hỗ trợ lọc theo địa điểm ('p_filter_locations').
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
          <CardDescription className="text-xs truncate">Cho: {filterDescription}</CardDescription>
       </CardHeader>
       <CardContent className="pt-2 flex items-center justify-center h-[280px]">
         <p className="text-sm text-muted-foreground">Không tìm thấy dữ liệu cho kỳ và địa điểm đã chọn.</p>
       </CardContent>
     </Card>
   );
 }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-base font-semibold flex items-center gap-1.5"><LineChartIcon className="h-4 w-4" />Xu Hướng Doanh Thu, Lương & Tỷ Lệ</CardTitle>
        <CardDescription className="text-xs truncate">
          Doanh thu, tổng lương và tỷ lệ QL/DT cho {filterDescription}.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <DynamicComposedChart data={chartData} margin={{ top: 15, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                tickFormatter={() => ''}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tickFormatter={() => ''}
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
              <Line
                connectNulls
                yAxisId="left"
                type="monotone"
                dataKey="totalRevenue"
                stroke="var(--color-totalRevenue)"
                strokeWidth={2}
                dot={false}
                name={chartConfig.totalRevenue.label}
                label={{
                  formatter: currencyLabelFormatter,
                  fontSize: 9,
                  position: 'top',
                  dy: -5,
                  className: 'fill-muted-foreground'
                }}
              />
              <Line
                connectNulls
                yAxisId="left"
                type="monotone"
                dataKey="totalCombinedSalary"
                stroke="var(--color-totalCombinedSalary)"
                strokeWidth={2}
                dot={false}
                name={chartConfig.totalCombinedSalary.label}
                label={{
                  formatter: currencyLabelFormatter,
                  fontSize: 9,
                  position: 'top',
                  dy: -5,
                  className: 'fill-muted-foreground'
                }}
              />
              <Line
                connectNulls
                yAxisId="right"
                type="monotone"
                dataKey="salaryRevenueRatio"
                stroke="var(--color-salaryRevenueRatio)"
                strokeWidth={2}
                dot={{ r: 3, strokeWidth: 1, className:'fill-background' }}
                name={chartConfig.salaryRevenueRatio.label}
                label={{
                  formatter: percentageLabelFormatter,
                  fontSize: 9,
                  position: 'top',
                  dy: -5,
                  className: 'fill-muted-foreground'
                }}
              />
            </DynamicComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

