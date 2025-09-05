"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';

interface RevenueTargetData {
  ten_don_vi: string;
  chi_tieu: number;
}

interface RevenueTargetTableProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartmentsForDiadiem?: string[];
}

export default function RevenueTargetTable({ 
  selectedMonths, 
  selectedYear, 
  selectedDepartmentsForDiadiem 
}: RevenueTargetTableProps) {
  const [data, setData] = useState<RevenueTargetData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedYear) return;

    console.log('RevenueTargetTable - fetchData called with:', {
      selectedYear,
      selectedMonths,
      selectedDepartmentsForDiadiem
    });

    setIsLoading(true);
    setError(null);

    try {
      // Query dữ liệu chỉ tiêu doanh thu - LẤY TẤT CẢ 12 THÁNG
      let query = supabase
        .from('Doanh_thu')
        .select('"Tên Đơn vị", "Chỉ tiêu", "Năm", "Tháng"')
        .not('"Tên Đơn vị"', 'is', null)
        .not('"Chỉ tiêu"', 'is', null)
        .eq('"Năm"', selectedYear);

      // KHÔNG áp dụng filter tháng cho chỉ tiêu - lấy tất cả 12 tháng
      // Lấy chỉ tiêu của tất cả 12 tháng
      const monthFormats = Array.from({length: 12}, (_, i) => `Tháng ${String(i + 1).padStart(2, '0')}`);
      query = query.in('"Tháng"', monthFormats);

      // Áp dụng filter địa điểm nếu có
      if (selectedDepartmentsForDiadiem && selectedDepartmentsForDiadiem.length > 0) {
        console.log('Applying location filter:', selectedDepartmentsForDiadiem);
        query = query.in('"Tên Đơn vị"', selectedDepartmentsForDiadiem);
      } else {
        console.log('No location filter applied - getting all locations');
      }

      // Lấy tất cả dữ liệu bằng pagination
      const allData = [];
      let from = 0;
      const batchSize = 1000;
      let hasMoreData = true;

      console.log('Starting pagination to get all data...');
      
      while (hasMoreData) {
        const { data: batchData, error: queryError } = await query.range(from, from + batchSize - 1);
        
        if (queryError) {
          console.error("Supabase query error:", queryError);
          throw queryError;
        }
        
        if (!batchData || batchData.length === 0) {
          hasMoreData = false;
          break;
        }
        
        allData.push(...batchData);
        console.log(`Fetched batch ${Math.floor(from/batchSize) + 1}: ${batchData.length} records (total: ${allData.length})`);
        
        from += batchSize;
        
        // Nếu batch nhỏ hơn batchSize, có nghĩa là đã hết dữ liệu
        if (batchData.length < batchSize) {
          hasMoreData = false;
        }
      }
      
      const rawData = allData;
      console.log(`Total data fetched: ${rawData.length} records`);

      console.log('Revenue Target - Raw data count:', rawData?.length);
      console.log('Revenue Target - Sample data:', rawData?.slice(0, 3));
      
      // Debug: Kiểm tra dữ liệu Med Cầu Giấy
      const medCauGiayData = (rawData || []).filter((item: any) => 
        item['Tên Đơn vị'] === 'Med Cầu Giấy'
      );
      console.log('Med Cầu Giấy data count:', medCauGiayData.length);
      console.log('Med Cầu Giấy sample data:', medCauGiayData.slice(0, 5));
      
      // Debug: Tính tổng chỉ tiêu Med Cầu Giấy
      const medCauGiayTotal = medCauGiayData.reduce((sum, item) => 
        sum + (Number(item['Chỉ tiêu']) || 0), 0
      );
      console.log('Med Cầu Giấy total chi tieu:', medCauGiayTotal);
      
      // Debug: Kiểm tra xem có bao nhiêu tháng của Med Cầu Giấy
      const medCauGiayMonths = new Set(medCauGiayData.map(item => item['Tháng']));
      console.log('Med Cầu Giấy months:', Array.from(medCauGiayMonths).sort());
      console.log('Med Cầu Giấy months count:', medCauGiayMonths.size);

      // Tổng hợp dữ liệu theo địa điểm
      const aggregatedData = new Map<string, number>();
      
      (rawData || []).forEach((item: any) => {
        const tenDonVi = item['Tên Đơn vị'];
        const chiTieu = Number(item['Chỉ tiêu']) || 0;
        
        if (aggregatedData.has(tenDonVi)) {
          aggregatedData.set(tenDonVi, aggregatedData.get(tenDonVi)! + chiTieu);
        } else {
          aggregatedData.set(tenDonVi, chiTieu);
        }
      });

      // Chuyển đổi thành array và sắp xếp
      const processedData = Array.from(aggregatedData.entries())
        .map(([tenDonVi, chiTieu]) => ({
          ten_don_vi: tenDonVi,
          chi_tieu: chiTieu
        }))
        .sort((a, b) => b.chi_tieu - a.chi_tieu);

      console.log('Final processed data:', processedData);
      console.log('Med Cầu Giấy final result:', processedData.find(item => item.ten_don_vi === 'Med Cầu Giấy'));

      setData(processedData);
    } catch (err) {
      console.error("Error fetching revenue target data:", err);
      setError("Lỗi khi tải dữ liệu chỉ tiêu doanh thu");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, selectedYear, selectedDepartmentsForDiadiem]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(value);
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Lỗi tải dữ liệu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chỉ tiêu doanh thu theo địa điểm</CardTitle>
        <CardDescription>
          Hiển thị tổng chỉ tiêu doanh thu của các địa điểm kinh doanh (12 tháng)
          {selectedYear && ` - Năm ${selectedYear}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Đang tải dữ liệu...</span>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">STT</TableHead>
                  <TableHead>Địa điểm</TableHead>
                  <TableHead className="text-right">Chỉ tiêu doanh thu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item, index) => (
                    <TableRow key={item.ten_don_vi}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.ten_don_vi}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(item.chi_tieu)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
