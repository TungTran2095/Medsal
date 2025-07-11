import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Banknote, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface DoctorSalaryCardProps {
  // Có thể mở rộng props nếu cần filter
}

export default function DoctorSalaryCard({}: DoctorSalaryCardProps) {
  const [totalSalary, setTotalSalary] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription] = useState<string>("Năm mới nhất");

  useEffect(() => {
    const fetchDoctorSalary = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Gọi hàm RPC giả định: get_total_doctor_salary_latest_year
        // Hàm này cần trả về tổng tong_thu_nhap của bác sĩ fulltime trong năm mới nhất
        const { data, error: rpcError } = await supabase.rpc('get_total_doctor_salary_latest_year');
        if (rpcError) throw new Error(rpcError.message || 'Không thể tải tổng lương bác sĩ.');
        setTotalSalary(typeof data === 'number' ? data : 0);
      } catch (err: any) {
        setError(err.message || 'Không thể tải tổng lương bác sĩ.');
        setTotalSalary(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDoctorSalary();
  }, []);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Bác Sĩ</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-center h-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-destructive text-sm font-semibold flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" />
            Lỗi Dữ Liệu Lương Bác Sĩ
          </CardTitle>
          <Banknote className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (totalSalary === null || totalSalary === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Bác Sĩ</CardTitle>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-xl font-bold text-muted-foreground">
            0 VND
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate" title={filterDescription}>
            Không có dữ liệu cho: {filterDescription}.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  const formattedTotalSalary = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalSalary);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Lương Bác Sĩ</CardTitle>
        <Banknote className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-xl font-bold text-primary">
          {formattedTotalSalary}
        </div>
        <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
          Cho: {filterDescription}
        </CardDescription>
      </CardContent>
    </Card>
  );
} 