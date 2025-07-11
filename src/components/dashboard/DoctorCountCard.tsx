import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, UserCheck, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface DoctorCountCardProps {
  selectedMonths?: number[];
  selectedYear?: number | null;
  selectedDepartmentsForDiadiem?: string[];
  selectedNganhDoc?: string[];
}

export default function DoctorCountCard({ selectedMonths, selectedYear, selectedDepartmentsForDiadiem, selectedNganhDoc }: DoctorCountCardProps) {
  const [doctorCount, setDoctorCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDescription, setFilterDescription] = useState<string>("Kỳ tháng mới nhất");

  const fetchDoctorCount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_doctor_count_latest_fulltime');
      if (rpcError) throw new Error(rpcError.message || 'Không thể tải số lượng bác sĩ.');
      setDoctorCount(typeof data === 'number' ? data : 0);
    } catch (err: any) {
      setError(err.message || 'Không thể tải số lượng bác sĩ.');
      setDoctorCount(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDoctorCount();
  }, [fetchDoctorCount]);

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số Bác Sĩ</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
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
          <CardTitle className="text-sm font-semibold text-destructive">Lỗi Số Lượng Bác Sĩ</CardTitle>
          <AlertTriangle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent className="pt-2">
          <p className="text-xs text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (doctorCount === null || doctorCount === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số Bác Sĩ</CardTitle>
          <UserCheck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-2">
          <div className="text-xl font-bold text-muted-foreground">
            0
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5 truncate" title={filterDescription}>
            Không có bác sĩ nào cho: {filterDescription}.
          </CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Tổng Số Bác Sĩ</CardTitle>
        <UserCheck className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="text-xl font-bold text-primary">
          {doctorCount !== null ? doctorCount.toLocaleString('vi-VN') : 'N/A'}
        </div>
        <CardDescription className="text-xs text-muted-foreground truncate" title={filterDescription}>
          Cho: {filterDescription}
        </CardDescription>
      </CardContent>
    </Card>
  );
} 