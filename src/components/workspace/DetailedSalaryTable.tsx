
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle, ListChecks, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface DetailedSalaryData {
  ma_nv: string;
  ho_ten: string;
  tong_cong_cy: number | null;
  tien_linh_cy: number | null;
  tien_linh_per_cong_cy: number | null;
  tong_cong_py: number | null;
  tien_linh_py: number | null;
  tien_linh_per_cong_py: number | null;
  total_records?: bigint; 
  overall_sum_tien_linh_cy?: number | null; 
  overall_sum_tong_cong_cy?: number | null; 
}

interface DetailedSalaryTableProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

type SortableColumn = 'ma_nv' | 'ho_ten' | 'tong_cong_cy' | 'tien_linh_cy' | 'tien_linh_per_cong_cy' | 'growth_tong_cong' | 'growth_tien_linh' | 'growth_tien_linh_per_cong';

interface SortConfig {
  key: SortableColumn;
  direction: 'ascending' | 'descending';
}

interface SalaryMonthChartPoint {
  month: number;
  salary: number;
  workdays: number;
  per_workday: number;
  per_workday_prev: number;
}

type SalaryMonthRow = Record<string, any>;
type SalaryMonthMap = Record<string, { chartData: SalaryMonthChartPoint[]; rows: SalaryMonthRow[] }>;

// Hàm rút gọn số: 2.000.000 => 2tr
const compactNumber = (value: number) => {
  if (value == null) return '';
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'tỷ';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr';
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return value.toString();
};

