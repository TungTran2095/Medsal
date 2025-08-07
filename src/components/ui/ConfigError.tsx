"use client";

import React from 'react';
import { AlertTriangle, Settings, Database } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface ConfigErrorProps {
  type: 'supabase' | 'database' | 'functions';
  message: string;
}

export default function ConfigError({ type, message }: ConfigErrorProps) {
  const getIcon = () => {
    switch (type) {
      case 'supabase':
        return <Database className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'functions':
        return <Settings className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'supabase':
        return 'Cấu hình Supabase chưa hoàn tất';
      case 'database':
        return 'Kết nối database có vấn đề';
      case 'functions':
        return 'Database functions chưa được tạo';
      default:
        return 'Lỗi cấu hình';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'supabase':
        return 'Vui lòng cấu hình environment variables cho Supabase. Xem file docs/setup.md để biết chi tiết.';
      case 'database':
        return 'Không thể kết nối đến database. Kiểm tra cấu hình và thử lại.';
      case 'functions':
        return 'Các SQL functions cần thiết chưa được tạo trong Supabase. Vui lòng chạy các functions từ file find_functions.sql và kpi_functions.sql.';
      default:
        return message;
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            {getIcon()}
          </div>
          <CardTitle className="text-xl font-semibold text-red-600 dark:text-red-400">
            {getTitle()}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Chi tiết lỗi</AlertTitle>
            <AlertDescription className="text-sm">
              {message}
            </AlertDescription>
          </Alert>
          
          <div className="text-center space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open('/docs/setup.md', '_blank')}
            >
              Xem hướng dẫn cấu hình
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.location.reload()}
            >
              Thử lại
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
