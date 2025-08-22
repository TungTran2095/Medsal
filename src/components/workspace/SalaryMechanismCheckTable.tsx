"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface SalaryMechanismData {
  id: string;
  ho_va_ten: string;
  don_vi: string;
  luong_co_ban: number;
  uu_dai_nghe: number;
  xang_xe: number;
  dien_thoai: number;
  thuong_hieu_suat: number;
  gross_theo_co_che: number;
  doanh_thu_chi_tieu: number;
  doanh_thu_thuc_hien: number;
  phan_tram_hoan_thanh: number;
  thuong_hieu_suat_theo_co_che: number;
  luong_gross_thuc_te: number;
  luong_gross_don_vi_de_xuat: number;
  chenh_lech_co_che: number;
}

// Định nghĩa interface cho dữ liệu Doanh_thu
interface DoanhThuData {
  'Tên Đơn vị': string;
  'Tháng pro': string;  // Format: "Tháng 01-2025", "Tháng 02-2025", etc.
  'Chỉ tiêu': string | number;
  'Kỳ báo cáo': string | number;
}

interface SalaryMechanismCheckTableProps {
  selectedYear?: number | null;
  selectedMonths?: number[] | null;
}

type SortKey = 'id' | 'ho_va_ten' | 'don_vi' | 'luong_co_ban' | 'uu_dai_nghe' | 'xang_xe' | 'dien_thoai' | 'thuong_hieu_suat' | 'gross_theo_co_che' | 'doanh_thu_chi_tieu' | 'doanh_thu_thuc_hien' | 'phan_tram_hoan_thanh' | 'thuong_hieu_suat_theo_co_che' | 'luong_gross_thuc_te' | 'luong_gross_don_vi_de_xuat' | 'chenh_lech_co_che';
type SortDir = 'asc' | 'desc';