export default function DetailedSalaryTable({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
}: DetailedSalaryTableProps) {
  const [data, setData] = useState<DetailedSalaryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const { toast } = useToast();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ma_nv', direction: 'ascending' });

  // States cho nút mở rộng
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, any>>({});
  const [salaryMonthData, setSalaryMonthData] = useState<SalaryMonthMap>({});
  const [salaryMonthLoading, setSalaryMonthLoading] = useState(false);
  const [filterMaNv, setFilterMaNv] = useState('');
  const [filterHoTen, setFilterHoTen] = useState('');

  // Hàm lấy thông tin hành chính từ MS_CBNV
  const fetchEmployeeDetail = async (ma_nv: string) => {
    setDetailLoading(true);
    try {
      const { data, error } = await supabase
        .from('MS_CBNV')
        .select('*')
        .eq('Mã nhân viên', ma_nv)
        .limit(1);
      if (error) throw error;
      setDetailData(prev => ({ ...prev, [ma_nv]: data?.[0] || null }));
    } catch (e) {
      setDetailData(prev => ({ ...prev, [ma_nv]: null }));
    } finally {
      setDetailLoading(false);
    }
  };

  // Hàm lấy dữ liệu lương theo tháng cho nhân viên
  const fetchSalaryMonthData = async (ma_nv: string) => {
    setSalaryMonthLoading(true);
    try {
      // Lấy năm mới nhất
      const { data: yearData } = await supabase.from('Fulltime').select('nam').eq('ma_nhan_vien', ma_nv).order('nam', { ascending: false }).limit(1);
      const maxYear = yearData?.[0]?.nam;
      if (!maxYear) throw new Error('Không tìm thấy năm');
      
      // Lấy toàn bộ cột (trừ stt) cho năm hiện tại
      const { data: curDataRaw, error: curErr } = await supabase
        .from('Fulltime')
        .select('*')
        .eq('ma_nhan_vien', ma_nv)
        .eq('nam', maxYear);
      if (curErr) throw curErr;
      const curData = (curDataRaw || []).map(({ stt, ...rest }) => rest);
      
      // Lấy lương/công từng tháng năm ngoái
      const { data: prevDataRaw, error: prevErr } = await supabase
        .from('Fulltime')
        .select('*')
        .eq('ma_nhan_vien', ma_nv)
        .eq('nam', maxYear - 1);
      if (prevErr) throw prevErr;
      const prevData = (prevDataRaw || []).map(({ stt, ...rest }) => rest);
      
      // Xử lý dữ liệu
      const parseMonth = (thang: string) => parseInt((thang || '').replace(/\D/g, ''), 10);
      const groupByMonth = (arr: any[]) => {
        const map: Record<number, any> = {};
        arr.forEach(row => {
          const m = parseMonth(row.thang);
          if (!m) return;
          if (!map[m]) map[m] = { month: m, salary: 0, workdays: 0, per_workday: 0 };
          map[m].salary += Number((row.tong_thu_nhap || '0').toString().replace(/,/g, ''));
          map[m].workdays +=
            (Number(row.ngay_thuong_chinh_thuc) || 0) +
            (Number(row.ngay_thuong_thu_viec) || 0) +
            (Number(row.nghi_tuan) || 0) +
            (Number(row.le_tet) || 0) +
            (Number(row.ngay_thuong_chinh_thuc2) || 0) +
            (Number(row.ngay_thuong_thu_viec3) || 0) +
            (Number(row.nghi_tuan4) || 0) +
            (Number(row.le_tet5) || 0) +
            (Number(row.nghi_nl) || 0);
        });
        return map;
      };

      const curMonthMap = groupByMonth(curData || []);
      const prevMonthMap = groupByMonth(prevData || []);

      // Tạo dữ liệu cho biểu đồ
      const chartData: SalaryMonthChartPoint[] = [];
      for (let month = 1; month <= 12; month++) {
        const curMonth = curMonthMap[month];
        const prevMonth = prevMonthMap[month];
        
        if (curMonth || prevMonth) {
          chartData.push({
            month,
            salary: curMonth?.salary || 0,
            workdays: curMonth?.workdays || 0,
            per_workday: curMonth?.workdays > 0 ? curMonth.salary / curMonth.workdays : 0,
            per_workday_prev: prevMonth?.workdays > 0 ? prevMonth.salary / prevMonth.workdays : 0
          });
        }
      }

      setSalaryMonthData(prev => ({ ...prev, [ma_nv]: { chartData, rows: curData } }));
    } catch (e) {
      console.error('Error fetching salary month data:', e);
      setSalaryMonthData(prev => ({ ...prev, [ma_nv]: { chartData: [], rows: [] } }));
    } finally {
      setSalaryMonthLoading(false);
    }
  };

  // Hàm xử lý mở rộng dòng
  const handleExpand = (ma_nv: string) => {
    if (expandedRow === ma_nv) {
      setExpandedRow(null);
    } else {
      setExpandedRow(ma_nv);
      if (!detailData[ma_nv]) fetchEmployeeDetail(ma_nv);
      if (!salaryMonthData[ma_nv]) fetchSalaryMonthData(ma_nv);
    }
  };

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rpcArgs = {
        p_filter_year: selectedYear,
        p_filter_months: (selectedMonths && selectedMonths.length > 0) ? selectedMonths : null,
        p_filter_locations: (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) ? selectedDepartmentsForDiadiem : null,
        p_filter_nganh_docs: (selectedNganhDoc && selectedNganhDoc.length > 0) ? selectedNganhDoc : null,
        p_limit: null, 
        p_offset: 0,
      };

      const functionName = 'get_detailed_employee_salary_data';
      const { data: rpcData, error: rpcError } = await supabase.rpc(functionName, rpcArgs);

      if (rpcError) {
        let detailedErrorMessage = rpcError.message || `Không thể tải dữ liệu chi tiết lương qua RPC '${functionName}'.`;
        if (rpcError.code === '42883' || (rpcError.message && rpcError.message.toLowerCase().includes("does not exist") && rpcError.message.toLowerCase().includes(functionName))) {
          detailedErrorMessage = `Hàm RPC '${functionName}' không tìm thấy hoặc có lỗi. Vui lòng kiểm tra định nghĩa hàm trong Supabase theo README.md. Đảm bảo bảng Fulltime có các cột cần thiết cho cả năm hiện tại và năm trước.`;
        } else if (rpcError.message && (rpcError.message.toLowerCase().includes("column") && rpcError.message.toLowerCase().includes("does not exist"))) {
            detailedErrorMessage = `Một hoặc nhiều cột cần thiết không tồn tại trong bảng 'Fulltime'. Hàm RPC '${functionName}' cần các cột này.`;
        }
        throw new Error(detailedErrorMessage);
      }

      if (rpcData && rpcData.length > 0) {
        setData(rpcData.map((item: any) => ({
          ma_nv: String(item.ma_nv),
          ho_ten: String(item.ho_ten),
          tong_cong_cy: item.tong_cong_cy !== null ? Number(item.tong_cong_cy) : null,
          tien_linh_cy: item.tien_linh_cy !== null ? Number(item.tien_linh_cy) : null,
          tien_linh_per_cong_cy: item.tien_linh_per_cong_cy !== null ? Number(item.tien_linh_per_cong_cy) : null,
          tong_cong_py: item.tong_cong_py !== null ? Number(item.tong_cong_py) : null,
          tien_linh_py: item.tien_linh_py !== null ? Number(item.tien_linh_py) : null,
          tien_linh_per_cong_py: item.tien_linh_per_cong_py !== null ? Number(item.tien_linh_per_cong_py) : null,
        })));
        // total_records from RPC now refers to CY unique employees
        setTotalRecords(Number(rpcData[0].total_records) || 0); 
      } else {
        setData([]);
        setTotalRecords(0);
      }

    } catch (e: any) {
      console.error(`Error fetching detailed salary data:`, JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
      let errorMessage = 'Không thể tải dữ liệu chi tiết lương.';
      if (e && typeof e === 'object') {
          if (e.message) {
              errorMessage = e.message;
          } else if ((e as any).details) { 
              errorMessage = `Lỗi chi tiết: ${(e as any).details}`;
          } else if ((e as any).code) { 
              errorMessage = `Lỗi RPC với mã: ${(e as any).code}`;
          }
      } else if (typeof e === 'string') {
          errorMessage = e;
      }
      setError(errorMessage);
      toast({
        title: "Lỗi Tải Dữ Liệu Lương Chi Tiết",
        description: errorMessage,
        variant: "destructive",
      });
      setData([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateGrowth = (current: number | null, previous: number | null): number | null => {
    if (current === null || previous === null) return null;
    if (previous === 0) {
      return current > 0 ? Infinity : (current < 0 ? -Infinity : 0);
    }
    return (current - previous) / Math.abs(previous);
  };

  const requestSort = (key: SortableColumn) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const dataWithGrowth = useMemo(() => {
    return data.map(row => ({
      ...row,
      growth_tong_cong: calculateGrowth(row.tong_cong_cy, row.tong_cong_py),
      growth_tien_linh: calculateGrowth(row.tien_linh_cy, row.tien_linh_py),
      growth_tien_linh_per_cong: calculateGrowth(row.tien_linh_per_cong_cy, row.tien_linh_per_cong_py),
    }));
  }, [data]);

  const filteredData = useMemo(() => {
    const maNvKeyword = filterMaNv.trim().toLowerCase();
    const hoTenKeyword = filterHoTen.trim().toLowerCase();

    return dataWithGrowth.filter(row => {
      const matchesMaNv = maNvKeyword ? row.ma_nv.toLowerCase().includes(maNvKeyword) : true;
      const matchesHoTen = hoTenKeyword ? row.ho_ten.toLowerCase().includes(hoTenKeyword) : true;
      return matchesMaNv && matchesHoTen;
    });
  }, [dataWithGrowth, filterMaNv, filterHoTen]);

  const sortedData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key!];
        const valB = b[sortConfig.key!];

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1; 
        if (valB === null) return -1;
        
        if (valA === Infinity) return sortConfig.direction === 'ascending' ? 1 : -1;
        if (valB === Infinity) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA === -Infinity) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valB === -Infinity) return sortConfig.direction === 'ascending' ? 1 : -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortConfig.direction === 'ascending'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };

  const formatNumber = (value: number | null) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
  };

  const renderGrowthCell = (growth: number | null) => {
    if (growth === null) return <TableCell className="text-center text-muted-foreground text-xs py-1.5 px-2">N/A</TableCell>;
    
    let colorClass = 'text-muted-foreground';
    let Icon = Minus;
    let displayValue = "";

    if (growth === Infinity) {
        displayValue = "Tăng ∞";
        colorClass = 'text-green-600 dark:text-green-500';
        Icon = TrendingUp;
    } else if (growth === -Infinity) {
        displayValue = "Giảm ∞";
        colorClass = 'text-red-600 dark:text-red-500';
        Icon = TrendingDown;
    } else if (growth > 0) {
        displayValue = `+${(growth * 100).toFixed(1)}%`;
        colorClass = 'text-green-600 dark:text-green-500';
        Icon = TrendingUp;
    } else if (growth < 0) {
        displayValue = `${(growth * 100).toFixed(1)}%`;
        colorClass = 'text-red-600 dark:text-red-500';
        Icon = TrendingDown;
    } else { // growth === 0
        displayValue = "0.0%";
    }
    
    return (
      <TableCell className={cn("text-center whitespace-nowrap text-xs py-1.5 px-2", colorClass)}>
        <div className="flex items-center justify-center gap-0.5">
          <Icon className="h-3 w-3" />
          {displayValue}
        </div>
      </TableCell>
    );
  };

  const SortableHeader = ({ columnKey, label, align = 'left' }: { columnKey: SortableColumn, label: string, align?: 'left' | 'right' | 'center' }) => (
    <TableHead
      className={cn("text-xs py-1.5 px-2 cursor-pointer hover:bg-muted/50 whitespace-nowrap", `text-${align}`)}
      onClick={() => requestSort(columnKey)}
    >
      <div className={cn("flex items-center gap-1", align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start')}>
        <span>{label}</span>
        {sortConfig.key === columnKey ? (
          sortConfig.direction === 'ascending' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </div>
    </TableHead>
  );

  return (
    <Card className="flex-grow flex flex-col h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-md font-semibold flex items-center gap-1.5">
          <ListChecks className="h-4 w-4 text-primary inline-block" />
          Bảng Lương Chi Tiết Nhân Viên (YoY)
        </CardTitle>
        <CardDescription className="text-xs">
          Dữ liệu lương, công và tăng trưởng YoY. Tổng số NV (kỳ hiện tại): {totalRecords}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
          <Input
            placeholder="Lọc theo Mã NV..."
            value={filterMaNv}
            onChange={(e) => setFilterMaNv(e.target.value)}
            className="h-9 text-xs"
          />
          <Input
            placeholder="Lọc theo Họ và Tên..."
            value={filterHoTen}
            onChange={(e) => setFilterHoTen(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div className="flex-grow min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <p className="text-sm">Đang tải dữ liệu lương chi tiết...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-6 w-6 mb-1" />
              <p className="font-semibold text-sm">Lỗi Tải Dữ Liệu</p>
              <p className="text-xs text-center whitespace-pre-line">{error}</p>
              {(error.includes("Hàm RPC") || error.includes("Cột")) && (
                  <p className="text-xs mt-1 text-center">
                      Vui lòng kiểm tra định nghĩa hàm RPC `get_detailed_employee_salary_data` trong Supabase (README.md) và đảm bảo bảng `Fulltime` tồn tại với các cột cần thiết.
                  </p>
              )}
            </div>
          )}
          {!isLoading && !error && data.length === 0 && (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground text-center py-4 text-sm">Không có dữ liệu lương chi tiết cho bộ lọc hiện tại.</p>
            </div>
          )}
          {!isLoading && !error && data.length > 0 && sortedData.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center py-4 text-sm">Không có nhân viên phù hợp bộ lọc Mã NV/Họ tên.</p>
            </div>
          )}
          {!isLoading && !error && sortedData.length > 0 && (
            <ScrollArea className="border rounded-md h-full overflow-x-hidden">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-8" />
                    <SortableHeader columnKey="ma_nv" label="Mã NV" />
                    <SortableHeader columnKey="ho_ten" label="Họ và Tên" />
                    <SortableHeader columnKey="tong_cong_cy" label="Tổng Công (CY)" align="right" />
                    <SortableHeader columnKey="tien_linh_cy" label="Tiền Lĩnh (CY)" align="right" />
                    <SortableHeader columnKey="tien_linh_per_cong_cy" label="Lĩnh/Công (CY)" align="right" />
                    <SortableHeader columnKey="growth_tong_cong" label="TT Công (YoY)" align="center"/>
                    <SortableHeader columnKey="growth_tien_linh" label="TT Tiền Lĩnh (YoY)" align="center"/>
                    <SortableHeader columnKey="growth_tien_linh_per_cong" label="TT Lĩnh/Công (YoY)" align="center"/>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((row) => (
                    <React.Fragment key={row.ma_nv}>
                      <TableRow>
                        <TableCell className="w-8 text-xs py-1.5 px-2">
                          <button onClick={() => handleExpand(row.ma_nv)} className="focus:outline-none">
                            {expandedRow === row.ma_nv ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ma_nv}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_ten}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatNumber(row.tong_cong_cy)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh_cy)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.tien_linh_per_cong_cy)}</TableCell>
                        {renderGrowthCell(row.growth_tong_cong)}
                        {renderGrowthCell(row.growth_tien_linh)}
                        {renderGrowthCell(row.growth_tien_linh_per_cong)}
                      </TableRow>
                      {expandedRow === row.ma_nv && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted px-4 py-2 animate-slideDown">
                            {/* Section 1: Thông tin hành chính */}
                            <div className="mb-4">
                              <div className="font-semibold mb-2 text-sm">Thông tin hành chính</div>
                              {detailLoading && !detailData[row.ma_nv] && (
                                <div className="text-xs text-muted-foreground">Đang tải thông tin chi tiết...</div>
                              )}
                              {detailData[row.ma_nv] && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                                  {Object.entries(detailData[row.ma_nv]).map(([k, v]) => (
                                    <div key={k} className="flex gap-1">
                                      <span className="font-semibold whitespace-nowrap">{k}:</span>
                                      <span className="truncate">{String(v)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!detailLoading && !detailData[row.ma_nv] && (
                                <div className="text-xs text-destructive">Không tìm thấy thông tin chi tiết.</div>
                              )}
                            </div>
                            
                            {/* Section 2: Biểu đồ lương Fulltime theo tháng */}
                            <div>
                              <div className="font-semibold mb-2 text-sm">Lương Fulltime theo tháng</div>
                              {salaryMonthLoading && (!salaryMonthData[row.ma_nv] || salaryMonthData[row.ma_nv].rows.length === 0) && (
                                <div className="text-xs text-muted-foreground">Đang tải dữ liệu lương theo tháng...</div>
                              )}
                              {salaryMonthData[row.ma_nv]?.chartData && salaryMonthData[row.ma_nv].chartData.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Line chart: Lương theo tháng */}
                                  <div>
                                    <div className="text-xs font-semibold mb-1">Lương theo tháng (năm hiện tại)</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                      <LineChart data={salaryMonthData[row.ma_nv].chartData}>
                                        <XAxis dataKey="month" tickFormatter={m => `Th${m}`} fontSize={11} />
                                        <Tooltip formatter={v => compactNumber(Number(v))} labelFormatter={m => `Tháng ${m}`} />
                                        <Line type="monotone" dataKey="salary" stroke="#3b82f6" name="Lương" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                                          <LabelList dataKey="salary" position="top" formatter={compactNumber} fontSize={11} />
                                        </Line>
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                  {/* Line chart: Lương/công theo tháng */}
                                  <div>
                                    <div className="text-xs font-semibold mb-1">Lương/Công theo tháng (so sánh 2 năm)</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                      <LineChart data={salaryMonthData[row.ma_nv].chartData}>
                                        <XAxis dataKey="month" tickFormatter={m => `Th${m}`} fontSize={11} />
                                        <Tooltip formatter={v => compactNumber(Number(v))} labelFormatter={m => `Tháng ${m}`} />
                                        <Legend />
                                        <Line type="monotone" dataKey="per_workday" stroke="#3b82f6" name="Năm nay" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                                          <LabelList dataKey="per_workday" position="top" formatter={compactNumber} fontSize={11} />
                                        </Line>
                                        <Line type="monotone" dataKey="per_workday_prev" stroke="#f59e42" name="Năm ngoái" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                                          <LabelList dataKey="per_workday_prev" position="top" formatter={compactNumber} fontSize={11} />
                                        </Line>
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                </div>
                              )}
                              {salaryMonthData[row.ma_nv]?.rows && salaryMonthData[row.ma_nv].rows.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-xs font-semibold mb-1">Bảng lương theo tháng (năm hiện tại)</div>
                                  <div className="relative border rounded-sm bg-background max-h-80 w-full max-w-full overflow-x-auto overflow-y-auto">
                                    <div className="min-w-[2600px]">
                                      <Table className="w-full">
                                        <TableHeader className="sticky top-0 z-30 bg-background">
                                          <TableRow>
                                            {Object.keys(salaryMonthData[row.ma_nv].rows[0] || {}).map((col) => (
                                              <TableHead
                                                key={col}
                                                className={cn(
                                                  "text-xs py-1.5 px-2 whitespace-nowrap sticky top-0 bg-background",
                                                  (col === 'ma_nhan_vien' || col === 'ma_nv') ? 'left-0 z-50 min-w-[140px]' : '',
                                                  col === 'ho_va_ten' ? 'left-[140px] z-40 min-w-[200px]' : ''
                                                )}
                                              >
                                                {col}
                                              </TableHead>
                                            ))}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {salaryMonthData[row.ma_nv].rows.map((item, idx) => (
                                            <TableRow key={`${row.ma_nv}-row-${idx}`}>
                                              {Object.keys(item).map((col, colIdx) => (
                                                <TableCell
                                                  key={`${row.ma_nv}-cell-${idx}-${colIdx}`}
                                                  className={cn(
                                                  "text-xs py-1.5 px-2 whitespace-nowrap",
                                                  (col === 'ma_nhan_vien' || col === 'ma_nv') ? 'sticky left-0 bg-background z-30 min-w-[140px]' : '',
                                                  col === 'ho_va_ten' ? 'sticky left-[140px] bg-background z-20 min-w-[200px]' : ''
                                                  )}
                                                >
                                                  {item[col] !== null && item[col] !== undefined ? String(item[col]) : 'N/A'}
                                                </TableCell>
                                              ))}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </div>
                                </div>
                              )}
                              {salaryMonthData[row.ma_nv]?.rows && salaryMonthData[row.ma_nv].rows.length === 0 && !salaryMonthLoading && (
                                <div className="text-xs text-destructive">Không có dữ liệu lương theo tháng.</div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
