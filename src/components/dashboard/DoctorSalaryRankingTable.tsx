import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, AlertTriangle, BarChart3, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, XAxis, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface TopServiceRow {
  ten_dich_vu: string;
  so_luong: number;
  doanh_thu: number;
}

interface DoctorRankingRow {
  ma_nv: string;
  ho_ten: string;
  job_title: string;
  total_salary: number;
  salary_per_workday: number;
  total_revenue?: number; // Tổng doanh thu từ năm 2025
  salary_revenue_ratio?: number; // % lương/doanh thu
}

type SortKey = 'total_salary' | 'salary_per_workday' | 'ma_nv' | 'ho_ten' | 'job_title' | 'total_revenue' | 'salary_revenue_ratio';

type SortDir = 'asc' | 'desc';

// Thêm type cho sort
type ServiceSortKey = 'ten_dich_vu' | 'so_luong' | 'doanh_thu';

// Hàm rút gọn số: 2.000.000 => 2tr
const compactNumber = (value: number) => {
  if (value == null) return '';
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'tỷ';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr';
  if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return value.toString();
};

const CustomLineLabel = ({ x, y, value, color }: { x: number, y: number, value: any, color: string }) => {
  if (value === undefined || value === null) return null;
  return (
    <text x={x} y={y - 8} fontSize={11} textAnchor="middle" fill={color}>{compactNumber(Number(value))}</text>
  );
};

// Định nghĩa lại kiểu dữ liệu tree 3 cấp
interface TopServiceTree {
  [loaiDT: string]: {
    [loaiThucHien: string]: {
      [tenDV: string]: { so_luong: number; doanh_thu: number };
    };
  };
}