export default function SalaryMechanismCheckTable({ 
  selectedYear = 2024, 
  selectedMonths = [1] 
}: SalaryMechanismCheckTableProps) {
  const [data, setData] = useState<SalaryMechanismData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(1);
  const [selectedYearState, setSelectedYearState] = useState<number>(2024);
  const { toast } = useToast();

  // Thêm state cho sorting và filtering
  const [sortKey, setSortKey] = useState<SortKey>('chenh_lech_co_che');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterName, setFilterName] = useState('');
  const [filterDonVi, setFilterDonVi] = useState('');
  const [filterChenhLechMin, setFilterChenhLechMin] = useState('');
  const [filterChenhLechMax, setFilterChenhLechMax] = useState('');

  const months = [
    { value: 1, label: "Tháng 01" },
    { value: 2, label: "Tháng 02" },
    { value: 3, label: "Tháng 03" },
    { value: 4, label: "Tháng 04" },
    { value: 5, label: "Tháng 05" },
    { value: 6, label: "Tháng 06" },
    { value: 7, label: "Tháng 07" },
    { value: 8, label: "Tháng 08" },
    { value: 9, label: "Tháng 09" },
    { value: 10, label: "Tháng 10" },
    { value: 11, label: "Tháng 11" },
    { value: 12, label: "Tháng 12" }
  ];

  const years = [2024, 2025];

  useEffect(() => {
    if (selectedYear) setSelectedYearState(selectedYear);
    if (selectedMonths && selectedMonths.length > 0) setSelectedMonth(selectedMonths[0]);
  }, [selectedYear, selectedMonths]);

  // Lọc dữ liệu theo filter
  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Lọc họ tên
      if (filterName && !row.ho_va_ten.toLowerCase().includes(filterName.toLowerCase())) return false;
      // Lọc đơn vị
      if (filterDonVi && !row.don_vi.toLowerCase().includes(filterDonVi.toLowerCase())) return false;
      // Lọc chênh lệch cơ chế
      if (filterChenhLechMin && row.chenh_lech_co_che < Number(filterChenhLechMin)) return false;
      if (filterChenhLechMax && row.chenh_lech_co_che > Number(filterChenhLechMax)) return false;
      return true;
    });
  }, [data, filterName, filterDonVi, filterChenhLechMin, filterChenhLechMax]);

  // Sắp xếp dữ liệu
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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      // Đặt chiều sort mặc định cho từng cột (số: desc, text: asc)
      if (
        key === 'luong_co_ban' ||
        key === 'uu_dai_nghe' ||
        key === 'xang_xe' ||
        key === 'dien_thoai' ||
        key === 'thuong_hieu_suat' ||
        key === 'gross_theo_co_che' ||
        key === 'doanh_thu_chi_tieu' ||
        key === 'doanh_thu_thuc_hien' ||
        key === 'phan_tram_hoan_thanh' ||
        key === 'thuong_hieu_suat_theo_co_che' ||
        key === 'luong_gross_thuc_te' ||
        key === 'luong_gross_don_vi_de_xuat' ||
        key === 'chenh_lech_co_che'
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

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('Bắt đầu fetch dữ liệu...');
      console.log('Tháng được chọn:', selectedMonth, 'Năm được chọn:', selectedYearState);
      
      // Kiểm tra xem bảng co_che_luong có tồn tại không
      console.log('Đang kiểm tra bảng co_che_luong...');
             const { data: coCheLuongData, error: coCheError } = await supabase
         .from('co_che_luong')
         .select('ID, Don_vi, 1_luong_co_ban, 2_uu_dai_nghe, 3_xang_xe, 4_dien_thoai, 5_thuong_hieu_suat, Gross')
         .in('Loai_co_che', ['GĐ tỉnh', 'GĐ ĐVTV']);

      if (coCheError) {
        console.error('Lỗi khi lấy dữ liệu co_che_luong:', coCheError);
        
        // Kiểm tra xem có phải lỗi bảng không tồn tại không
        if (coCheError.message && coCheError.message.includes('does not exist')) {
          toast({
            title: "Lỗi",
            description: "Bảng 'co_che_luong' không tồn tại. Vui lòng kiểm tra cơ sở dữ liệu.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Lỗi",
            description: `Lỗi khi truy cập bảng co_che_luong: ${coCheError.message}`,
            variant: "destructive",
          });
        }
        setData([]);
        return;
      }

      console.log('Dữ liệu co_che_luong:', coCheLuongData);

             if (!coCheLuongData || coCheLuongData.length === 0) {
         console.log('Không có dữ liệu co_che_luong cho GĐ tỉnh hoặc GĐ ĐVTV');
         toast({
           title: "Thông báo",
           description: "Không có dữ liệu cơ chế lương cho Giám đốc tỉnh hoặc Giám đốc ĐVTV trong hệ thống.",
           variant: "default",
         });
         setData([]);
         return;
       }

      // Lấy thông tin nhân viên từ MS_CBNV
      const employeeIds = coCheLuongData.map(item => item.ID);
      console.log('Employee IDs from co_che_luong:', employeeIds);
      console.log('Employee IDs types:', employeeIds.map(id => typeof id));
      
      console.log('Đang lấy dữ liệu từ bảng MS_CBNV...');
      const { data: msCbnvData, error: msCbnvError } = await supabase
        .from('MS_CBNV')
        .select('"Mã nhân viên", "Họ và tên"')
        .in('"Mã nhân viên"', employeeIds);

      if (msCbnvError) {
        console.error('Lỗi khi lấy dữ liệu MS_CBNV:', msCbnvError);
        
        if (msCbnvError.message && msCbnvError.message.includes('does not exist')) {
          toast({
            title: "Lỗi",
            description: "Bảng 'MS_CBNV' không tồn tại. Vui lòng kiểm tra cơ sở dữ liệu.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Lỗi",
            description: `Lỗi khi truy cập bảng MS_CBNV: ${msCbnvError.message}`,
            variant: "destructive",
          });
        }
        setData([]);
        return;
      }

      console.log('Dữ liệu MS_CBNV:', msCbnvData);
      console.log('MS_CBNV sample record:', msCbnvData?.[0]);

      // Tạo map để join dữ liệu - cải thiện logic join
      const employeeMap = new Map();
      msCbnvData?.forEach(emp => {
        // Đảm bảo cả key và value đều được xử lý đúng
        const maNhanVien = emp['Mã nhân viên'];
        const hoVaTen = emp['Họ và tên'];
        
        console.log(`Raw MS_CBNV record:`, emp);
        console.log(`Mã nhân viên: ${maNhanVien} (type: ${typeof maNhanVien})`);
        console.log(`Họ và tên: ${hoVaTen} (type: ${typeof hoVaTen})`);
        
        if (maNhanVien && hoVaTen) {
          const key = maNhanVien.toString();
          const value = hoVaTen.toString();
          employeeMap.set(key, value);
          console.log(`Added to map: ${key} -> ${value}`);
        } else {
          console.warn(`Skipping record with missing data:`, emp);
        }
      });



      console.log('Employee map size:', employeeMap.size);
      console.log('Employee map keys:', Array.from(employeeMap.keys()));
      console.log('Employee map values:', Array.from(employeeMap.values()));

             // Lấy dữ liệu doanh thu chỉ tiêu và thực hiện
       console.log('Đang lấy dữ liệu từ bảng Doanh_thu...');
       console.log('Filter criteria: Tháng=', selectedMonth, 'Năm=', selectedYearState);
       
       let doanhThuData: DoanhThuData[] | null = null;
       try {
         console.log('Thực hiện truy vấn Supabase cho bảng Doanh_thu...');
         
                   // Thử lấy dữ liệu với filter chính xác
          console.log('Filter criteria - selectedYearState:', selectedYearState, 'type:', typeof selectedYearState);
          console.log('Filter criteria - selectedMonth:', selectedMonth, 'type:', typeof selectedMonth);
          
          let { data, error } = await supabase
            .from('Doanh_thu')
            .select('"Tên Đơn vị", "Tháng pro", "Chỉ tiêu", "Kỳ báo cáo"')
            .eq('"Tháng pro"', `Tháng ${selectedMonth.toString().padStart(2, '0')}-${selectedYearState}`);
         
         console.log('Kết quả truy vấn Doanh_thu (với filter):', { data, error });
         
         if (error) {
           console.error('Lỗi khi lấy dữ liệu Doanh_thu:', error);
           if (error.message && error.message.includes('does not exist')) {
             console.log('Bảng Doanh_thu không tồn tại, tiếp tục với dữ liệu rỗng');
           }
         } else {
           doanhThuData = data;
           console.log('Dữ liệu Doanh_thu đã lấy thành công, số lượng:', doanhThuData?.length || 0);
         }
         
         // Nếu không có dữ liệu, thử lấy tất cả để debug
         if (!doanhThuData || doanhThuData.length === 0) {
           console.log('Không có dữ liệu với filter, thử lấy tất cả để debug...');
           const { data: allData, error: allError } = await supabase
             .from('Doanh_thu')
             .select('"Tên Đơn vị", "Tháng pro", "Chỉ tiêu", "Kỳ báo cáo"')
             .limit(10);
           
           if (!allError && allData && allData.length > 0) {
             console.log('Dữ liệu Doanh_thu (tất cả):', allData);
             console.log('Cấu trúc dữ liệu:', {
               'Tên Đơn vị type': typeof allData[0]['Tên Đơn vị'],
               'Tháng pro type': typeof allData[0]['Tháng pro'],
               'Chỉ tiêu type': typeof allData[0]['Chỉ tiêu'],
               'Kỳ báo cáo type': typeof allData[0]['Kỳ báo cáo']
             });
             
                           // Kiểm tra xem có dữ liệu cho tháng/năm được chọn không
              console.log('=== DEBUG FILTER THỦ CÔNG ===');
              console.log('selectedMonth:', selectedMonth, 'type:', typeof selectedMonth);
              console.log('selectedYearState:', selectedYearState, 'type:', typeof selectedYearState);
              
                             allData.forEach((item, index) => {
                 const thangPro = item['Tháng pro'];
                 // Parse format "Tháng 01-2025" -> tháng: 01, năm: 2025
                 const thangMatch = thangPro ? thangPro.match(/Tháng\s*(\d+)-(\d+)/) : null;
                 const thangNumber = thangMatch ? Number(thangMatch[1]) : 0;
                 const namNumber = thangMatch ? Number(thangMatch[2]) : 0;
                 
                 console.log(`Item ${index}: Tháng pro=${thangPro} (${typeof thangPro}) -> Tháng: ${thangNumber}, Năm: ${namNumber}`);
                 console.log(`  Match tháng: ${thangNumber} === ${selectedMonth} = ${thangNumber === selectedMonth}`);
                 console.log(`  Match năm: ${namNumber} === ${selectedYearState} = ${namNumber === selectedYearState}`);
               });
               
               const filteredData = allData.filter(item => {
                 const thangPro = item['Tháng pro'];
                 if (!thangPro) return false;
                 const thangMatch = thangPro.match(/Tháng\s*(\d+)-(\d+)/);
                 if (!thangMatch) return false;
                 const thangNumber = Number(thangMatch[1]);
                 const namNumber = Number(thangMatch[2]);
                 return thangNumber === selectedMonth && namNumber === selectedYearState;
               });
              console.log(`Dữ liệu sau khi filter thủ công: ${filteredData.length} bản ghi`);
              
              if (filteredData.length > 0) {
                doanhThuData = filteredData;
                console.log('Đã sử dụng dữ liệu filter thủ công');
              }
           }
         }
       } catch (error) {
         console.error('Exception khi truy cập bảng Doanh_thu:', error);
         console.log('Không thể truy cập bảng Doanh_thu, tiếp tục với dữ liệu rỗng');
       }

      console.log('Dữ liệu Doanh_thu cuối cùng:', doanhThuData);
      if (doanhThuData && doanhThuData.length > 0) {
        console.log('Các đơn vị trong Doanh_thu:', doanhThuData.map((dt: DoanhThuData) => dt['Tên Đơn vị']));
        console.log('Các tháng pro trong Doanh_thu:', doanhThuData.map((dt: DoanhThuData) => dt['Tháng pro']));
        console.log('Sample record Doanh_thu:', doanhThuData[0]);
        
        // Debug: So sánh tên đơn vị giữa hai bảng
        const donViTrongDoanhThu = [...new Set(doanhThuData.map((dt: DoanhThuData) => dt['Tên Đơn vị']))];
        const donViTrongCoCheLuong = [...new Set(coCheLuongData.map(item => item.Don_vi))];
        
        console.log('=== DEBUG: SO SÁNH TÊN ĐƠN VỊ ===');
        console.log('Đơn vị trong Doanh_thu:', donViTrongDoanhThu);
        console.log('Đơn vị trong co_che_luong:', donViTrongCoCheLuong);
        
        // Tìm các đơn vị có trong co_che_luong nhưng không có trong Doanh_thu
        const donViKhongCoTrongDoanhThu = donViTrongCoCheLuong.filter(donVi => !donViTrongDoanhThu.includes(donVi));
        console.log('Đơn vị có trong co_che_luong nhưng không có trong Doanh_thu:', donViKhongCoTrongDoanhThu);
        
        // Tìm các đơn vị có trong Doanh_thu nhưng không có trong co_che_luong
        const donViKhongCoTrongCoCheLuong = donViTrongDoanhThu.filter(donVi => !donViTrongCoCheLuong.includes(donVi));
        console.log('Đơn vị có trong Doanh_thu nhưng không có trong co_che_luong:', donViKhongCoTrongCoCheLuong);
        
        // Kiểm tra từng đơn vị trong co_che_luong
        coCheLuongData.forEach(item => {
          const donVi = item.Don_vi;
          const coTrongDoanhThu = donViTrongDoanhThu.includes(donVi);
          console.log(`Đơn vị "${donVi}" có trong Doanh_thu: ${coTrongDoanhThu}`);
          
                     if (coTrongDoanhThu) {
             // Sử dụng "Tháng pro" để so sánh chính xác
             const donViData = doanhThuData.filter((dt: DoanhThuData) => {
               if (dt['Tên Đơn vị'] !== donVi) return false;
               const thangPro = dt['Tháng pro'];
               if (!thangPro || typeof thangPro !== 'string') return false;
               const thangMatch = thangPro.match(/Tháng\s*(\d+)-(\d+)/);
               if (!thangMatch) return false;
               const thangNumber = parseInt(thangMatch[1], 10);
               const namNumber = parseInt(thangMatch[2], 10);
               return thangNumber === selectedMonth && namNumber === selectedYearState;
             });
             console.log(`  - Số bản ghi Doanh_thu cho "${donVi}": ${donViData.length}`);
             if (donViData.length > 0) {
               console.log(`  - Sample data:`, donViData[0]);
             }
           }
        });
        console.log('=== KẾT THÚC DEBUG ===');
      }
      console.log('Các đơn vị trong co_che_luong:', coCheLuongData.map(item => item.Don_vi));
      
      // Kiểm tra xem có dữ liệu doanh thu không
      if (!doanhThuData || doanhThuData.length === 0) {
        console.warn('Không có dữ liệu Doanh_thu cho tháng', selectedMonth, 'năm', selectedYearState);
        console.warn('Có thể bảng Doanh_thu không tồn tại hoặc không có dữ liệu cho kỳ này');
        
        // Thử kiểm tra xem có bảng nào tương tự không
        console.log('Đang kiểm tra các bảng có thể chứa dữ liệu doanh thu...');
        try {
          // Thử lấy tất cả dữ liệu từ bảng Doanh_thu (không filter)
          const { data: allData, error: allError } = await supabase
            .from('Doanh_thu')
            .select('*')
            .limit(5);
          
          if (allError) {
            console.error('Lỗi khi lấy tất cả dữ liệu Doanh_thu:', allError);
          } else {
            console.log('Có thể lấy dữ liệu Doanh_thu (không filter):', allData);
            if (allData && allData.length > 0) {
              console.log('Cấu trúc bảng Doanh_thu:', Object.keys(allData[0]));
            }
          }
          
          // Thử kiểm tra một số bảng có thể chứa dữ liệu doanh thu
          const possibleTables = ['Doanh_thu', 'DoanhThu', 'doanhthu', 'chi_tieu', 'Chi_tieu', 'revenue', 'Revenue'];
          for (const tableName of possibleTables) {
            try {
              console.log(`Thử kiểm tra bảng: ${tableName}`);
              const { data: testData, error: testError } = await supabase
                .from(tableName)
                .select('*')
                .limit(1);
              
              if (!testError && testData && testData.length > 0) {
                console.log(`Bảng ${tableName} tồn tại và có dữ liệu:`, testData[0]);
                console.log(`Cấu trúc bảng ${tableName}:`, Object.keys(testData[0]));
              }
            } catch (e) {
              console.log(`Bảng ${tableName} không tồn tại hoặc không thể truy cập`);
            }
          }
        } catch (e) {
          console.log('Không thể kiểm tra cấu trúc bảng Doanh_thu:', e);
        }
      }

             // Lấy dữ liệu lương từ bảng fulltime - sử dụng cách tương tự như DetailedSalaryTable
       console.log('Đang lấy dữ liệu từ bảng Fulltime...');
       let fulltimeData = null;
       try {
         // Lấy dữ liệu Fulltime cho từng nhân viên cụ thể trong co_che_luong
         // Chuyển đổi ID từ text sang int để khớp với ma_nhan_vien (int8)
         const employeeIds = coCheLuongData
           .map(item => {
             const id = item.ID;
             if (id) {
               // Thử chuyển đổi text sang int
               const numericId = parseInt(id, 10);
               if (!isNaN(numericId)) {
                 return numericId;
               } else {
                 console.warn(`Không thể chuyển đổi ID '${id}' thành số nguyên`);
                 return null;
               }
             }
             return null;
           })
           .filter(Boolean);
         
         console.log('Employee IDs đã chuyển đổi sang int:', employeeIds);
         console.log('Employee IDs types sau khi chuyển đổi:', employeeIds.map(id => typeof id));
         
         if (employeeIds.length > 0) {
           // Lấy dữ liệu Fulltime cho các nhân viên cụ thể
           const { data, error } = await supabase
             .from('Fulltime')
             .select('ma_nhan_vien, tong_thu_nhap, thang, nam')
             .in('ma_nhan_vien', employeeIds)
             .eq('nam', selectedYearState);
          
          if (error) {
            console.error('Lỗi khi lấy dữ liệu Fulltime:', error);
            if (error.message && error.message.includes('does not exist')) {
              console.log('Bảng Fulltime không tồn tại, tiếp tục với dữ liệu rỗng');
            }
          } else {
            // Lọc dữ liệu theo tháng được chọn (xử lý cột thang dạng text)
            fulltimeData = data?.filter(item => {
              if (!item.thang) return false;
              // Sử dụng cách parse giống như DetailedSalaryTable
              const thangNumber = parseInt((item.thang || '').replace(/\D/g, ''), 10);
              return thangNumber === selectedMonth;
            }) || [];
            
            console.log('Dữ liệu Fulltime sau khi lọc theo tháng:', fulltimeData);
          }
        } else {
          console.warn('Không có employee IDs để tìm trong Fulltime');
        }
      } catch (error) {
        console.log('Không thể truy cập bảng Fulltime, tiếp tục với dữ liệu rỗng:', error);
      }

      console.log('Dữ liệu Fulltime cuối cùng:', fulltimeData);

             // Debug: Kiểm tra sự khớp giữa các bảng
       console.log('=== DEBUG: KIỂM TRA SỰ KHỚP GIỮA CÁC BẢNG ===');
       console.log('Các mã nhân viên trong co_che_luong (text):', coCheLuongData.map(item => item.ID));
       console.log('Các mã nhân viên trong MS_CBNV:', msCbnvData?.map(emp => emp['Mã nhân viên']));
       console.log('Các mã nhân viên trong Fulltime (int):', fulltimeData?.map(item => item.ma_nhan_vien));
       
       // Chuyển đổi ID từ co_che_luong sang int để so sánh với Fulltime
       const coCheLuongIdsInt = coCheLuongData
         .map(item => {
           const id = item.ID;
           return id ? parseInt(id, 10) : null;
         })
         .filter((id): id is number => id !== null && !isNaN(id));
       
       console.log('Các mã nhân viên trong co_che_luong (đã chuyển sang int):', coCheLuongIdsInt);
       
       // Kiểm tra sự khớp
       const coCheLuongIds = new Set(coCheLuongData.map(item => item.ID?.toString()));
       const msCbnvIds = new Set(msCbnvData?.map(emp => emp['Mã nhân viên']?.toString()) || []);
       const fulltimeIds = new Set(fulltimeData?.map(item => item.ma_nhan_vien?.toString()) || []);
       const coCheLuongIdsIntSet = new Set(coCheLuongIdsInt.map(id => id.toString()));
       
       console.log('Số lượng ID trong co_che_luong (text):', coCheLuongIds.size);
       console.log('Số lượng ID trong co_che_luong (int):', coCheLuongIdsIntSet.size);
       console.log('Số lượng ID trong MS_CBNV:', msCbnvIds.size);
       console.log('Số lượng ID trong Fulltime:', fulltimeIds.size);
       
       // Tìm các ID có trong co_che_luong nhưng không có trong MS_CBNV
       const missingInMsCbnv = Array.from(coCheLuongIds).filter(id => !msCbnvIds.has(id));
       console.log('ID có trong co_che_luong nhưng không có trong MS_CBNV:', missingInMsCbnv);
       
       // Tìm các ID có trong co_che_luong (int) nhưng không có trong Fulltime
       const missingInFulltime = Array.from(coCheLuongIdsIntSet).filter(id => !fulltimeIds.has(id));
       console.log('ID có trong co_che_luong (int) nhưng không có trong Fulltime:', missingInFulltime);
       
       console.log('=== KẾT THÚC DEBUG ===');

      // Tạo map cho dữ liệu fulltime - sử dụng cách tương tự như DetailedSalaryTable
      const fulltimeMap = new Map();
      if (fulltimeData && fulltimeData.length > 0) {
        console.log('Đang xử lý dữ liệu Fulltime...');
        fulltimeData.forEach(item => {
          try {
            const maNhanVien = item.ma_nhan_vien;
            const currentValue = fulltimeMap.get(maNhanVien) || 0;
            let tongThuNhap = 0;
            
            console.log(`Xử lý nhân viên: ${maNhanVien}, tong_thu_nhap: ${item.tong_thu_nhap}`);
            
            if (item.tong_thu_nhap) {
              if (typeof item.tong_thu_nhap === 'string') {
                // Sử dụng cách parse giống như DetailedSalaryTable
                tongThuNhap = parseFloat((item.tong_thu_nhap || '0').toString().replace(/,/g, '')) || 0;
              } else if (typeof item.tong_thu_nhap === 'number') {
                tongThuNhap = item.tong_thu_nhap;
              }
            }
            
            console.log(`Tong thu nhap đã parse: ${tongThuNhap}`);
            // Cộng dồn nếu có nhiều bản ghi cho cùng một nhân viên
            fulltimeMap.set(maNhanVien, currentValue + tongThuNhap);
          } catch (e) {
            console.warn('Lỗi khi xử lý dữ liệu fulltime cho nhân viên:', item.ma_nhan_vien, e);
          }
        });
        
        console.log('Fulltime map sau khi xử lý:', fulltimeMap);
        console.log('Các mã nhân viên trong Fulltime map:', Array.from(fulltimeMap.keys()));
        console.log('Các giá trị trong Fulltime map:', Array.from(fulltimeMap.values()));
      } else {
        console.warn('Không có dữ liệu Fulltime để xử lý');
        console.log('fulltimeData:', fulltimeData);
        console.log('employeeIds từ co_che_luong:', coCheLuongData.map(item => item.ID));
      }

      // Xử lý dữ liệu
      console.log('Đang xử lý dữ liệu...');
      
      // Kiểm tra xem có dữ liệu để xử lý không
      if (employeeMap.size === 0) {
        console.warn('Không có dữ liệu nhân viên từ MS_CBNV để join');
        toast({
          title: "Cảnh báo",
          description: "Không thể tìm thấy thông tin nhân viên từ bảng MS_CBNV. Kiểm tra dữ liệu.",
          variant: "destructive",
        });
      }
      
      const processedData: SalaryMechanismData[] = coCheLuongData.map(item => {
        // Cải thiện logic join họ tên
        const employeeId = item.ID?.toString();
        const hoVaTen = employeeMap.get(employeeId) || 'Không xác định';
        
        console.log(`Processing employee ID: ${employeeId}, found name: ${hoVaTen}`);
        
        if (hoVaTen === 'Không xác định') {
          console.warn(`Không tìm thấy họ tên cho nhân viên ID: ${employeeId}`);
          console.warn(`Available keys in employeeMap:`, Array.from(employeeMap.keys()));
        }
        
        // Tính doanh thu chỉ tiêu và thực hiện theo đơn vị
        let doanhThuChiTieu = 0;
        let doanhThuThucHien = 0;
        
        console.log(`=== DEBUG: XỬ LÝ DOANH THU CHO NHÂN VIÊN ${employeeId} ===`);
        console.log(`Đơn vị của nhân viên: "${item.Don_vi}"`);
        console.log(`Tháng được chọn: ${selectedMonth}, Năm được chọn: ${selectedYearState}`);
        console.log(`Có dữ liệu Doanh_thu: ${doanhThuData ? 'Có' : 'Không'}`);
        console.log(`Số lượng bản ghi Doanh_thu: ${doanhThuData?.length || 0}`);
        
                 if (doanhThuData && doanhThuData.length > 0) {
                       // Tìm tất cả bản ghi trong Doanh_thu theo điều kiện:
            // 1. "Tên Đơn vị" = "Đơn vị" (có xử lý dấu cách)
            // 2. "Tháng pro" = "Tháng-Năm" (ví dụ: "01-2024")
            const donViData = doanhThuData.filter((dt: DoanhThuData) => {
              const tenDonVi = dt['Tên Đơn vị'];
              const thangPro = dt['Tháng pro'];
              
              // Điều kiện 1: So sánh tên đơn vị (có xử lý dấu cách)
              const tenDonViTrimmed = tenDonVi.trim();
              const donViTrimmed = item.Don_vi.trim();
              const matchDonVi = tenDonViTrimmed === donViTrimmed;
              
                             // Điều kiện 2: So sánh "Tháng pro" với format "Tháng MM-YYYY"
               let matchThangPro = false;
               let thangParsed = 'N/A';
               let namParsed = 'N/A';
               
               if (thangPro && typeof thangPro === 'string') {
                 const thangMatch = thangPro.match(/Tháng\s*(\d+)-(\d+)/);
                 if (thangMatch) {
                   const thangNumber = parseInt(thangMatch[1], 10);
                   const namNumber = parseInt(thangMatch[2], 10);
                   matchThangPro = thangNumber === selectedMonth && namNumber === selectedYearState;
                   thangParsed = thangMatch[1];
                   namParsed = thangMatch[2];
                 }
               }
              
              console.log(`Checking Doanh_thu record:`);
              console.log(`  Tên Đơn vị: "${tenDonVi}" (trimmed: "${tenDonViTrimmed}")`);
              console.log(`  Đơn vị từ co_che_luong: "${item.Don_vi}" (trimmed: "${donViTrimmed}")`);
              console.log(`  Tháng pro: "${thangPro}" -> parsed: Tháng=${thangParsed}, Năm=${namParsed}`);
              console.log(`  Match results: DonVi=${matchDonVi}, ThangPro=${matchThangPro}`);
              
              return matchDonVi && matchThangPro;
            });
          
          console.log(`Found ${donViData.length} matching records for unit: ${item.Don_vi}`);
          console.log('Matching records:', donViData);
          
          if (donViData.length === 0) {
            console.warn(`Không tìm thấy dữ liệu Doanh_thu cho đơn vị: ${item.Don_vi}, tháng: ${selectedMonth}, năm: ${selectedYearState}`);
            console.warn('Available units in Doanh_thu:', [...new Set(doanhThuData.map((dt: DoanhThuData) => dt['Tên Đơn vị']))]);
            
            // Debug: Kiểm tra xem có dữ liệu Doanh_thu cho đơn vị này không (không filter theo tháng/năm)
            const donViDataAll = doanhThuData.filter((dt: DoanhThuData) => dt['Tên Đơn vị'] === item.Don_vi);
            console.warn(`Có ${donViDataAll.length} bản ghi Doanh_thu cho đơn vị "${item.Don_vi}" (tất cả tháng/năm):`);
            if (donViDataAll.length > 0) {
              console.warn('Sample records:', donViDataAll.slice(0, 3));
            }
          }
          
                     // Tính tổng "Chỉ tiêu" (DT chỉ tiêu)
           doanhThuChiTieu = donViData.reduce((sum, dt: DoanhThuData) => {
             try {
               const rawChiTieu = dt['Chỉ tiêu'];
               console.log(`Raw Chỉ tiêu: ${rawChiTieu} (type: ${typeof rawChiTieu})`);
               
               let chiTieu = 0;
               if (rawChiTieu !== null && rawChiTieu !== undefined) {
                 if (typeof rawChiTieu === 'number') {
                   chiTieu = rawChiTieu;
                 } else if (typeof rawChiTieu === 'string') {
                   chiTieu = parseFloat(rawChiTieu.replace(/,/g, '')) || 0;
                 } else {
                   chiTieu = Number(rawChiTieu) || 0;
                 }
               }
               
               console.log(`Processing Chỉ tiêu: ${rawChiTieu} -> parsed: ${chiTieu}`);
               return sum + (isNaN(chiTieu) ? 0 : chiTieu);
             } catch (e) {
               console.warn('Lỗi khi parse chỉ tiêu:', dt['Chỉ tiêu'], e);
               return sum;
             }
           }, 0);
           
           // Tính tổng "Kỳ báo cáo" (DT thực hiện)
           doanhThuThucHien = donViData.reduce((sum, dt: DoanhThuData) => {
             try {
               const rawKyBaoCao = dt['Kỳ báo cáo'];
               console.log(`Raw Kỳ báo cáo: ${rawKyBaoCao} (type: ${typeof rawKyBaoCao})`);
               
               let kyBaoCao = 0;
               if (rawKyBaoCao !== null && rawKyBaoCao !== undefined) {
                 if (typeof rawKyBaoCao === 'number') {
                   kyBaoCao = rawKyBaoCao;
                 } else if (typeof rawKyBaoCao === 'string') {
                   kyBaoCao = parseFloat(rawKyBaoCao.replace(/,/g, '')) || 0;
                 } else {
                   kyBaoCao = Number(rawKyBaoCao) || 0;
                 }
               }
               
               console.log(`Processing Kỳ báo cáo: ${rawKyBaoCao} -> parsed: ${kyBaoCao}`);
               return sum + (isNaN(kyBaoCao) ? 0 : kyBaoCao);
             } catch (e) {
               console.warn('Lỗi khi parse kỳ báo cáo:', dt['Kỳ báo cáo'], e);
               return sum;
             }
           }, 0);
          
          console.log(`Final totals for ${item.Don_vi}: DT chỉ tiêu=${doanhThuChiTieu}, DT thực hiện=${doanhThuThucHien}`);
        } else {
          console.warn('Không có dữ liệu Doanh_thu để xử lý');
        }
        
        const phanTramHoanThanh = doanhThuChiTieu > 0 ? (doanhThuThucHien / doanhThuChiTieu) * 100 : 0;
        
        console.log(`=== KẾT QUẢ DOANH THU CHO ${item.Don_vi} ===`);
        console.log(`DT chỉ tiêu: ${doanhThuChiTieu}`);
        console.log(`DT thực hiện: ${doanhThuThucHien}`);
        console.log(`% hoàn thành: ${phanTramHoanThanh}%`);
        console.log(`=== KẾT THÚC DEBUG ===`);
        
        // Tính hệ số thưởng hiệu suất
        let heSo = 0;
        if (phanTramHoanThanh < 70) {
          heSo = 0.7;
        } else if (phanTramHoanThanh < 95) {
          heSo = phanTramHoanThanh / 100;
        } else {
          heSo = Math.min((phanTramHoanThanh / 100) + 0.05, 1.3);
        }

        // Đảm bảo các giá trị số không bị null/undefined
        const luongCoBan = Number(item['1_luong_co_ban']) || 0;
        const uuDaiNghe = Number(item['2_uu_dai_nghe']) || 0;
        const xangXe = Number(item['3_xang_xe']) || 0;
        const dienThoai = Number(item['4_dien_thoai']) || 0;
        const thuongHieuSuat = Number(item['5_thuong_hieu_suat']) || 0;
        const grossTheoCoChe = Number(item.Gross) || 0;

        const thuongHieuSuatTheoCoChe = thuongHieuSuat * heSo;
        
        const luongGrossThucTe = luongCoBan + uuDaiNghe + xangXe + dienThoai + thuongHieuSuatTheoCoChe;

                 // Lấy lương từ bảng Fulltime
         // Chuyển đổi employeeId từ text sang int để khớp với ma_nhan_vien trong Fulltime
         const employeeIdInt = parseInt(employeeId, 10);
         const luongGrossDonViDeXuat = fulltimeMap.get(employeeIdInt) || 0;
         
         // Debug logging cho việc lấy lương từ Fulltime
         if (luongGrossDonViDeXuat === 0) {
           console.warn(`Không tìm thấy lương Fulltime cho nhân viên ID: ${employeeId} (text) -> ${employeeIdInt} (int)`);
           console.warn(`Available keys in fulltimeMap:`, Array.from(fulltimeMap.keys()));
           console.warn(`Employee ID text: ${employeeId}, Employee ID int: ${employeeIdInt}`);
           console.warn(`fulltimeMap size: ${fulltimeMap.size}`);
           
           // Kiểm tra xem employeeIdInt có trong danh sách employeeIds không
           const employeeIdsInt = coCheLuongData
             .map(item => {
               const id = item.ID;
               return id ? parseInt(id, 10) : null;
             })
             .filter(id => id !== null && !isNaN(id));
           console.warn(`Employee ID ${employeeIdInt} có trong danh sách co_che_luong không:`, employeeIdsInt.includes(employeeIdInt));
         } else {
           console.log(`Tìm thấy lương Fulltime cho nhân viên ${employeeId} (text) -> ${employeeIdInt} (int): ${luongGrossDonViDeXuat}`);
         }
        
        const chenhLechCoChe = luongGrossThucTe - luongGrossDonViDeXuat;

        return {
          id: employeeId || 'N/A',
          ho_va_ten: hoVaTen,
          don_vi: item.Don_vi || '',
          luong_co_ban: luongCoBan,
          uu_dai_nghe: uuDaiNghe,
          xang_xe: xangXe,
          dien_thoai: dienThoai,
          thuong_hieu_suat: thuongHieuSuat,
          gross_theo_co_che: grossTheoCoChe,
          doanh_thu_chi_tieu: doanhThuChiTieu,
          doanh_thu_thuc_hien: doanhThuThucHien,
          phan_tram_hoan_thanh: phanTramHoanThanh,
          thuong_hieu_suat_theo_co_che: thuongHieuSuatTheoCoChe,
          luong_gross_thuc_te: luongGrossThucTe,
          luong_gross_don_vi_de_xuat: luongGrossDonViDeXuat,
          chenh_lech_co_che: chenhLechCoChe
        };
      });

      console.log('Dữ liệu đã xử lý:', processedData);
      setData(processedData);
      
      // Hiển thị thông báo thành công
      if (processedData.length > 0) {
        // Kiểm tra xem có bao nhiêu nhân viên có lương từ Fulltime
        const coLuongFulltime = processedData.filter(item => item.luong_gross_don_vi_de_xuat > 0).length;
        const khongCoLuongFulltime = processedData.length - coLuongFulltime;
        
                 let description = `Đã tải ${processedData.length} bản ghi cơ chế lương GĐ tỉnh và GĐ ĐVTV`;
        if (coLuongFulltime > 0) {
          description += ` (${coLuongFulltime} có lương Fulltime)`;
        }
        if (khongCoLuongFulltime > 0) {
          description += ` (${khongCoLuongFulltime} không có lương Fulltime)`;
        }
        
        toast({
          title: "Thành công",
          description: description,
          variant: "default",
        });
        
        // Hiển thị cảnh báo nếu có nhân viên không có lương Fulltime
        if (khongCoLuongFulltime > 0) {
          toast({
            title: "Cảnh báo",
            description: `${khongCoLuongFulltime} nhân viên không có dữ liệu lương từ bảng Fulltime. Kiểm tra dữ liệu.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Thông báo",
          description: "Không có dữ liệu để hiển thị",
          variant: "default",
        });
      }
      
    } catch (error) {
      console.error('Error fetching data:', error);
      
      // Hiển thị thông tin lỗi chi tiết hơn
      let errorMessage = "Không thể tải dữ liệu. Vui lòng thử lại.";
      
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = `Lỗi: ${error.message}`;
        } else if ('details' in error) {
          errorMessage = `Lỗi chi tiết: ${error.details}`;
        } else {
          errorMessage = `Lỗi không xác định: ${JSON.stringify(error)}`;
        }
      }
      
      toast({
        title: "Lỗi",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Set data rỗng để hiển thị thông báo "Không có dữ liệu"
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYearState]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const getChenhLechColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChenhLechIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  if (loading) {
    return (
      <Card className="flex-grow flex flex-col h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-md font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-primary inline-block" />
            Check cơ chế lương GĐ tỉnh & GĐ ĐVTV
          </CardTitle>
          <CardDescription className="text-xs">
            Kiểm tra cơ chế lương cho Giám đốc tỉnh và Giám đốc ĐVTV theo tháng và năm
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                         <p className="text-sm">Đang tải dữ liệu cơ chế lương GĐ tỉnh & GĐ ĐVTV...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-grow flex flex-col h-full">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-md font-semibold flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-primary inline-block" />
          Check cơ chế lương GĐ tỉnh & GĐ ĐVTV
        </CardTitle>
        <CardDescription className="text-xs">
          Kiểm tra cơ chế lương cho Giám đốc tỉnh và Giám đốc ĐVTV theo tháng và năm
        </CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow flex flex-col overflow-hidden p-3">
        {/* Filter row */}
        <div className="mb-3 flex flex-wrap gap-2 items-end">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium">Tháng:</label>
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium">Năm:</label>
            <Select value={selectedYearState.toString()} onValueChange={(value) => setSelectedYearState(parseInt(value))}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">Họ và tên</label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-xs min-w-[120px] h-8"
              placeholder="Tìm theo tên..."
              value={filterName}
              onChange={e => setFilterName(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">Đơn vị</label>
            <input
              type="text"
              className="border rounded px-2 py-1 text-xs min-w-[120px] h-8"
              placeholder="Tìm theo đơn vị..."
              value={filterDonVi}
              onChange={e => setFilterDonVi(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">Chênh lệch từ</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-xs min-w-[90px] h-8"
              placeholder="Min"
              value={filterChenhLechMin}
              onChange={e => setFilterChenhLechMin(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs mb-1">Chênh lệch đến</label>
            <input
              type="number"
              className="border rounded px-2 py-1 text-xs min-w-[90px] h-8"
              placeholder="Max"
              value={filterChenhLechMax}
              onChange={e => setFilterChenhLechMax(e.target.value)}
            />
          </div>
        </div>

                 <div className="flex-grow min-h-0">
          
          {sortedData.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-center py-4 text-sm">Không có dữ liệu cơ chế lương GĐ tỉnh cho kỳ hiện tại.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-auto" style={{ maxHeight: '600px' }}>
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'id' && 'font-bold')} onClick={() => handleSort('id')}>
                      ID {renderSortIcon('id')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'ho_va_ten' && 'font-bold')} onClick={() => handleSort('ho_va_ten')}>
                      Họ và tên {renderSortIcon('ho_va_ten')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap', sortKey === 'don_vi' && 'font-bold')} onClick={() => handleSort('don_vi')}>
                      Đơn vị {renderSortIcon('don_vi')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'luong_co_ban' && 'font-bold')} onClick={() => handleSort('luong_co_ban')}>
                      Lương cơ bản {renderSortIcon('luong_co_ban')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'uu_dai_nghe' && 'font-bold')} onClick={() => handleSort('uu_dai_nghe')}>
                      Ưu đãi nghề {renderSortIcon('uu_dai_nghe')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'xang_xe' && 'font-bold')} onClick={() => handleSort('xang_xe')}>
                      Xăng xe {renderSortIcon('xang_xe')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'dien_thoai' && 'font-bold')} onClick={() => handleSort('dien_thoai')}>
                      Điện thoại {renderSortIcon('dien_thoai')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'thuong_hieu_suat' && 'font-bold')} onClick={() => handleSort('thuong_hieu_suat')}>
                      Thưởng HS {renderSortIcon('thuong_hieu_suat')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'gross_theo_co_che' && 'font-bold')} onClick={() => handleSort('gross_theo_co_che')}>
                      Gross theo cơ chế {renderSortIcon('gross_theo_co_che')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'doanh_thu_chi_tieu' && 'font-bold')} onClick={() => handleSort('doanh_thu_chi_tieu')}>
                      DT chỉ tiêu {renderSortIcon('doanh_thu_chi_tieu')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'doanh_thu_thuc_hien' && 'font-bold')} onClick={() => handleSort('doanh_thu_thuc_hien')}>
                      DT thực hiện {renderSortIcon('doanh_thu_thuc_hien')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'phan_tram_hoan_thanh' && 'font-bold')} onClick={() => handleSort('phan_tram_hoan_thanh')}>
                      % hoàn thành {renderSortIcon('phan_tram_hoan_thanh')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'thuong_hieu_suat_theo_co_che' && 'font-bold')} onClick={() => handleSort('thuong_hieu_suat_theo_co_che')}>
                      Thưởng HS theo cơ chế {renderSortIcon('thuong_hieu_suat_theo_co_che')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'luong_gross_thuc_te' && 'font-bold')} onClick={() => handleSort('luong_gross_thuc_te')}>
                      Lương Gross thực tế {renderSortIcon('luong_gross_thuc_te')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'luong_gross_don_vi_de_xuat' && 'font-bold')} onClick={() => handleSort('luong_gross_don_vi_de_xuat')}>
                      Lương Gross đơn vị đề xuất {renderSortIcon('luong_gross_don_vi_de_xuat')}
                    </TableHead>
                    <TableHead className={cn('text-xs py-1.5 px-2 cursor-pointer whitespace-nowrap text-right', sortKey === 'chenh_lech_co_che' && 'font-bold')} onClick={() => handleSort('chenh_lech_co_che')}>
                      Chênh lệch cơ chế {renderSortIcon('chenh_lech_co_che')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map((row, index) => (
                    <TableRow key={index} className={index < 3 ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''}>
                      <TableCell className="text-xs py-1.5 px-2 font-medium">{row.id}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.ho_va_ten}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 whitespace-nowrap">{row.don_vi}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.luong_co_ban)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.uu_dai_nghe)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.xang_xe)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.dien_thoai)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.thuong_hieu_suat)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">{formatCurrency(row.gross_theo_co_che)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.doanh_thu_chi_tieu)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.doanh_thu_thuc_hien)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">{formatPercentage(row.phan_tram_hoan_thanh)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.thuong_hieu_suat_theo_co_che)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap font-semibold">{formatCurrency(row.luong_gross_thuc_te)}</TableCell>
                      <TableCell className="text-xs py-1.5 px-2 text-right whitespace-nowrap">{formatCurrency(row.luong_gross_don_vi_de_xuat)}</TableCell>
                      <TableCell className={cn("text-xs py-1.5 px-2 text-right whitespace-nowrap flex items-center gap-1 justify-end", getChenhLechColor(row.chenh_lech_co_che))}>
                        {getChenhLechIcon(row.chenh_lech_co_che)}
                        {formatCurrency(row.chenh_lech_co_che)}
                      </TableCell>
                    </TableRow>
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
