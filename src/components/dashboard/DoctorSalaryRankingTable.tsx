import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, AlertTriangle, BarChart3, ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, LineChart, Line, XAxis, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

interface DoctorRankingRow {
  ma_nv: string;
  ho_ten: string;
  job_title: string;
  total_salary: number;
  salary_per_workday: number;
}

type SortKey = 'total_salary' | 'salary_per_workday' | 'ma_nv' | 'ho_ten' | 'job_title';

type SortDir = 'asc' | 'desc';

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

  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<Record<string, any>>({});
  const [salaryMonthData, setSalaryMonthData] = useState<Record<string, any[]>>({});
  const [salaryMonthLoading, setSalaryMonthLoading] = useState(false);

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

  // Khi expand row thì fetch thêm dữ liệu lương tháng
  const handleExpand = (ma_nv: string) => {
    if (expandedRow === ma_nv) {
      setExpandedRow(null);
    } else {
      setExpandedRow(ma_nv);
      if (!detailData[ma_nv]) fetchDoctorDetail(ma_nv);
      if (!salaryMonthData[ma_nv]) fetchSalaryMonthData(ma_nv);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_doctor_salary_ranking_latest_year');
        if (error) throw error;
        setData((data || []).map((row: any) => ({
          ma_nv: String(row.ma_nv),
          ho_ten: String(row.ho_ten),
          job_title: String(row.job_title),
          total_salary: row.total_salary !== null ? Number(row.total_salary) : 0,
          salary_per_workday: row.salary_per_workday !== null ? Number(row.salary_per_workday) : 0,
        })));
      } catch (e: any) {
        setError(e.message || 'Không thể tải dữ liệu ranking bác sĩ.');
        setData([]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

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
      return true;
    });
  }, [data, filterName, filterJobTitle, filterSalaryMin, filterSalaryMax, filterPerWorkdayMin, filterPerWorkdayMax]);

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

  // Hàm rút gọn số: 2.000.000 => 2tr
  const compactNumber = (value: number) => {
    if (value == null) return '';
    if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'tỷ';
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr';
    if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
    return value.toString();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'total_salary' || key === 'salary_per_workday' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 text-primary inline-block ml-1" />;
    return <ArrowDown className="h-3 w-3 text-primary inline-block ml-1" />;
  };

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
            <div className="border rounded-md" style={{ maxHeight: maxTableHeight, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'ma_nv' && 'font-bold')} onClick={() => handleSort('ma_nv')}>Mã NV</TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'ho_ten' && 'font-bold')} onClick={() => handleSort('ho_ten')}>Họ và Tên</TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'job_title' && 'font-bold')} onClick={() => handleSort('job_title')}>Chuyên môn</TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'total_salary' && 'font-bold')} onClick={() => handleSort('total_salary')}>
                      Tổng lương {renderSortIcon('total_salary')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'salary_per_workday' && 'font-bold')} onClick={() => handleSort('salary_per_workday')}>
                      Lương/Công {renderSortIcon('salary_per_workday')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
              </Table>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <Table>
                  <TableBody>
                    {sortedData.map((row, idx) => (
                      <React.Fragment key={row.ma_nv + row.job_title + idx}>
                        <TableRow className={idx < 3 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                          <TableCell className="text-xs py-1.5 px-2">
                            <button onClick={() => handleExpand(row.ma_nv)} className="focus:outline-none">
                              {expandedRow === row.ma_nv ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </TableCell>
                          <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ma_nv}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_ten}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.job_title}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">{formatCurrency(row.total_salary)}</TableCell>
                          <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.salary_per_workday)}</TableCell>
                        </TableRow>
                        {expandedRow === row.ma_nv && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-muted px-4 py-2 animate-slideDown">
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
                                          <Line type="monotone" dataKey="per_workday" stroke="#3b82f6" name="Năm nay" dot={{ r: 3 }} activeDot={{ r: 5 }} label={({ x, y, value }) => value ? <text x={x} y={y - 8} fontSize={11} textAnchor="middle" fill="#3b82f6">{compactNumber(Number(value))}</text> : null} />
                                          <Line type="monotone" dataKey="per_workday_prev" stroke="#f59e42" name="Năm ngoái" dot={{ r: 3 }} activeDot={{ r: 5 }} label={({ x, y, value }) => value ? <text x={x} y={y - 8} fontSize={11} textAnchor="middle" fill="#f59e42">{compactNumber(Number(value))}</text> : null} />
                                        </LineChart>
                                      </ResponsiveContainer>
                                    </div>
                                  </div>
                                )}
                                {salaryMonthData[row.ma_nv] && salaryMonthData[row.ma_nv].length === 0 && !salaryMonthLoading && (
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
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 