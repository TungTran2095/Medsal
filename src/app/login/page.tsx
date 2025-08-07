"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/auth/LoginForm';
import { Loader2 } from 'lucide-react';

// Component con để sử dụng useSearchParams
function LoginContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Nếu đã đăng nhập, redirect về dashboard hoặc trang được yêu cầu
    if (user && !loading) {
      const redirectTo = searchParams.get('redirectedFrom') || '/';
      router.replace(redirectTo);
    }
  }, [user, loading, router, searchParams]);

  // Hiển thị loading trong khi kiểm tra auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang kiểm tra trạng thái đăng nhập...</p>
        </div>
      </div>
    );
  }

  // Nếu đã đăng nhập, không hiển thị form auth
  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-full mb-4">
            <span className="text-2xl font-bold text-primary-foreground">MS</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Med Sal</h1>
          <p className="text-muted-foreground">
            Hệ thống quản lý lương nội bộ
          </p>
        </div>

        {/* Auth Forms */}
        <LoginForm />

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>&copy; 2024 Med Sal. Tất cả quyền được bảo lưu.</p>
        </div>
      </div>
    </div>
  );
}

// Loading fallback cho Suspense
function LoginLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  );
}