export default function DoctorSalaryRankingTable() {
  const [data, setData] = useState<DoctorRankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('total_salary');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Filter states
  const [filterName, setFilterName] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [filterSalaryMin, setFilterSalaryMin] = useState('');
  const [filterSalaryMax, setFilterSalaryMax] = useState('');
  const [filterPerWorkdayMin, setFilterPerWorkdayMin] = useState('');
  const [filterPerWorkdayMax, setFilterPerWorkdayMax] = useState('');
  // Thêm filter CCHN
  const [filterCchn, setFilterCchn] = useState<'all' | 'has' | 'none'>('all');

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, any>>({});
  const [salaryMonthData, setSalaryMonthData] = useState<Record<string, any[]>>({});
  const [salaryMonthLoading, setSalaryMonthLoading] = useState(false);
  const [cchnLoading, setCchnLoading] = useState(false);
  const [cchnData, setCchnData] = useState<Record<string, any>>({});
  const [revenueMonthData, setRevenueMonthData] = useState<Record<string, any[]>>({});
  const [revenueMonthLoading, setRevenueMonthLoading] = useState(false);
  const [topServicesData, setTopServicesData] = useState<Record<string, TopServiceTree>>({});
  const [topServicesLoading, setTopServicesLoading] = useState(false);
  const [serviceSortKey, setServiceSortKey] = useState<ServiceSortKey>('doanh_thu');
  const [serviceSortDir, setServiceSortDir] = useState<SortDir>('desc');

  // Thêm các state cho tree expand
  const [expandedLoaiDT, setExpandedLoaiDT] = useState<Record<string, boolean>>({});
  const [expandedLoaiThucHien, setExpandedLoaiThucHien] = useState<Record<string, boolean>>({});

  // Hàm toggle expand/collapse
  const toggleLoaiDT = (loaiDT: string) => {
    setExpandedLoaiDT(prev => ({ ...prev, [loaiDT]: !prev[loaiDT] }));
  };
  const toggleLoaiThucHien = (loaiDT: string, loaiThucHien: string) => {
    const key = `${loaiDT}__${loaiThucHien}`;
    setExpandedLoaiThucHien(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Hàm lấy chi tiết bác sĩ từ MS_CBNV
  const fetchDoctorDetail = async (ma_nv: string) => {
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

  // Hàm lấy dữ liệu lương theo tháng cho 1 bác sĩ
  const fetchSalaryMonthData = async (ma_nv: string) => {
    setSalaryMonthLoading(true);
    try {
      // Lấy năm mới nhất
      const { data: yearData } = await supabase.from('Fulltime').select('nam').eq('ma_nhan_vien', ma_nv).order('nam', { ascending: false }).limit(1);
      const maxYear = yearData?.[0]?.nam;
      if (!maxYear) throw new Error('Không tìm thấy năm');
      // Lấy lương từng tháng năm nay
      const { data: curData, error: curErr } = await supabase
        .from('Fulltime')
        .select('thang, tong_thu_nhap, ngay_thuong_chinh_thuc, ngay_thuong_thu_viec, nghi_tuan, le_tet, ngay_thuong_chinh_thuc2, ngay_thuong_thu_viec3, nghi_tuan4, le_tet5, nghi_nl')
        .eq('ma_nhan_vien', ma_nv)
        .eq('nam', maxYear);
      if (curErr) throw curErr;
      // Lấy lương/công từng tháng năm ngoái
      const { data: prevData, error: prevErr } = await supabase
        .from('Fulltime')
        .select('thang, tong_thu_nhap, ngay_thuong_chinh_thuc, ngay_thuong_thu_viec, nghi_tuan, le_tet, ngay_thuong_chinh_thuc2, ngay_thuong_thu_viec3, nghi_tuan4, le_tet5, nghi_nl')
        .eq('ma_nhan_vien', ma_nv)
        .eq('nam', maxYear - 1);
      if (prevErr) throw prevErr;
      // Xử lý dữ liệu
      const parseMonth = (thang: string) => parseInt((thang || '').replace(/\D/g, ''), 10);
      const groupByMonth = (arr: any[]) => {
        const map: Record<number, any> = {};
        arr.forEach(row => {
          const m = parseMonth(row.thang);
          if (!m) return;
          if (!map[m]) map[m] = { month: m, total_salary: 0, total_workdays: 0 };
          map[m].total_salary += Number((row.tong_thu_nhap || '0').toString().replace(/,/g, ''));
          map[m].total_workdays +=
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
      const curMap = groupByMonth(curData || []);
      const prevMap = groupByMonth(prevData || []);
      // Gộp dữ liệu cho chart
      const months = Array.from(new Set([...Object.keys(curMap), ...Object.keys(prevMap)].map(Number))).sort((a, b) => a - b);
      const chartData = months.map(m => ({
        month: m,
        salary: curMap[m]?.total_salary || 0,
        per_workday: curMap[m]?.total_workdays ? curMap[m].total_salary / curMap[m].total_workdays : null,
        per_workday_prev: prevMap[m]?.total_workdays ? prevMap[m].total_salary / prevMap[m].total_workdays : null,
      }));
      setSalaryMonthData(prev => ({ ...prev, [ma_nv]: chartData }));
    } catch (e) {
      setSalaryMonthData(prev => ({ ...prev, [ma_nv]: [] }));
    } finally {
      setSalaryMonthLoading(false);
    }
  };

  // Hàm lấy thông tin chứng chỉ hành nghề từ CCHN
  const fetchCchnDetail = async (ma_nv: string) => {
    setCchnLoading(true);
    try {
      const { data, error } = await supabase
        .from('CCHN')
        .select('*')
        .eq('ID', ma_nv)
        .limit(1);
      if (error) throw error;
      setCchnData(prev => ({ ...prev, [ma_nv]: data?.[0] || null }));
    } catch (e) {
      setCchnData(prev => ({ ...prev, [ma_nv]: null }));
    } finally {
      setCchnLoading(false);
    }
  };

  // Hàm lấy dữ liệu doanh thu theo tháng cho 1 bác sĩ
  const fetchRevenueMonthData = async (ma_nv: string) => {
    setRevenueMonthLoading(true);
    try {
      // Lấy tổng doanh thu từng tháng cho bác sĩ (tính sum cột TT2)
      const { data, error } = await supabase
        .from('DTBS')
        .select('Thang, TT2')
        .eq('ID', ma_nv);
      if (error) throw error;
      
      // Xử lý dữ liệu - gom nhóm theo tháng và tính tổng
      const parseMonth = (thang: string) => {
        const match = thang?.match(/Tháng\s*(\d+)/i);
        return match ? parseInt(match[1], 10) : null;
      };
      
      // Gom nhóm theo tháng và tính tổng TT2
      const monthGroups: Record<number, number> = {};
      (data || []).forEach(row => {
        const month = parseMonth(row.Thang);
        if (month !== null) {
          monthGroups[month] = (monthGroups[month] || 0) + Number(row.TT2 || 0);
        }
      });
      
      // Chuyển thành array và sắp xếp theo tháng
      const chartData = Object.entries(monthGroups)
        .map(([month, revenue]) => ({
          month: parseInt(month, 10),
          revenue: revenue
        }))
        .filter(item => item.revenue > 0)
        .sort((a, b) => a.month - b.month);
      
      setRevenueMonthData(prev => ({ ...prev, [ma_nv]: chartData }));
    } catch (e) {
      setRevenueMonthData(prev => ({ ...prev, [ma_nv]: [] }));
    } finally {
      setRevenueMonthLoading(false);
    }
  };

  // Sửa lại hàm fetch dịch vụ lấy đủ các cột
  const fetchTopServices = async (ma_nv: string) => {
    setTopServicesLoading(true);
    try {
      const { data, error } = await supabase
        .from('DTBS')
        .select(`
          "Loại DT",
          "Loại thực hiện",
          "Ten_dich_vu_chi_tiet",
          "SC",
          "TT2",
          "Thang"
        `)
        .eq('ID', ma_nv)
        .order('Thang', { ascending: false });
      
      if (error) throw error;
      
      // Gom nhóm 3 cấp
      const tree: TopServiceTree = {};
      (data || []).forEach(row => {
        const loaiDT = row["Loại DT"] || 'Không xác định';
        const loaiThucHien = row["Loại thực hiện"] || 'Không xác định';
        const tenDV = row.Ten_dich_vu_chi_tiet || 'Không xác định';
        const sc = Number(row.SC || 0);
        const tt2 = Number(row.TT2 || 0);
        if (!tree[loaiDT]) tree[loaiDT] = {};
        if (!tree[loaiDT][loaiThucHien]) tree[loaiDT][loaiThucHien] = {};
        if (!tree[loaiDT][loaiThucHien][tenDV]) {
          tree[loaiDT][loaiThucHien][tenDV] = { so_luong: 0, doanh_thu: 0 };
        }
        tree[loaiDT][loaiThucHien][tenDV].so_luong += sc;
        tree[loaiDT][loaiThucHien][tenDV].doanh_thu += tt2;
      });
      setTopServicesData(prev => ({ ...prev, [ma_nv]: tree }));
    } catch (e) {
      setTopServicesData(prev => ({ ...prev, [ma_nv]: {} }));
    } finally {
      setTopServicesLoading(false);
    }
  };

  // Hàm lấy tổng doanh thu năm 2025 cho tất cả bác sĩ từ function SQL
  const fetchTotalRevenue2025 = async () => {
    const { data, error } = await supabase.rpc('get_doctor_total_revenue_2025');
    if (error) throw error;
    // data: [{ ma_nv: '123', total_revenue: 1000000 }, ...]
    const revenueMap: Record<string, number> = {};
    (data || []).forEach((row: { ma_nv: string; total_revenue: number }) => {
      revenueMap[row.ma_nv] = Number(row.total_revenue || 0);
    });
    return revenueMap;
  };

  // Khi expand row thì fetch thêm dữ liệu lương tháng, CCHN và doanh thu
  const handleExpand = (ma_nv: string) => {
    if (expandedRow === ma_nv) {
      setExpandedRow(null);
    } else {
      setExpandedRow(ma_nv);
      if (!detailData[ma_nv]) fetchDoctorDetail(ma_nv);
      if (!salaryMonthData[ma_nv]) fetchSalaryMonthData(ma_nv);
      if (!cchnData[ma_nv]) fetchCchnDetail(ma_nv);
      if (!revenueMonthData[ma_nv]) fetchRevenueMonthData(ma_nv);
      if (!topServicesData[ma_nv]) fetchTopServices(ma_nv);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        // Lấy dữ liệu ranking (không lấy tổng doanh thu)
        const rankingResult = await supabase.rpc('get_doctor_salary_ranking_latest_year');
        if (rankingResult.error) throw rankingResult.error;
        // Lấy tổng doanh thu cho từng bác sĩ năm 2025
        const revenueMap = await fetchTotalRevenue2025();
        setData((rankingResult.data || []).map((row: any) => {
          const total_revenue = revenueMap[String(row.ma_nv)] || 0;
          const salary = row.total_salary !== null ? Number(row.total_salary) : 0;
          return {
          ma_nv: String(row.ma_nv),
          ho_ten: String(row.ho_ten),
          job_title: String(row.job_title),
            total_salary: salary,
          salary_per_workday: row.salary_per_workday !== null ? Number(row.salary_per_workday) : 0,
            total_revenue,
            salary_revenue_ratio:
              total_revenue > 0 && isFinite(salary / total_revenue)
                ? salary / total_revenue
                : 0,
          };
        }));
      } catch (e: any) {
        setError(e.message || 'Không thể tải dữ liệu ranking bác sĩ.');
        setData([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Tự động fetch CCHN cho tất cả bác sĩ khi có data mới
  useEffect(() => {
    if (data.length > 0) {
      data.forEach(row => {
        if (!cchnData[row.ma_nv]) fetchCchnDetail(row.ma_nv);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Lọc dữ liệu theo filter
  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Lọc họ tên
      if (filterName && !row.ho_ten.toLowerCase().includes(filterName.toLowerCase())) return false;
      // Lọc chuyên môn
      if (filterJobTitle && !row.job_title.toLowerCase().includes(filterJobTitle.toLowerCase())) return false;
      // Lọc tổng lương
      if (filterSalaryMin && row.total_salary < Number(filterSalaryMin)) return false;
      if (filterSalaryMax && row.total_salary > Number(filterSalaryMax)) return false;
      // Lọc lương/công
      if (filterPerWorkdayMin && row.salary_per_workday < Number(filterPerWorkdayMin)) return false;
      if (filterPerWorkdayMax && row.salary_per_workday > Number(filterPerWorkdayMax)) return false;
      // Lọc theo CCHN
      if (filterCchn === 'has' && (!cchnData[row.ma_nv] || Object.keys(cchnData[row.ma_nv] || {}).length === 0)) return false;
      if (filterCchn === 'none' && cchnData[row.ma_nv] && Object.keys(cchnData[row.ma_nv] || {}).length > 0) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filterName, filterJobTitle, filterSalaryMin, filterSalaryMax, filterPerWorkdayMin, filterPerWorkdayMax, filterCchn, cchnData]);

  const sortedData = useMemo(() => {
    const arr = [...filteredData];
    arr.sort((a, b) => {
      let vA: any = a[sortKey];
      let vB: any = b[sortKey];
      if (typeof vA === 'string' && typeof vB === 'string') {
        return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      if (typeof vA === 'number' && typeof vB === 'number') {
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      return 0;
    });
    return arr;
  }, [filteredData, sortKey, sortDir]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
  };
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(value);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Đặt chiều sort mặc định cho từng cột (số: desc, text: asc)
      if (
        key === 'total_salary' ||
        key === 'salary_per_workday' ||
        key === 'total_revenue' ||
        key === 'salary_revenue_ratio'
      ) {
        setSortDir('desc');
      } else {
        setSortDir('asc');
      }
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 text-primary inline-block ml-1" />;
    return <ArrowDown className="h-3 w-3 text-primary inline-block ml-1" />;
  };

  // Thêm hàm sort dữ liệu dịch vụ
  const getSortedServices = (services: TopServiceRow[]) => {
    return [...services].sort((a, b) => {
      if (serviceSortKey === 'ten_dich_vu') {
        return serviceSortDir === 'asc'
          ? a.ten_dich_vu.localeCompare(b.ten_dich_vu)
          : b.ten_dich_vu.localeCompare(a.ten_dich_vu);
      }
      const valueA = a[serviceSortKey];
      const valueB = b[serviceSortKey];
      return serviceSortDir === 'asc' ? valueA - valueB : valueB - valueA;
    });
  };

  // Hàm sort cho bảng dịch vụ
  const handleServiceSort = (key: ServiceSortKey) => {
    if (serviceSortKey === key) {
      setServiceSortDir(serviceSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setServiceSortKey(key);
      setServiceSortDir(key === 'ten_dich_vu' ? 'asc' : 'desc');
    }
  };

  // Hàm render icon sort cho bảng dịch vụ
  const renderServiceSortIcon = (key: ServiceSortKey) => {
    if (serviceSortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    if (serviceSortDir === 'asc') return <ArrowUp className="h-3 w-3 text-primary inline-block ml-1" />;
    return <ArrowDown className="h-3 w-3 text-primary inline-block ml-1" />;
  };

  // Hàm tính tổng doanh thu cho từng Loại DT
  const sumDoanhThuLoaiDT = (thMap: any) =>
    Object.values(thMap).reduce(
      (sum: number, dvObj: any) =>
        sum + Object.values(dvObj).reduce((s: number, dv: any) => s + dv.doanh_thu, 0),
      0
    );
  // Hàm tính tổng doanh thu cho từng Loại thực hiện
  const sumDoanhThuLoaiThucHien = (dvObj: any) =>
    Object.values(dvObj).reduce((sum: number, dv: any) => sum + dv.doanh_thu, 0);

  // Tính chiều cao tối đa cho 20 dòng (mỗi dòng ~40px, header ~44px)
  const maxTableHeight = 44 + 20 * 40;

  return (
    <Card className="flex-grow flex flex-col h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-md font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-primary inline-block" />
          Ranking các bác sĩ theo chỉ số
        </CardTitle>
        <CardDescription className="text-xs">
          Xếp hạng bác sĩ theo tổng lương và lương/công năm mới nhất. Chỉ tính bác sĩ có lương lớn hơn 0.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
        {/* Filter row */}
        <div className="mb-3 flex flex-wrap gap-2 items-end">
          <div className="flex flex-col">
            <label className="text-xs mb-1">Họ và tên</label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-xs min-w-[120px]"
              placeholder="Tìm theo tên..."
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">Chuyên môn</label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-xs min-w-[120px]"
              placeholder="Tìm theo chuyên môn..."
              value={filterJobTitle}
              onChange={e => setFilterJobTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">Tổng lương từ</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-xs min-w-[90px]"
              placeholder="Min"
              value={filterSalaryMin}
              onChange={e => setFilterSalaryMin(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">Tổng lương đến</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-xs min-w-[90px]"
              placeholder="Max"
              value={filterSalaryMax}
              onChange={e => setFilterSalaryMax(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">Lương/Công từ</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-xs min-w-[90px]"
              placeholder="Min"
              value={filterPerWorkdayMin}
              onChange={e => setFilterPerWorkdayMin(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">Lương/Công đến</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-xs min-w-[90px]"
              placeholder="Max"
              value={filterPerWorkdayMax}
              onChange={e => setFilterPerWorkdayMax(e.target.value)}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs mb-1">Chứng chỉ hành nghề</label>
            <select
              className="border rounded px-2 py-1 text-xs min-w-[120px]"
              value={filterCchn}
              onChange={e => setFilterCchn(e.target.value as 'all' | 'has' | 'none')}
            >
              <option value="all">Tất cả</option>
              <option value="has">Có CCHN</option>
              <option value="none">Không có CCHN</option>
            </select>
          </div>
        </div>
        <div className="flex-grow min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <p className="text-sm">Đang tải dữ liệu ranking...</p>
            </div>
          )}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertTriangle className="h-6 w-6 mb-1" />
              <p className="font-semibold text-sm">Lỗi Tải Dữ Liệu</p>
              <p className="text-xs text-center whitespace-pre-line">{error}</p>
            </div>
          )}
          {!isLoading && !error && data.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center py-4 text-sm">Không có dữ liệu ranking bác sĩ cho kỳ hiện tại.</p>
            </div>
          )}
          {!isLoading && !error && data.length > 0 && (
            <div className="border rounded-md" style={{ maxHeight: maxTableHeight, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'ma_nv' && 'font-bold')} onClick={() => handleSort('ma_nv')}>
                      Mã NV {renderSortIcon('ma_nv')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'ho_ten' && 'font-bold')} onClick={() => handleSort('ho_ten')}>
                      Họ và Tên {renderSortIcon('ho_ten')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'job_title' && 'font-bold')} onClick={() => handleSort('job_title')}>
                      Chuyên môn {renderSortIcon('job_title')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'total_salary' && 'font-bold')} onClick={() => handleSort('total_salary')}>
                      Tổng lương {renderSortIcon('total_salary')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'salary_per_workday' && 'font-bold')} onClick={() => handleSort('salary_per_workday')}>
                      Lương/Công {renderSortIcon('salary_per_workday')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'total_revenue' && 'font-bold')} onClick={() => handleSort('total_revenue')}>
                      Tổng doanh thu (từ 2025) {renderSortIcon('total_revenue')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'salary_revenue_ratio' && 'font-bold')} onClick={() => handleSort('salary_revenue_ratio')}>
                      % Lương/Doanh thu {renderSortIcon('salary_revenue_ratio')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody>
                    {sortedData.map((row, idx) => (
                      <React.Fragment key={row.ma_nv + row.job_title + idx}>
                        <TableRow className={idx < 3 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                        <TableCell className="w-8 text-xs py-1.5 px-2">
                            <button onClick={() => handleExpand(row.ma_nv)} className="focus:outline-none">
                              {expandedRow === row.ma_nv ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ma_nv}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_ten}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.job_title}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">{formatCurrency(row.total_salary)}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.salary_per_workday)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">{formatCurrency(row.total_revenue ?? 0)}</TableCell>
                        <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">
                          {row.salary_revenue_ratio && isFinite(row.salary_revenue_ratio)
                            ? (row.salary_revenue_ratio * 100).toFixed(1) + '%'
                            : '0%'}
                        </TableCell>
                        </TableRow>
                        {expandedRow === row.ma_nv && (
                          <TableRow>
                          <TableCell colSpan={7} className="bg-muted px-4 py-2 animate-slideDown">
                              {/* Section 1: Thông tin hành chính */}
                              <div className="mb-2">
                                <div className="font-semibold mb-1 text-sm">Thông tin hành chính</div>
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
                              {/* Section 1.1: Chứng chỉ hành nghề */}
                              <div className="mb-2">
                                <div className="font-semibold mb-1 text-sm">Chứng chỉ hành nghề</div>
                                {cchnLoading && !cchnData[row.ma_nv] && (
                                  <div className="text-xs text-muted-foreground">Đang tải thông tin CCHN...</div>
                                )}
                                {cchnData[row.ma_nv] && (
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-xs">
                                    {[
                                      { label: 'Trường đào tạo', key: 'Trường đào tạo' },
                                      { label: 'Chuyên ngành', key: 'Chuyên ngành' },
                                      { label: 'Số CCHN', key: 'Số CCHN' },
                                      { label: 'Ngày cấp', key: 'Ngày cấp' },
                                      { label: 'Phạm vi hoạt động chuyên môn', key: 'Phạm vi hoạt động chuyên môn' },
                                      { label: 'Nơi đăng kí Hành nghề', key: 'Nơi đăng kí Hành nghề' },
                                    ].map(field => (
                                      <div key={field.key} className="flex gap-1">
                                        <span className="font-semibold whitespace-nowrap">{field.label}:</span>
                                        <span className="truncate">{cchnData[row.ma_nv][field.key] || '-'}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {!cchnLoading && !cchnData[row.ma_nv] && (
                                  <div className="text-xs text-destructive">Không tìm thấy thông tin CCHN.</div>
                                )}
                              </div>
                              {/* Section 2: Lương & lương/công theo tháng */}
                              <div>
                                <div className="font-semibold mb-1 text-sm">Lương & lương/công theo tháng</div>
                                {salaryMonthLoading && (!salaryMonthData[row.ma_nv] || salaryMonthData[row.ma_nv].length === 0) && (
                                  <div className="text-xs text-muted-foreground">Đang tải dữ liệu lương theo tháng...</div>
                                )}
                                {salaryMonthData[row.ma_nv] && salaryMonthData[row.ma_nv].length > 0 && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Bar chart: Lương theo tháng */}
                                    <div>
                                      <div className="text-xs font-semibold mb-1">Lương theo tháng (năm hiện tại)</div>
                                      <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={salaryMonthData[row.ma_nv]}>
                                          <XAxis dataKey="month" tickFormatter={m => `Th${m}`} fontSize={11} />
                                          {/* Không có YAxis */}
                                          <Tooltip formatter={v => compactNumber(Number(v))} labelFormatter={m => `Tháng ${m}`} />
                                          <Bar dataKey="salary" fill="#3b82f6" name="Lương">
                                            <LabelList dataKey="salary" position="top" formatter={compactNumber} fontSize={11} />
                                          </Bar>
                                        </BarChart>
                                      </ResponsiveContainer>
                                    </div>
                                    {/* Line chart: Lương/công theo tháng */}
                                    <div>
                                      <div className="text-xs font-semibold mb-1">Lương/Công theo tháng (so sánh 2 năm)</div>
                                      <ResponsiveContainer width="100%" height={180}>
                                        <LineChart data={salaryMonthData[row.ma_nv]}>
                                          <XAxis dataKey="month" tickFormatter={m => `Th${m}`} fontSize={11} />
                                          {/* Không có YAxis */}
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
                                {salaryMonthData[row.ma_nv] && salaryMonthData[row.ma_nv].length === 0 && !salaryMonthLoading && (
                                  <div className="text-xs text-destructive">Không có dữ liệu lương theo tháng.</div>
                                )}
                              </div>
                              {/* Section 3: Doanh thu theo tháng */}
                              <div className="mb-2">
                                <div className="font-semibold mb-1 text-sm">Doanh thu theo tháng</div>
                                {revenueMonthLoading && (!revenueMonthData[row.ma_nv] || revenueMonthData[row.ma_nv].length === 0) && (
                                  <div className="text-xs text-muted-foreground">Đang tải dữ liệu doanh thu theo tháng...</div>
                                )}
                                {revenueMonthData[row.ma_nv] && revenueMonthData[row.ma_nv].length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold mb-1">Doanh thu theo tháng</div>
                                    <ResponsiveContainer width="100%" height={180}>
                                      <LineChart data={revenueMonthData[row.ma_nv]}>
                                        <XAxis dataKey="month" tickFormatter={m => `Th${m}`} fontSize={11} />
                                        <Tooltip formatter={v => compactNumber(Number(v))} labelFormatter={m => `Tháng ${m}`} />
                                        <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Doanh thu" dot={{ r: 3 }} activeDot={{ r: 5 }}>
                                          <LabelList
                                            dataKey="revenue"
                                            position="top"
                                            content={({ x, y, value }) =>
                                              value !== undefined && value !== null && y !== undefined ? (
                                                <text x={x} y={(y as number) - 8} fontSize={11} textAnchor="middle" fill="#10b981">
                                                  {compactNumber(Number(value))}
                                                </text>
                                              ) : null
                                            }
                                          />
                                        </Line>
                                      </LineChart>
                                    </ResponsiveContainer>
                                  </div>
                                )}
                                {revenueMonthData[row.ma_nv] && revenueMonthData[row.ma_nv].length === 0 && !revenueMonthLoading && (
                                  <div className="text-xs text-destructive">Không có dữ liệu doanh thu theo tháng.</div>
                                )}
                              </div>
                            {/* Section 4: Danh sách dịch vụ đã thực hiện dạng tree 3 cấp */}
                            <div className="mb-2 border border-gray-200 rounded p-2">
                              <div className="font-semibold mb-1 text-sm">Danh sách dịch vụ đã thực hiện</div>
                              {topServicesLoading && !topServicesData[row.ma_nv] && (
                                <div className="text-xs text-muted-foreground">Đang tải dữ liệu dịch vụ...</div>
                              )}
                              {topServicesData[row.ma_nv] && Object.keys(topServicesData[row.ma_nv]).length > 0 && (
                                <div className="overflow-x-auto">
                                  <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                                    <table className="w-full text-xs border-collapse">
                                      <thead className="sticky top-0 bg-gray-50">
                                        <tr className="border-b">
                                          <th className="py-1 px-2 text-left font-medium">Loại DT</th>
                                          <th className="py-1 px-2 text-left font-medium">Loại thực hiện</th>
                                          <th className="py-1 px-2 text-left font-medium">Tên dịch vụ</th>
                                          <th className="py-1 px-2 text-right font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleServiceSort('so_luong')}>
                                            Số lượng {renderServiceSortIcon('so_luong')}
                                          </th>
                                          <th className="py-1 px-2 text-right font-medium cursor-pointer hover:bg-gray-100" onClick={() => handleServiceSort('doanh_thu')}>
                                            Doanh thu {renderServiceSortIcon('doanh_thu')}
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Object.entries(topServicesData[row.ma_nv]).map(([loaiDT, thMap]) => (
                                          <React.Fragment key={loaiDT}>
                                            <tr className="border-b bg-gray-100">
                                              <td className="py-1 px-2 font-semibold" colSpan={5}>
                                                <button onClick={() => toggleLoaiDT(loaiDT)} className="mr-2 text-primary font-bold">
                                                  {expandedLoaiDT[loaiDT] ? '-' : '+'}
                                                </button>
                                                {loaiDT}
                                                <span className="text-xs text-muted-foreground ml-2">(Tổng doanh thu: {formatCurrency(sumDoanhThuLoaiDT(thMap))})</span>
                                              </td>
                                            </tr>
                                            {expandedLoaiDT[loaiDT] && Object.entries(thMap).map(([loaiThucHien, dvObj]) => (
                                              <React.Fragment key={loaiThucHien}>
                                                <tr className="border-b bg-gray-50">
                                                  <td></td>
                                                  <td className="py-1 px-2 font-semibold" colSpan={4}>
                                                    <button onClick={() => toggleLoaiThucHien(loaiDT, loaiThucHien)} className="mr-2 text-primary font-bold">
                                                      {expandedLoaiThucHien[`${loaiDT}__${loaiThucHien}`] ? '-' : '+'}
                                                    </button>
                                                    {loaiThucHien}
                                                    <span className="text-xs text-muted-foreground ml-2">(Tổng doanh thu: {formatCurrency(sumDoanhThuLoaiThucHien(dvObj))})</span>
                                                  </td>
                                                </tr>
                                                {expandedLoaiThucHien[`${loaiDT}__${loaiThucHien}`] &&
                                                  getSortedServices(
                                                    Object.entries(dvObj).map(([ten_dich_vu, val]) => ({ ten_dich_vu, so_luong: val.so_luong, doanh_thu: val.doanh_thu }))
                                                  ).map((service) => (
                                                    <tr key={service.ten_dich_vu} className="border-b border-gray-100 hover:bg-gray-50">
                                                      <td></td>
                                                      <td></td>
                                                      <td className="py-1 px-2">{service.ten_dich_vu}</td>
                                                      <td className="py-1 px-2 text-right">{service.so_luong}</td>
                                                      <td className="py-1 px-2 text-right">{formatCurrency(service.doanh_thu)}</td>
                                                    </tr>
                                                  ))}
                                              </React.Fragment>
                                            ))}
                                          </React.Fragment>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {!topServicesLoading && (!topServicesData[row.ma_nv] || Object.keys(topServicesData[row.ma_nv]).length === 0) && (
                                <div className="text-xs text-destructive">Không có dữ liệu dịch vụ.</div>
                              )}
                            </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 