"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BarChart3, TrendingUp, TrendingDown, ArrowUpDown, ArrowUp, ArrowDown, Maximize2, X } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface RevenueMatrixHeatmapProps {
  selectedYear?: number | null;
  selectedMonths?: number[];
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
  selectedDonVi2?: string[];
}

interface MatrixData {
  business_unit: string;
  khoi_dtql: string;
  doanh_thu: number;
  chi_tieu: number;
  ty_le_thuc_hien: number;
  phan_tram_hoan_thanh_chi_tieu_ca_nam: number;
  ty_le_co_gang: number;
  so_thang_co_doanh_thu: number;
}

interface HeatmapData {
  business_unit: string;
  khoi_dtql: string;
  value: number;
  percentage: number;
  color: string;
}

export default function RevenueMatrixHeatmap({
  selectedYear,
  selectedMonths,
  selectedDepartmentsForDiadiem,
  selectedNganhDoc,
  selectedDonVi2
}: RevenueMatrixHeatmapProps) {
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'doanh_thu' | 'ty_le' | 'phan_tram_hoan_thanh_ca_nam' | 'ty_le_co_gang'>('doanh_thu');
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [khoiDTQLs, setKhoiDTQLs] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<'business_unit' | 'khoi_dtql' | string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedYear) return;

    setIsLoading(true);
    setError(null);

    try {
      // Query để lấy dữ liệu doanh thu thực hiện (theo filter thời gian)
      let doanhThuQuery = supabase
        .from('Doanh_thu')
        .select('"Tên Đơn vị", "Khối DTQL", "Kỳ báo cáo", "Năm", "Tháng"')
        .not('"Tên Đơn vị"', 'is', null)
        .not('"Khối DTQL"', 'is', null)
        .eq('"Năm"', selectedYear);

      // Áp dụng filter thời gian cho doanh thu thực hiện
      if (selectedMonths && selectedMonths.length > 0) {
        const monthFormats = selectedMonths.map(m => `Tháng ${String(m).padStart(2, '0')}`);
        doanhThuQuery = doanhThuQuery.in('"Tháng"', monthFormats);
      }

      // Áp dụng filter địa điểm cho doanh thu thực hiện
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        doanhThuQuery = doanhThuQuery.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
      }

      // Query để lấy dữ liệu chỉ tiêu (tất cả 12 tháng, không áp dụng filter thời gian)
      // Khớp với logic trong bảng Chi tiết doanh thu
      let chiTieuQuery = supabase
        .from('Doanh_thu')
        .select('"Tên Đơn vị", "Khối DTQL", "Chỉ tiêu", "Năm", "Tháng"')
        .not('"Tên Đơn vị"', 'is', null)
        .not('"Khối DTQL"', 'is', null)
        .eq('"Năm"', selectedYear);

      // Lấy chỉ tiêu của tất cả 12 tháng (không filter thời gian)
      const monthFormats = Array.from({length: 12}, (_, i) => `Tháng ${String(i + 1).padStart(2, '0')}`);
      chiTieuQuery = chiTieuQuery.in('"Tháng"', monthFormats);

      // Áp dụng filter địa điểm cho chỉ tiêu
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        chiTieuQuery = chiTieuQuery.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
      }

      // Lấy dữ liệu doanh thu thực hiện
      const doanhThuData: any[] = [];
      let from = 0;
      const batchSize = 10000;
      let hasMoreData = true;

      while (hasMoreData) {
        const { data: batchData, error: queryError } = await doanhThuQuery.range(from, from + batchSize - 1);
        
        if (queryError) {
          console.error("Supabase doanh thu query error:", queryError);
          throw queryError;
        }

        if (batchData && batchData.length > 0) {
          doanhThuData.push(...batchData);
          from += batchSize;
          console.log(`Fetched doanh thu batch: ${batchData.length} records, total so far: ${doanhThuData.length}`);
        } else {
          hasMoreData = false;
        }
      }

      // Lấy dữ liệu chỉ tiêu
      const chiTieuData: any[] = [];
      from = 0;
      hasMoreData = true;

      while (hasMoreData) {
        const { data: batchData, error: queryError } = await chiTieuQuery.range(from, from + batchSize - 1);
        
        if (queryError) {
          console.error("Supabase chi tieu query error:", queryError);
          throw queryError;
        }

        if (batchData && batchData.length > 0) {
          chiTieuData.push(...batchData);
          from += batchSize;
          console.log(`Fetched chi tieu batch: ${batchData.length} records, total so far: ${chiTieuData.length}`);
        } else {
          hasMoreData = false;
        }
      }

      console.log("Raw doanh thu data from Supabase:", doanhThuData);
      console.log("Raw chi tieu data from Supabase:", chiTieuData);
      console.log("Total doanh thu records fetched:", doanhThuData.length);
      console.log("Total chi tieu records fetched:", chiTieuData.length);
      console.log("Sample doanh thu item:", doanhThuData[0]);
      console.log("Sample chi tieu item:", chiTieuData[0]);

      // Xử lý dữ liệu để tạo ma trận
      const matrixMap = new Map<string, { 
        doanh_thu: number; 
        chi_tieu: number; // Tổng chỉ tiêu tất cả 12 tháng
        so_thang_co_doanh_thu: number;
      }>();
      
      // Danh sách địa điểm cần loại bỏ
      const excludedLocations = ['Medon', 'Meddom', 'Medcom', 'Med Mê Linh', 'Med Group'];
      
      // Mapping để gộp địa điểm
      const locationMapping: { [key: string]: string } = {
        'Med Đà Nẵng': 'Med Huda',
        'Med Huế': 'Med Huda',
        'Med TP.HCM': 'Med Đông Nam Bộ',
        'Med Đồng Nai': 'Med Đông Nam Bộ',
        'Med Bình Phước': 'Med Đông Nam Bộ',
        'Med Bình Dương': 'Med Đông Nam Bộ'
      };
      
      // Xử lý dữ liệu doanh thu thực hiện (theo filter thời gian)
      doanhThuData.forEach((item: any) => {
        let tenDonVi = item['Tên Đơn vị'];
        const khoiDTQL = item['Khối DTQL'];
        
        // Bỏ qua các địa điểm bị loại trừ
        if (excludedLocations.includes(tenDonVi) || !khoiDTQL) {
          return;
        }
        
        // Gộp địa điểm theo mapping
        if (locationMapping[tenDonVi]) {
          tenDonVi = locationMapping[tenDonVi];
        }
        
        // Parse dữ liệu doanh thu
        const rawKyBaoCao = item['Kỳ báo cáo'];
        let doanhThu = 0;
        
        if (rawKyBaoCao !== null && rawKyBaoCao !== undefined) {
          if (typeof rawKyBaoCao === 'number') {
            doanhThu = rawKyBaoCao;
          } else if (typeof rawKyBaoCao === 'string') {
            doanhThu = parseFloat(rawKyBaoCao.replace(/,/g, '')) || 0;
          } else {
            doanhThu = Number(rawKyBaoCao) || 0;
          }
        }
        
        const thang = item['Tháng'];
        const key = `${tenDonVi}|${khoiDTQL}`;
        
        if (matrixMap.has(key)) {
          const existing = matrixMap.get(key)!;
          existing.doanh_thu += doanhThu; // Tổng doanh thu theo filter thời gian
          if (doanhThu > 0) {
            existing.so_thang_co_doanh_thu += 1;
          }
        } else {
          matrixMap.set(key, { 
            doanh_thu: doanhThu, // Tổng doanh thu theo filter thời gian
            chi_tieu: 0, // Sẽ được cập nhật từ chiTieuData
            so_thang_co_doanh_thu: doanhThu > 0 ? 1 : 0
          });
        }
        
        // Debug log cho một vài item đầu tiên
        if (doanhThuData.indexOf(item) < 10) {
          console.log(`Debug doanh thu item ${doanhThuData.indexOf(item)}:`, {
            tenDonVi,
            khoiDTQL,
            doanhThu,
            thang,
            key,
            hasDoanhThu: doanhThu > 0,
            rawKyBaoCao: item['Kỳ báo cáo']
          });
        }
      });

      // Xử lý dữ liệu chỉ tiêu (tất cả 12 tháng, không filter thời gian)
      // Khớp với logic trong bảng Chi tiết doanh thu
      chiTieuData.forEach((item: any) => {
        let tenDonVi = item['Tên Đơn vị'];
        const khoiDTQL = item['Khối DTQL'];
        
        // Bỏ qua các địa điểm bị loại trừ
        if (excludedLocations.includes(tenDonVi) || !khoiDTQL) {
          return;
        }
        
        // Gộp địa điểm theo mapping
        if (locationMapping[tenDonVi]) {
          tenDonVi = locationMapping[tenDonVi];
        }
        
        // Parse dữ liệu chỉ tiêu
        const rawChiTieu = item['Chỉ tiêu'];
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
        
        const thang = item['Tháng'];
        const key = `${tenDonVi}|${khoiDTQL}`;
        
        if (matrixMap.has(key)) {
          const existing = matrixMap.get(key)!;
          existing.chi_tieu += chiTieu; // Tổng chỉ tiêu tất cả 12 tháng
        } else {
          matrixMap.set(key, { 
            doanh_thu: 0, // Sẽ được cập nhật từ doanhThuData
            chi_tieu: chiTieu, // Tổng chỉ tiêu tất cả 12 tháng
            so_thang_co_doanh_thu: 0
          });
        }
        
        // Debug log cho một vài item đầu tiên
        if (chiTieuData.indexOf(item) < 10) {
          console.log(`Debug chi tieu item ${chiTieuData.indexOf(item)}:`, {
            tenDonVi,
            khoiDTQL,
            chiTieu,
            thang,
            key,
            rawChiTieu: item['Chỉ tiêu']
          });
        }
      });

      // Logic tính chi_tieu_cac_thang_co_doanh_thu đã được loại bỏ
      // Vì chúng ta sử dụng logic mới: tỷ lệ thực hiện = doanh_thu / chi_tieu (cả hai đều theo filter thời gian)

      // Debug: Đếm số tháng có doanh thu = 0
      let totalDoanhThuRecords = 0;
      let recordsWithZeroDoanhThu = 0;
      let recordsWithNullDoanhThu = 0;
      doanhThuData.forEach(item => {
        totalDoanhThuRecords++;
        const rawKyBaoCao = item['Kỳ báo cáo'];
        let doanhThu = 0;
        
        if (rawKyBaoCao === null || rawKyBaoCao === undefined) {
          recordsWithNullDoanhThu++;
          doanhThu = 0;
        } else {
          doanhThu = Number(rawKyBaoCao) || 0;
        }
        
        if (doanhThu === 0) {
          recordsWithZeroDoanhThu++;
        }
      });
      console.log(`Total doanh thu records: ${totalDoanhThuRecords}, Records with zero doanh thu: ${recordsWithZeroDoanhThu}, Records with null doanh thu: ${recordsWithNullDoanhThu}`);
      console.log(`Total chi tieu records: ${chiTieuData.length}`);

      // Debug: In ra một vài item từ matrixMap
      console.log("MatrixMap sample entries:");
      let count = 0;
      for (const [key, data] of matrixMap.entries()) {
        if (count < 3) {
          console.log(`Key: ${key}`, {
            ...data,
            explanation: `Doanh thu tổng: ${data.doanh_thu}, Chỉ tiêu tổng: ${data.chi_tieu}, Số tháng có doanh thu: ${data.so_thang_co_doanh_thu}`
          });
          count++;
        } else {
          break;
        }
      }

      // Chuyển đổi Map thành array
      const processedData: MatrixData[] = Array.from(matrixMap.entries()).map(([key, data]) => {
        const [business_unit, khoi_dtql] = key.split('|');
        
        // Tính tỷ lệ thực hiện: Tổng doanh thu thực hiện / Tổng chỉ tiêu (theo filter thời gian)
        // Khớp với logic trong bảng Chi tiết doanh thu
        const ty_le_thuc_hien = data.chi_tieu > 0 
          ? data.doanh_thu / data.chi_tieu 
          : 0;
        
        // Tính % hoàn thành chỉ tiêu cả năm: Tổng doanh thu thực hiện (theo filter thời gian) / Tổng chỉ tiêu (tất cả 12 tháng)
        // Khớp với logic trong bảng Chi tiết doanh thu
        const phan_tram_hoan_thanh_chi_tieu_ca_nam = data.chi_tieu > 0 
          ? (data.doanh_thu / data.chi_tieu) * 100 
          : 0;
        
        // Tính doanh thu thực hiện trung bình tháng
        const doanh_thu_thuc_hien_trung_binh_thang = data.so_thang_co_doanh_thu > 0 
          ? data.doanh_thu / data.so_thang_co_doanh_thu 
          : 0;
        
        // Tính chỉ tiêu doanh thu còn lại
        const chi_tieu_doanh_thu_con_lai = data.chi_tieu - data.doanh_thu;
        
        // Tính doanh thu còn lại trung bình tháng
        const doanh_thu_con_lai_trung_binh_thang = (12 - data.so_thang_co_doanh_thu) > 0 
          ? chi_tieu_doanh_thu_con_lai / (12 - data.so_thang_co_doanh_thu) 
          : 0;
        
        // Tính tỷ lệ cố gắng
        const ty_le_co_gang = doanh_thu_thuc_hien_trung_binh_thang > 0 
          ? (doanh_thu_con_lai_trung_binh_thang / doanh_thu_thuc_hien_trung_binh_thang) * 100 
          : 0;
        
        return {
          business_unit,
          khoi_dtql,
          doanh_thu: data.doanh_thu,
          chi_tieu: data.chi_tieu,
          ty_le_thuc_hien,
          phan_tram_hoan_thanh_chi_tieu_ca_nam,
          ty_le_co_gang,
          so_thang_co_doanh_thu: data.so_thang_co_doanh_thu
        };
      });

      // Lấy danh sách unique business units và khoi DTQL
      const uniqueBusinessUnits = [...new Set(processedData.map(item => item.business_unit))].sort();
      const uniqueKhoiDTQLs = [...new Set(processedData.map(item => item.khoi_dtql))].sort();
      
      console.log("Processed matrix data:", processedData);
      console.log("Business units:", uniqueBusinessUnits);
      console.log("Khoi DTQLs:", uniqueKhoiDTQLs);
      
      // Debug: In thông tin mẫu về dữ liệu đã xử lý
      if (processedData.length > 0) {
        const sampleItem = processedData[0];
        console.log("Sample processed item:");
        console.log("- Business unit:", sampleItem.business_unit);
        console.log("- Khoi DTQL:", sampleItem.khoi_dtql);
        console.log("- Tỷ lệ thực hiện:", sampleItem.ty_le_thuc_hien);
        console.log("- % Hoàn thành chỉ tiêu cả năm:", sampleItem.phan_tram_hoan_thanh_chi_tieu_ca_nam);
        console.log("- Doanh thu tổng:", sampleItem.doanh_thu);
        console.log("- Chỉ tiêu tổng:", sampleItem.chi_tieu);
        console.log("- Số tháng có doanh thu:", sampleItem.so_thang_co_doanh_thu);
        console.log("- Tỷ lệ thực hiện tính lại:", sampleItem.chi_tieu > 0 ? sampleItem.doanh_thu / sampleItem.chi_tieu : 0);
        console.log("- % Hoàn thành chỉ tiêu cả năm tính lại:", sampleItem.chi_tieu > 0 ? (sampleItem.doanh_thu / sampleItem.chi_tieu) * 100 : 0);
      }



      setBusinessUnits(uniqueBusinessUnits);
      setKhoiDTQLs(uniqueKhoiDTQLs);
      setMatrixData(processedData);

      // Tạo dữ liệu heatmap
      generateHeatmapData(processedData, uniqueBusinessUnits, uniqueKhoiDTQLs, viewMode);

    } catch (err: any) {
      console.error("Error fetching matrix data:", err);
      setError(err.message || "Có lỗi xảy ra khi tải dữ liệu");
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonths, selectedDepartmentsForDiadiem, selectedNganhDoc, selectedDonVi2, viewMode]);

  const generateHeatmapData = (
    data: MatrixData[], 
    businessUnits: string[], 
    khoiDTQLs: string[], 
    mode: 'doanh_thu' | 'ty_le' | 'phan_tram_hoan_thanh_ca_nam' | 'ty_le_co_gang'
  ) => {
    const heatmapData: HeatmapData[] = [];
    
    // Tìm giá trị min/max để tính màu
    const values = data.map(item => {
      switch (mode) {
        case 'doanh_thu':
          return item.doanh_thu;
        case 'ty_le':
          return item.ty_le_thuc_hien;
        case 'phan_tram_hoan_thanh_ca_nam':
          return item.phan_tram_hoan_thanh_chi_tieu_ca_nam;
        case 'ty_le_co_gang':
          return item.ty_le_co_gang;
        default:
          return 0;
      }
    });
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue;

    businessUnits.forEach(businessUnit => {
      khoiDTQLs.forEach(khoiDTQL => {
        const item = data.find(d => d.business_unit === businessUnit && d.khoi_dtql === khoiDTQL);
        let value = 0;
        if (item) {
          switch (mode) {
            case 'doanh_thu':
              value = item.doanh_thu;
              break;
            case 'ty_le':
              value = item.ty_le_thuc_hien;
              break;
            case 'phan_tram_hoan_thanh_ca_nam':
              value = item.phan_tram_hoan_thanh_chi_tieu_ca_nam;
              break;
            case 'ty_le_co_gang':
              value = item.ty_le_co_gang;
              break;
          }
        }
        const percentage = range > 0 ? ((value - minValue) / range) * 100 : 0;
        
        // Tính màu dựa trên percentage
        let color = '#f3f4f6'; // Màu xám nhạt cho giá trị 0
        if (value > 0) {
          if (mode === 'doanh_thu') {
            // Màu xanh cho doanh thu
            const intensity = Math.min(percentage / 100, 1);
            const red = Math.floor(59 + (196 - 59) * (1 - intensity));
            const green = Math.floor(130 + (255 - 130) * (1 - intensity));
            const blue = Math.floor(246 + (255 - 246) * (1 - intensity));
            color = `rgb(${red}, ${green}, ${blue})`;
          } else if (mode === 'ty_le') {
            // Màu sắc cho tỷ lệ thực hiện theo khoảng
            const percentageValue = value * 100; // Chuyển thành phần trăm
            
            if (percentageValue < 70) {
              // < 70%: Màu đỏ
              color = '#ef4444'; // red-500
            } else if (percentageValue < 95) {
              // 70-95%: Gradient từ đỏ đến cam
              const intensity = (percentageValue - 70) / 25; // 0-1 trong khoảng 70-95%
              const red = Math.floor(239 + (251 - 239) * intensity); // 239 -> 251
              const green = Math.floor(68 + (146 - 68) * intensity);  // 68 -> 146
              const blue = Math.floor(68 + (60 - 68) * intensity);    // 68 -> 60
              color = `rgb(${red}, ${green}, ${blue})`;
            } else if (percentageValue <= 100) {
              // 95-100%: Màu vàng
              color = '#eab308'; // yellow-500
            } else if (percentageValue < 110) {
              // 100-110%: Màu xanh nhạt
              color = '#22c55e'; // green-500
            } else {
              // > 110%: Màu xanh đậm
              color = '#15803d'; // green-700
            }
          } else if (mode === 'phan_tram_hoan_thanh_ca_nam') {
            // Màu sắc cho % hoàn thành chỉ tiêu cả năm (target = 100%)
            if (value < 50) {
              // < 50%: Màu đỏ đậm
              color = '#dc2626'; // red-600
            } else if (value < 70) {
              // 50-70%: Gradient từ đỏ đậm đến đỏ nhạt
              const intensity = (value - 50) / 20;
              const red = Math.floor(220 + (239 - 220) * intensity); // 220 -> 239
              const green = Math.floor(38 + (68 - 38) * intensity);  // 38 -> 68
              const blue = Math.floor(38 + (68 - 38) * intensity);   // 38 -> 68
              color = `rgb(${red}, ${green}, ${blue})`;
            } else if (value < 90) {
              // 70-90%: Gradient từ đỏ nhạt đến cam
              const intensity = (value - 70) / 20;
              const red = Math.floor(239 + (251 - 239) * intensity); // 239 -> 251
              const green = Math.floor(68 + (146 - 68) * intensity);  // 68 -> 146
              const blue = Math.floor(68 + (60 - 68) * intensity);    // 68 -> 60
              color = `rgb(${red}, ${green}, ${blue})`;
            } else if (value < 100) {
              // 90-100%: Gradient từ cam đến vàng
              const intensity = (value - 90) / 10;
              const red = Math.floor(251 + (234 - 251) * intensity); // 251 -> 234
              const green = Math.floor(146 + (179 - 146) * intensity); // 146 -> 179
              const blue = Math.floor(60 + (8 - 60) * intensity);     // 60 -> 8
              color = `rgb(${red}, ${green}, ${blue})`;
            } else if (value < 110) {
              // 100-110%: Gradient từ vàng đến xanh nhạt
              const intensity = (value - 100) / 10;
              const red = Math.floor(234 + (34 - 234) * intensity);   // 234 -> 34
              const green = Math.floor(179 + (197 - 179) * intensity); // 179 -> 197
              const blue = Math.floor(8 + (94 - 8) * intensity);       // 8 -> 94
              color = `rgb(${red}, ${green}, ${blue})`;
            } else {
              // > 110%: Màu xanh đậm
              color = '#15803d'; // green-700
            }
          } else if (mode === 'ty_le_co_gang') {
            // Màu sắc cho tỷ lệ cố gắng (đảo ngược: xanh <100%, đỏ >100%)
            if (value < 50) {
              color = '#22c55e'; // green-500 - Tốt (cần cố gắng ít)
            } else if (value < 80) {
              color = '#eab308'; // yellow-500 - Khá tốt
            } else if (value < 100) {
              color = '#f97316'; // orange-500 - Trung bình
            } else if (value < 120) {
              color = '#ef4444'; // red-500 - Cần cố gắng nhiều
            } else {
              color = '#dc2626'; // red-600 - Cần cố gắng rất nhiều
            }
          }
        }

        heatmapData.push({
          business_unit: businessUnit,
          khoi_dtql: khoiDTQL,
          value,
          percentage,
          color
        });
      });
    });

    setHeatmapData(heatmapData);
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    if (value === 0) return '0';
    
    // Chuyển đổi thành tỷ VND
    const tyVND = value / 1000000000;
    
    if (tyVND >= 1) {
      return `${tyVND.toFixed(1)}T`;
    } else {
      // Nếu nhỏ hơn 1 tỷ, chuyển thành triệu VND
      const trieuVND = value / 1000000;
      return `${trieuVND.toFixed(0)}M`;
    }
  };

  const formatPercentage = (value: number) => {
    const percentage = value * 100;
    if (percentage >= 100) {
      return `${percentage.toFixed(0)}%`;
    } else {
      return `${percentage.toFixed(1)}%`;
    }
  };

  // Hàm tính tổng giá trị cho một cột (business unit)
  const getColumnTotal = (businessUnit: string) => {
    const items = matrixData.filter(item => item.business_unit === businessUnit);
    
    if (viewMode === 'doanh_thu') {
      // Đối với doanh thu, tính tổng
      return items.reduce((sum, item) => sum + item.doanh_thu, 0);
    } else {
      // Đối với các tab tỷ lệ, tính trung bình có trọng số
      const totalDoanhThu = items.reduce((sum, item) => sum + item.doanh_thu, 0);
      const totalChiTieu = items.reduce((sum, item) => sum + item.chi_tieu, 0);
      
      if (totalChiTieu === 0) return 0;
      
      switch (viewMode) {
        case 'ty_le':
          // Tỷ lệ thực hiện: doanh thu (theo filter thời gian) / chỉ tiêu (tất cả 12 tháng) - khớp với bảng Chi tiết doanh thu
          return totalChiTieu > 0 ? totalDoanhThu / totalChiTieu : 0;
        case 'phan_tram_hoan_thanh_ca_nam':
          // % hoàn thành chỉ tiêu cả năm: doanh thu (theo filter thời gian) / chỉ tiêu (tất cả 12 tháng) - khớp với bảng Chi tiết doanh thu
          return (totalDoanhThu / totalChiTieu) * 100;
        case 'ty_le_co_gang':
          // Tính tỷ lệ cố gắng dựa trên tổng doanh thu và chỉ tiêu
          const totalDoanhThuThucHien = totalDoanhThu;
          const totalChiTieuConLai = totalChiTieu - totalDoanhThu;
          const totalSoThangCoDoanhThu = items.reduce((sum, item) => sum + item.so_thang_co_doanh_thu, 0);
          const soThangConLai = 12 - totalSoThangCoDoanhThu;
          const doanhThuConLaiTrungBinhThang = soThangConLai > 0 ? totalChiTieuConLai / soThangConLai : 0;
          const doanhThuThucHienTrungBinhThang = totalSoThangCoDoanhThu > 0 ? totalDoanhThuThucHien / totalSoThangCoDoanhThu : 0;
          return doanhThuThucHienTrungBinhThang > 0 ? (doanhThuConLaiTrungBinhThang / doanhThuThucHienTrungBinhThang) * 100 : 0;
        default:
          return 0;
      }
    }
  };

  // Hàm tính tổng giá trị cho một hàng (khoi DTQL)
  const getRowTotal = (khoiDTQL: string) => {
    const items = matrixData.filter(item => item.khoi_dtql === khoiDTQL);
    
    if (viewMode === 'doanh_thu') {
      // Đối với doanh thu, tính tổng
      return items.reduce((sum, item) => sum + item.doanh_thu, 0);
    } else {
      // Đối với các tab tỷ lệ, tính trung bình có trọng số
      const totalDoanhThu = items.reduce((sum, item) => sum + item.doanh_thu, 0);
      const totalChiTieu = items.reduce((sum, item) => sum + item.chi_tieu, 0);
      
      if (totalChiTieu === 0) return 0;
      
      switch (viewMode) {
        case 'ty_le':
          // Tỷ lệ thực hiện: doanh thu (theo filter thời gian) / chỉ tiêu (tất cả 12 tháng) - khớp với bảng Chi tiết doanh thu
          return totalChiTieu > 0 ? totalDoanhThu / totalChiTieu : 0;
        case 'phan_tram_hoan_thanh_ca_nam':
          // % hoàn thành chỉ tiêu cả năm: doanh thu (theo filter thời gian) / chỉ tiêu (tất cả 12 tháng) - khớp với bảng Chi tiết doanh thu
          return (totalDoanhThu / totalChiTieu) * 100;
        case 'ty_le_co_gang':
          // Tính tỷ lệ cố gắng dựa trên tổng doanh thu và chỉ tiêu
          const totalDoanhThuThucHien = totalDoanhThu;
          const totalChiTieuConLai = totalChiTieu - totalDoanhThu;
          const totalSoThangCoDoanhThu = items.reduce((sum, item) => sum + item.so_thang_co_doanh_thu, 0);
          const soThangConLai = 12 - totalSoThangCoDoanhThu;
          const doanhThuConLaiTrungBinhThang = soThangConLai > 0 ? totalChiTieuConLai / soThangConLai : 0;
          const doanhThuThucHienTrungBinhThang = totalSoThangCoDoanhThu > 0 ? totalDoanhThuThucHien / totalSoThangCoDoanhThu : 0;
          return doanhThuThucHienTrungBinhThang > 0 ? (doanhThuConLaiTrungBinhThang / doanhThuThucHienTrungBinhThang) * 100 : 0;
        default:
          return 0;
      }
    }
  };

  // Hàm sort cho business units dựa trên tổng giá trị cột
  const sortBusinessUnits = (direction: 'asc' | 'desc') => {
    const sorted = [...businessUnits].sort((a, b) => {
      const totalA = getColumnTotal(a);
      const totalB = getColumnTotal(b);
      
      if (direction === 'asc') {
        return totalA - totalB;
      } else {
        return totalB - totalA;
      }
    });
    setBusinessUnits(sorted);
    generateHeatmapData(matrixData, sorted, khoiDTQLs, viewMode);
  };

  // Hàm sort cho khoi DTQL dựa trên tổng giá trị hàng
  const sortKhoiDTQLs = (direction: 'asc' | 'desc') => {
    const sorted = [...khoiDTQLs].sort((a, b) => {
      const totalA = getRowTotal(a);
      const totalB = getRowTotal(b);
      
      if (direction === 'asc') {
        return totalA - totalB;
      } else {
        return totalB - totalA;
      }
    });
    setKhoiDTQLs(sorted);
    generateHeatmapData(matrixData, businessUnits, sorted, viewMode);
  };

  // Hàm lấy giá trị theo viewMode
  const getValueByViewMode = (item: MatrixData) => {
    switch (viewMode) {
      case 'doanh_thu':
        return item.doanh_thu;
      case 'ty_le':
        return item.ty_le_thuc_hien;
      case 'phan_tram_hoan_thanh_ca_nam':
        return item.phan_tram_hoan_thanh_chi_tieu_ca_nam;
      case 'ty_le_co_gang':
        return item.ty_le_co_gang;
      default:
        return 0;
    }
  };

  // Hàm sort cho một cột địa điểm cụ thể
  const sortByColumn = (businessUnit: string, direction: 'asc' | 'desc') => {
    const sorted = [...khoiDTQLs].sort((a, b) => {
      const itemA = matrixData.find(item => item.business_unit === businessUnit && item.khoi_dtql === a);
      const itemB = matrixData.find(item => item.business_unit === businessUnit && item.khoi_dtql === b);
      
      const valueA = itemA ? getValueByViewMode(itemA) : 0;
      const valueB = itemB ? getValueByViewMode(itemB) : 0;
      
      if (direction === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    setKhoiDTQLs(sorted);
    generateHeatmapData(matrixData, businessUnits, sorted, viewMode);
  };

  // Hàm sort cho một hàng khối DTQL cụ thể
  const sortByRow = (khoiDTQL: string, direction: 'asc' | 'desc') => {
    const sorted = [...businessUnits].sort((a, b) => {
      const itemA = matrixData.find(item => item.business_unit === a && item.khoi_dtql === khoiDTQL);
      const itemB = matrixData.find(item => item.business_unit === b && item.khoi_dtql === khoiDTQL);
      
      const valueA = itemA ? getValueByViewMode(itemA) : 0;
      const valueB = itemB ? getValueByViewMode(itemB) : 0;
      
      if (direction === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    setBusinessUnits(sorted);
    generateHeatmapData(matrixData, sorted, khoiDTQLs, viewMode);
  };

  // Hàm xử lý click sort
  const handleSort = (key: 'business_unit' | 'khoi_dtql' | string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc'); // Mặc định sort giảm dần cho giá trị số
    }
    
    const newDirection = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    
    if (key === 'business_unit') {
      sortBusinessUnits(newDirection);
    } else if (key === 'khoi_dtql') {
      sortKhoiDTQLs(newDirection);
    } else {
      // Kiểm tra xem key có phải là tên khối DTQL không
      if (khoiDTQLs.includes(key)) {
        // Sort theo hàng khối DTQL cụ thể
        sortByRow(key, newDirection);
      } else {
        // Sort theo cột địa điểm cụ thể
        sortByColumn(key, newDirection);
      }
    }
  };

  // Hàm render icon sort giống bảng Chi tiết doanh thu
  const renderSortIcon = (key: 'business_unit' | 'khoi_dtql' | string) => {
    if (sortKey !== key) return <ArrowUpDown className="h-3 w-3 opacity-30 inline-block ml-1" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 text-primary inline-block ml-1" />;
    return <ArrowDown className="h-3 w-3 text-primary inline-block ml-1" />;
  };

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Ma Trận Doanh Thu
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Đang tải dữ liệu...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-base font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            Ma Trận Doanh Thu
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-center py-8 text-red-600">
            <p className="text-sm">Lỗi: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" />
              Ma Trận Doanh Thu
            </CardTitle>
            <CardDescription className="text-xs">
              Heatmap doanh thu theo địa điểm và khối DTQL • Click header để sắp xếp theo tổng giá trị hoặc theo cột/hàng cụ thể
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsModalOpen(true)}
            className="ml-2 h-8 w-8 p-0"
            title="Mở rộng Ma Trận Doanh Thu"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          <Button 
            size="sm" 
            variant={viewMode === 'doanh_thu' ? 'default' : 'outline'} 
            onClick={() => {
              setViewMode('doanh_thu');
              generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'doanh_thu');
            }}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Doanh thu
          </Button>
          <Button 
            size="sm" 
            variant={viewMode === 'ty_le' ? 'default' : 'outline'} 
            onClick={() => {
              setViewMode('ty_le');
              generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'ty_le');
            }}
          >
            <TrendingDown className="h-3 w-3 mr-1" />
            Tỷ lệ thực hiện
          </Button>
          <Button 
            size="sm" 
            variant={viewMode === 'phan_tram_hoan_thanh_ca_nam' ? 'default' : 'outline'} 
            onClick={() => {
              setViewMode('phan_tram_hoan_thanh_ca_nam');
              generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'phan_tram_hoan_thanh_ca_nam');
            }}
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            % Hoàn thành chỉ tiêu cả năm
          </Button>
          <Button 
            size="sm" 
            variant={viewMode === 'ty_le_co_gang' ? 'default' : 'outline'} 
            onClick={() => {
              setViewMode('ty_le_co_gang');
              generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'ty_le_co_gang');
            }}
          >
            <TrendingUp className="h-3 w-3 mr-1" />
            Tỷ lệ cố gắng
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="w-full h-[600px] overflow-auto border border-slate-200 rounded-lg bg-white">
          <div className="min-w-max">
            {/* Header với tên các địa điểm */}
            <div className="flex sticky top-0 z-20 bg-white shadow-sm">
              <div 
                className={cn(
                  'w-32 h-12 flex items-center justify-center text-sm font-bold bg-slate-200 border border-slate-300 text-slate-700 sticky left-0 z-30 shadow-sm cursor-pointer hover:bg-slate-300 transition-colors',
                  sortKey === 'khoi_dtql' && 'font-bold'
                )}
                onClick={() => handleSort('khoi_dtql')}
                title="Click để sắp xếp theo tổng giá trị hàng"
              >
                <span className="flex items-center">
                  Khối DTQL
                  {renderSortIcon('khoi_dtql')}
                </span>
              </div>
              {businessUnits.map(businessUnit => {
                const columnTotal = getColumnTotal(businessUnit);
                let displayTotal = '';
                switch (viewMode) {
                  case 'doanh_thu':
                    displayTotal = formatCurrency(columnTotal);
                    break;
                  case 'ty_le':
                    displayTotal = formatPercentage(columnTotal);
                    break;
                  case 'phan_tram_hoan_thanh_ca_nam':
                    displayTotal = `${columnTotal.toFixed(1)}%`;
                    break;
                  case 'ty_le_co_gang':
                    displayTotal = `${columnTotal.toFixed(1)}%`;
                    break;
                  default:
                    displayTotal = '0';
                }
                
                return (
                  <div 
                    key={businessUnit}
                    className={cn(
                      'w-28 h-12 flex flex-col items-center justify-center text-xs font-bold bg-slate-200 border border-slate-300 text-slate-700 text-center px-1 cursor-pointer hover:bg-slate-300 transition-colors relative',
                      sortKey === businessUnit && 'font-bold'
                    )}
                    title={`${businessUnit} - Tổng: ${displayTotal} - Click để sắp xếp theo cột này`}
                    onClick={() => handleSort(businessUnit)}
                  >
                    <span className="truncate max-w-full text-[10px] leading-tight">
                      {businessUnit}
                    </span>
                    <span className="text-[9px] text-slate-600 font-semibold">
                      {displayTotal}
                    </span>
                    <span className="absolute top-0 right-0">
                      {renderSortIcon(businessUnit)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Các hàng với dữ liệu */}
            {khoiDTQLs.map(khoiDTQL => {
              const rowTotal = getRowTotal(khoiDTQL);
              let displayTotal = '';
              switch (viewMode) {
                case 'doanh_thu':
                  displayTotal = formatCurrency(rowTotal);
                  break;
                case 'ty_le':
                  displayTotal = formatPercentage(rowTotal);
                  break;
                case 'phan_tram_hoan_thanh_ca_nam':
                  displayTotal = `${rowTotal.toFixed(1)}%`;
                  break;
                case 'ty_le_co_gang':
                  displayTotal = `${rowTotal.toFixed(1)}%`;
                  break;
                default:
                  displayTotal = '0';
              }
              
              return (
                <div key={khoiDTQL} className="flex hover:bg-slate-50/50 transition-colors">
                  <div 
                    className={cn(
                      'w-32 h-14 flex flex-col items-center justify-center text-xs font-bold bg-slate-100 border border-slate-300 text-slate-700 sticky left-0 z-10 shadow-sm cursor-pointer hover:bg-slate-200 transition-colors',
                      sortKey === khoiDTQL && 'font-bold'
                    )}
                    onClick={() => handleSort(khoiDTQL)}
                    title={`${khoiDTQL} - Tổng: ${displayTotal} - Click để sắp xếp theo hàng này`}
                  >
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <span className="text-center leading-tight px-1 text-[10px]">
                        {khoiDTQL}
                      </span>
                      <span className="text-[9px] text-slate-600 font-semibold">
                        {displayTotal}
                      </span>
                      <span className="absolute top-0 right-0">
                        {renderSortIcon(khoiDTQL)}
                      </span>
                    </div>
                  </div>
                {businessUnits.map(businessUnit => {
                  const cellData = heatmapData.find(
                    item => item.business_unit === businessUnit && item.khoi_dtql === khoiDTQL
                  );
                  
                  const value = cellData?.value || 0;
                  let displayValue = '';
                  switch (viewMode) {
                    case 'doanh_thu':
                      displayValue = formatCurrency(value);
                      break;
                    case 'ty_le':
                      displayValue = formatPercentage(value);
                      break;
                    case 'phan_tram_hoan_thanh_ca_nam':
                      displayValue = `${value.toFixed(1)}%`;
                      break;
                    case 'ty_le_co_gang':
                      displayValue = `${value.toFixed(1)}%`;
                      break;
                    default:
                      displayValue = '0';
                  }
                  
                  return (
                    <div
                      key={`${businessUnit}-${khoiDTQL}`}
                      className="w-28 h-14 flex items-center justify-center text-xs border border-slate-200 relative group cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all duration-200"
                      style={{ backgroundColor: cellData?.color || '#f8fafc' }}
                      title={`${businessUnit} - ${khoiDTQL}: ${displayValue}`}
                    >
                      <div className="font-semibold text-slate-800 text-center leading-tight px-1">
                        {displayValue}
                      </div>
                      {/* Tooltip hiển thị khi hover */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                        <div className="font-semibold">{businessUnit}</div>
                        <div className="text-slate-300">{khoiDTQL}</div>
                        <div className="text-yellow-300">{displayValue}</div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                  );
                })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="text-sm font-bold mb-3 text-slate-700">
              {viewMode === 'doanh_thu' ? '📊 Chú thích Doanh thu' : 
               viewMode === 'ty_le' ? '📈 Chú thích Tỷ lệ thực hiện' :
               viewMode === 'phan_tram_hoan_thanh_ca_nam' ? '📊 Chú thích % Hoàn thành chỉ tiêu cả năm' :
               '📈 Chú thích Tỷ lệ cố gắng'}
            </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-slate-200 border-2 border-slate-300 rounded"></div>
              <span className="text-slate-600">Không có dữ liệu</span>
            </div>
            {viewMode === 'doanh_thu' ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-200 border-2 border-blue-300 rounded"></div>
                  <span className="text-slate-600">Doanh thu thấp</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-400 border-2 border-blue-500 rounded"></div>
                  <span className="text-slate-600">Doanh thu trung bình</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 border-2 border-blue-700 rounded"></div>
                  <span className="text-slate-600">Doanh thu cao</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-red-500 border-2 border-red-600 rounded"></div>
                  <span className="text-slate-600">Tỷ lệ thấp (&lt;70%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-orange-500 border-2 border-orange-600 rounded"></div>
                  <span className="text-slate-600">Tỷ lệ cải thiện (70-95%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-yellow-500 border-2 border-yellow-600 rounded"></div>
                  <span className="text-slate-600">Tỷ lệ đạt mục tiêu (95-100%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-500 border-2 border-green-600 rounded"></div>
                  <span className="text-slate-600">Tỷ lệ vượt mục tiêu (100-110%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-green-700 border-2 border-green-800 rounded"></div>
                  <span className="text-slate-600">Tỷ lệ xuất sắc (&gt;110%)</span>
                </div>
              </>
            )}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            💡 <strong>Mẹo:</strong> Hover chuột vào các ô để xem thông tin chi tiết • Click header để sắp xếp theo tổng giá trị hoặc theo cột/hàng cụ thể
          </div>
        </div>
      </CardContent>

      {/* Modal mở rộng */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Ma Trận Doanh Thu - Xem Mở Rộng
              </DialogTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 mt-4 flex-wrap">
              <Button 
                size="sm" 
                variant={viewMode === 'doanh_thu' ? 'default' : 'outline'} 
                onClick={() => {
                  setViewMode('doanh_thu');
                  generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'doanh_thu');
                }}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Doanh thu
              </Button>
              <Button 
                size="sm" 
                variant={viewMode === 'ty_le' ? 'default' : 'outline'} 
                onClick={() => {
                  setViewMode('ty_le');
                  generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'ty_le');
                }}
              >
                <TrendingDown className="h-3 w-3 mr-1" />
                Tỷ lệ thực hiện
              </Button>
              <Button 
                size="sm" 
                variant={viewMode === 'phan_tram_hoan_thanh_ca_nam' ? 'default' : 'outline'} 
                onClick={() => {
                  setViewMode('phan_tram_hoan_thanh_ca_nam');
                  generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'phan_tram_hoan_thanh_ca_nam');
                }}
              >
                <BarChart3 className="h-3 w-3 mr-1" />
                % Hoàn thành chỉ tiêu cả năm
              </Button>
              <Button 
                size="sm" 
                variant={viewMode === 'ty_le_co_gang' ? 'default' : 'outline'} 
                onClick={() => {
                  setViewMode('ty_le_co_gang');
                  generateHeatmapData(matrixData, businessUnits, khoiDTQLs, 'ty_le_co_gang');
                }}
              >
                <TrendingUp className="h-3 w-3 mr-1" />
                Tỷ lệ cố gắng
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-hidden p-6 pt-2">
            <div className="w-full h-[calc(100vh-200px)] overflow-auto border border-slate-200 rounded-lg bg-white">
              <div className="min-w-max">
                {/* Header với tên các địa điểm */}
                <div className="flex sticky top-0 z-20 bg-white shadow-sm">
                  <div 
                    className={cn(
                      'w-40 h-14 flex items-center justify-center text-sm font-bold bg-slate-200 border border-slate-300 text-slate-700 sticky left-0 z-30 shadow-sm cursor-pointer hover:bg-slate-300 transition-colors',
                      sortKey === 'khoi_dtql' && 'font-bold'
                    )}
                    onClick={() => handleSort('khoi_dtql')}
                    title="Click để sắp xếp theo tổng giá trị hàng"
                  >
                    <span className="flex items-center">
                      Khối DTQL
                      {renderSortIcon('khoi_dtql')}
                    </span>
                  </div>
                  {businessUnits.map(businessUnit => {
                    const columnTotal = getColumnTotal(businessUnit);
                    let displayTotal = '';
                    switch (viewMode) {
                      case 'doanh_thu':
                        displayTotal = formatCurrency(columnTotal);
                        break;
                      case 'ty_le':
                        displayTotal = formatPercentage(columnTotal);
                        break;
                      case 'phan_tram_hoan_thanh_ca_nam':
                        displayTotal = `${columnTotal.toFixed(1)}%`;
                        break;
                      case 'ty_le_co_gang':
                        displayTotal = `${columnTotal.toFixed(1)}%`;
                        break;
                      default:
                        displayTotal = '0';
                    }
                    
                    return (
                      <div 
                        key={businessUnit}
                        className={cn(
                          'w-36 h-14 flex flex-col items-center justify-center text-xs font-bold bg-slate-200 border border-slate-300 text-slate-700 text-center px-1 cursor-pointer hover:bg-slate-300 transition-colors relative',
                          sortKey === businessUnit && 'font-bold'
                        )}
                        title={`${businessUnit} - Tổng: ${displayTotal} - Click để sắp xếp theo cột này`}
                        onClick={() => handleSort(businessUnit)}
                      >
                        <span className="truncate max-w-full text-[11px] leading-tight">
                          {businessUnit}
                        </span>
                        <span className="text-[10px] text-slate-600 font-semibold">
                          {displayTotal}
                        </span>
                        <span className="absolute top-0 right-0">
                          {renderSortIcon(businessUnit)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Các hàng với dữ liệu */}
                {khoiDTQLs.map(khoiDTQL => {
                  const rowTotal = getRowTotal(khoiDTQL);
                  let displayTotal = '';
                  switch (viewMode) {
                    case 'doanh_thu':
                      displayTotal = formatCurrency(rowTotal);
                      break;
                    case 'ty_le':
                      displayTotal = formatPercentage(rowTotal);
                      break;
                    case 'phan_tram_hoan_thanh_ca_nam':
                      displayTotal = `${rowTotal.toFixed(1)}%`;
                      break;
                    case 'ty_le_co_gang':
                      displayTotal = `${rowTotal.toFixed(1)}%`;
                      break;
                    default:
                      displayTotal = '0';
                  }
                  
                  return (
                    <div key={khoiDTQL} className="flex hover:bg-slate-50/50 transition-colors">
                      <div 
                        className={cn(
                          'w-40 h-16 flex flex-col items-center justify-center text-xs font-bold bg-slate-100 border border-slate-300 text-slate-700 sticky left-0 z-10 shadow-sm cursor-pointer hover:bg-slate-200 transition-colors',
                          sortKey === khoiDTQL && 'font-bold'
                        )}
                        onClick={() => handleSort(khoiDTQL)}
                        title={`${khoiDTQL} - Tổng: ${displayTotal} - Click để sắp xếp theo hàng này`}
                      >
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                          <span className="text-center leading-tight px-1 text-[11px]">
                            {khoiDTQL}
                          </span>
                          <span className="text-[10px] text-slate-600 font-semibold">
                            {displayTotal}
                          </span>
                          <span className="absolute top-0 right-0">
                            {renderSortIcon(khoiDTQL)}
                          </span>
                        </div>
                      </div>
                      {businessUnits.map(businessUnit => {
                        const cellData = heatmapData.find(
                          item => item.business_unit === businessUnit && item.khoi_dtql === khoiDTQL
                        );
                        
                        const value = cellData?.value || 0;
                        let displayValue = '';
                        switch (viewMode) {
                          case 'doanh_thu':
                            displayValue = formatCurrency(value);
                            break;
                          case 'ty_le':
                            displayValue = formatPercentage(value);
                            break;
                          case 'phan_tram_hoan_thanh_ca_nam':
                            displayValue = `${value.toFixed(1)}%`;
                            break;
                          case 'ty_le_co_gang':
                            displayValue = `${value.toFixed(1)}%`;
                            break;
                          default:
                            displayValue = '0';
                        }
                        
                        return (
                          <div
                            key={`${businessUnit}-${khoiDTQL}`}
                            className="w-36 h-16 flex items-center justify-center text-xs border border-slate-200 relative group cursor-pointer hover:border-slate-400 hover:shadow-sm transition-all duration-200"
                            style={{ backgroundColor: cellData?.color || '#f8fafc' }}
                            title={`${businessUnit} - ${khoiDTQL}: ${displayValue}`}
                          >
                            <div className="font-semibold text-slate-800 text-center leading-tight px-1">
                              {displayValue}
                            </div>
                            {/* Tooltip hiển thị khi hover */}
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                              <div className="font-semibold">{businessUnit}</div>
                              <div className="text-slate-300">{khoiDTQL}</div>
                              <div className="text-yellow-300">{displayValue}</div>
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="text-sm font-bold mb-3 text-slate-700">
              {viewMode === 'doanh_thu' ? '📊 Chú thích Doanh thu' : 
               viewMode === 'ty_le' ? '📈 Chú thích Tỷ lệ thực hiện' :
               viewMode === 'phan_tram_hoan_thanh_ca_nam' ? '📊 Chú thích % Hoàn thành chỉ tiêu cả năm' :
               '📈 Chú thích Tỷ lệ cố gắng'}
            </div>
              <div className="flex flex-wrap items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-slate-200 border-2 border-slate-300 rounded"></div>
                  <span className="text-slate-600">Không có dữ liệu</span>
                </div>
                {viewMode === 'doanh_thu' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-blue-200 border-2 border-blue-300 rounded"></div>
                      <span className="text-slate-600">Doanh thu thấp</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-blue-400 border-2 border-blue-500 rounded"></div>
                      <span className="text-slate-600">Doanh thu trung bình</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-blue-600 border-2 border-blue-700 rounded"></div>
                      <span className="text-slate-600">Doanh thu cao</span>
                    </div>
                  </>
                ) : viewMode === 'ty_le' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-500 border-2 border-red-600 rounded"></div>
                      <span className="text-slate-600">Tỷ lệ thấp (&lt;70%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-500 border-2 border-orange-600 rounded"></div>
                      <span className="text-slate-600">Tỷ lệ cải thiện (70-95%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-yellow-500 border-2 border-yellow-600 rounded"></div>
                      <span className="text-slate-600">Tỷ lệ đạt mục tiêu (95-100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-500 border-2 border-green-600 rounded"></div>
                      <span className="text-slate-600">Tỷ lệ vượt mục tiêu (100-110%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-700 border-2 border-green-800 rounded"></div>
                      <span className="text-slate-600">Tỷ lệ xuất sắc (&gt;110%)</span>
                    </div>
                  </>
                ) : viewMode === 'phan_tram_hoan_thanh_ca_nam' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-600 border-2 border-red-700 rounded"></div>
                      <span className="text-slate-600">Hoàn thành rất thấp (&lt;50%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-500 border-2 border-red-600 rounded"></div>
                      <span className="text-slate-600">Hoàn thành thấp (50-70%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-500 border-2 border-orange-600 rounded"></div>
                      <span className="text-slate-600">Hoàn thành cải thiện (70-90%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-yellow-500 border-2 border-yellow-600 rounded"></div>
                      <span className="text-slate-600">Hoàn thành gần đạt mục tiêu (90-100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-500 border-2 border-green-600 rounded"></div>
                      <span className="text-slate-600">Hoàn thành đạt/vượt mục tiêu (100-110%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-700 border-2 border-green-800 rounded"></div>
                      <span className="text-slate-600">Hoàn thành xuất sắc (&gt;110%)</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-green-500 border-2 border-green-600 rounded"></div>
                      <span className="text-slate-600">Tốt - Cần cố gắng ít (&lt;50%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-yellow-500 border-2 border-yellow-600 rounded"></div>
                      <span className="text-slate-600">Khá tốt (50-80%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-orange-500 border-2 border-orange-600 rounded"></div>
                      <span className="text-slate-600">Trung bình (80-100%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-500 border-2 border-red-600 rounded"></div>
                      <span className="text-slate-600">Cần cố gắng nhiều (100-120%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-red-600 border-2 border-red-700 rounded"></div>
                      <span className="text-slate-600">Cần cố gắng rất nhiều (&gt;120%)</span>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                💡 <strong>Mẹo:</strong> Hover chuột vào các ô để xem thông tin chi tiết • Click header để sắp xếp theo tổng giá trị hoặc theo cột/hàng cụ thể
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
