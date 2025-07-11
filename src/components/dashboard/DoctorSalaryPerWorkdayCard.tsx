import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, Divide, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function DoctorSalaryPerWorkdayCard() {
  const [salaryPerWorkday, setSalaryPerWorkday] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription] = useState<string>("Tháng/năm mới nhất");

  useEffect(() => {
    const fetchSalaryPerWorkday = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: rpcError } = await supabase.rpc('get_doctor_salary_per_workday_latest_year');
        if (rpcError) throw new Error(rpcError.message || 'Không thể tải lương/công bác sĩ.');
        setSalaryPerWorkday(typeof data === 'number' ? data : 0);
      } catch (err: any) {
        setError(err.message || 'Không thể tải lương/công bác sĩ.');
        setSalaryPerWorkday(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSalaryPerWorkday();
  }, []);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Lương/Công Bác Sĩ</CardTitle>
          <Divide className="h-4 w-4 text-muted-foreground" />
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
            Lỗi Lương/Công Bác Sĩ
          </CardTitle>
          <Divide className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const formattedSalaryPerWorkday = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(salaryPerWorkday ?? 0);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Lương/Công Bác Sĩ</CardTitle>
        <Divide className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-xl font-bold text-primary">
          {formattedSalaryPerWorkday}
        </div>
        <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
          Cho: {filterDescription}
        </CardDescription>
      </CardContent>
    </Card>
  );
} 