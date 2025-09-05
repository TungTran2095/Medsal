"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { Message } from '@/types';
import ChatHistory from '@/components/chat/ChatHistory';
import ChatInput from '@/components/chat/ChatInput';
import ChatHeader from '@/components/chat/ChatHeader';
import QuickSuggestions from '@/components/chat/QuickSuggestions';
import ChatbotFloatingButton from '@/components/chat/ChatbotFloatingButton';
import { echoUserInput } from '@/ai/flows/echo-user-input';
import type { EchoUserInputInput } from '@/ai/flows/echo-user-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { FilterIcon, ChevronDown, Circle, Loader2, LayoutDashboard, BarChart3, TrendingUp, DollarSign, Target, MapPin, CalendarDays } from "lucide-react";
import { supabase } from '@/lib/supabaseClient';
import Header from '@/components/layout/Header';
import RevenueCard from '@/components/dashboard/RevenueCard';
import RevenuePerFTEmployeeCard from '@/components/dashboard/RevenuePerFTEmployeeCard';
import RevenuePerWorkdayCard from '@/components/dashboard/RevenuePerWorkdayCard';
import LocationSalaryRevenueColumnChart from '@/components/charts/LocationSalaryRevenueColumnChart';
import TargetRevenueChart from '@/components/charts/TargetRevenueChart';
import TargetRevenueCumulativeChart from '@/components/charts/TargetRevenueCumulativeChart';
import TargetRevenueCumulativeChartByKhoi from '@/components/charts/TargetRevenueCumulativeChartByKhoi';
import TargetRevenueChartByKhoi from '@/components/charts/TargetRevenueChartByKhoi';
import RevenueDetailTable from '@/components/workspace/RevenueDetailTable';
import RevenueDetailTableByKhoi from '@/components/workspace/RevenueDetailTableByKhoi';
import RevenueMatrixHeatmap from '@/components/charts/RevenueMatrixHeatmap';
import RevenueMonthlyLineChart from '@/components/charts/RevenueMonthlyLineChart';
import ComparisonRevenueCard from '@/components/comparison/ComparisonRevenueCard';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator as DMSR,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfigError from "@/components/ui/ConfigError";

type DashboardTab = 'revenueOverview' | 'revenueAnalysis' | 'revenueMatrix';

interface MonthOption {
  value: number;
  label: string;
}

const staticMonths: MonthOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tháng ${String(i + 1).padStart(2, '0')}`,
}));

export default function RevenueDashboardPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [configError, setConfigError] = useState<string | null>(null);

  // Chatbot states
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatbotLoading, setIsChatbotLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('');
  const [searchValue, setSearchValue] = useState('');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [availableLocationTypes, setAvailableLocationTypes] = useState<string[]>([]);
  const [availableDepartmentsByLoai, setAvailableDepartmentsByLoai] = useState<Record<string, string[]>>({});
  const [selectedDepartmentsByLoai, setSelectedDepartmentsByLoai] = useState<string[]>([]);
  const [isLoadingLocationFilters, setIsLoadingLocationFilters] = useState<boolean>(false);
  const [locationFilterError, setLocationFilterError] = useState<string | null>(null);

  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>('revenueOverview');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    // Initialize welcome message only if authenticated
    if (user) {
      setMessages([
        {
          id: 'welcome-' + Date.now(),
          text: "Xin chào! Tôi là AI Assistant chuyên về phân tích doanh thu. Hãy hỏi tôi về dữ liệu doanh thu, KPI, hoặc bất cứ điều gì khác!",
          sender: 'ai',
          timestamp: Date.now(),
        },
      ]);
    }
  }, [user, loading, router]);

  const fetchDistinctYears = useCallback(async () => {
    setIsLoadingYears(true);
    try {
      // Kiểm tra cấu hình Supabase
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setConfigError('Environment variables cho Supabase chưa được cấu hình');
        return;
      }

      let yearsData: (number | string)[] = [];
      const tablesToQuery = ['Fulltime', 'Parttime', 'Doanh_thu'];
      const yearColumns = {
        'Fulltime': 'nam',
        'Parttime': 'Nam',
        'Doanh_thu': 'Năm'
      };

      for (const tableName of tablesToQuery) {
        const yearColumn = yearColumns[tableName as keyof typeof yearColumns];
        const { data, error } = await supabase.from(tableName).select(yearColumn);

        if (error && !String(error.message).toLowerCase().includes(`relation "${tableName.toLowerCase()}" does not exist`)) {
           console.warn(`Error fetching years from ${tableName} using column ${yearColumn}:`, error);
        }
        if (data && data.length > 0) {
          yearsData.push(...data.map((item: any) => item[yearColumn]).filter((nam: any) => nam !== null && nam !== undefined));
        }
      }

      if (yearsData.length > 0) {
        const yearSet = new Set<number>();
        yearsData.forEach(namValue => {
          if (!isNaN(Number(namValue))) {
            yearSet.add(Number(namValue));
          }
        });
        const sortedYears = Array.from(yearSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);

        if (sortedYears.length > 0) {
            if (selectedYear === null || !sortedYears.includes(selectedYear)) {
                 setSelectedYear(sortedYears[0]);
            }
        } else {
            setSelectedYear(null);
            setAvailableYears([]);
        }

      } else {
         setAvailableYears([]);
         setSelectedYear(null);
      }
    } catch (error: any) {
      console.error("Error fetching distinct years:", error);
      toast({
        title: "Lỗi Tải Dữ Liệu Năm",
        description: "Không thể tải danh sách năm từ cơ sở dữ liệu.",
        variant: "destructive",
      });
      setAvailableYears([]);
      setSelectedYear(null);
    } finally {
      setIsLoadingYears(false);
    }
  }, [toast]);

  const fetchLocationFilterOptions = useCallback(async () => {
    setIsLoadingLocationFilters(true);
    setLocationFilterError(null);
    try {
      const { data: loaiData, error: loaiError } = await supabase
        .from('MS_Org_Diadiem')
        .select('Loại')
        .eq('Division', 'Company');

      if (loaiError) throw loaiError;

      const distinctLoai = [...new Set(loaiData?.map((item: any) => item.Loại).filter(Boolean) as string[])].sort();
      setAvailableLocationTypes(distinctLoai);

      const deptsByLoai: Record<string, string[]> = {};
      for (const loai of distinctLoai) {
        const { data: deptData, error: deptError } = await supabase
          .from('MS_Org_Diadiem')
          .select('Department')
          .eq('Division', 'Company')
          .eq('Loại', loai);
        if (deptError) throw deptError;
        deptsByLoai[loai] = [...new Set(deptData?.map((item: any) => item.Department).filter(Boolean) as string[])].sort();
      }
      setAvailableDepartmentsByLoai(deptsByLoai);

    } catch (err: any) {
      console.error("Error fetching location filter options:", err);
      const errorMessage = err.message || "Không thể tải tùy chọn lọc địa điểm.";
      setLocationFilterError(errorMessage);
      if (String(errorMessage).toLowerCase().includes("ms_org_diadiem") && String(errorMessage).toLowerCase().includes("does not exist")) {
         setLocationFilterError("Bảng 'MS_Org_Diadiem' không tồn tại. Vui lòng tạo bảng này để sử dụng bộ lọc địa điểm.");
      } else {
        toast({
          title: "Lỗi Tải Lọc Địa Điểm",
          description: errorMessage,
          variant: "destructive",
        });
      }
      setAvailableLocationTypes([]);
      setAvailableDepartmentsByLoai({});
    } finally {
      setIsLoadingLocationFilters(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDistinctYears();
    fetchLocationFilterOptions();
  }, [fetchDistinctYears, fetchLocationFilterOptions]);

  const handleMonthSelection = (monthValue: number, checked: boolean) => {
    setSelectedMonths(prev => {
      const newSelectedMonths = new Set(prev);
      if (checked) {
        newSelectedMonths.add(monthValue);
      } else {
        newSelectedMonths.delete(monthValue);
      }
      return Array.from(newSelectedMonths).sort((a, b) => a - b);
    });
  };

  const handleAllMonthsSelection = (yearForContext: number | null, checked: boolean) => {
    setSelectedYear(yearForContext);
    if (checked) {
      setSelectedMonths(staticMonths.map(m => m.value));
    } else {
      setSelectedMonths([]);
    }
  };

  const getTimeFilterButtonLabel = () => {
    const yearText = selectedYear === null ? "Tất cả năm" : `Năm ${selectedYear}`;
    let monthText;
    if (selectedMonths.length === 0) {
        monthText = "Không chọn tháng";
    } else if (selectedMonths.length === staticMonths.length) {
      monthText = "Tất cả tháng";
    } else if (selectedMonths.length === 1) {
      const month = staticMonths.find(m => m.value === selectedMonths[0]);
      monthText = month ? month.label : "1 tháng";
    } else {
      monthText = `${selectedMonths.length} tháng`;
    }
    return `${yearText} - ${monthText}`;
  };

  const handleDepartmentByLoaiSelection = (loai: string, department: string, checked: boolean) => {
    const departmentIdentifier = `${loai}__${department}`;
    setSelectedDepartmentsByLoai(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        newSelected.add(departmentIdentifier);
      } else {
        newSelected.delete(departmentIdentifier);
      }
      return Array.from(newSelected);
    });
  };

  const handleSelectAllDepartmentsForLoai = (loai: string, checked: boolean) => {
    const departmentsInLoai = availableDepartmentsByLoai[loai] || [];
    const departmentIdentifiersInLoai = departmentsInLoai.map(dept => `${loai}__${dept}`);

    setSelectedDepartmentsByLoai(prev => {
      const newSelected = new Set(prev);
      if (checked) {
        departmentIdentifiersInLoai.forEach(id => newSelected.add(id));
      } else {
        departmentIdentifiersInLoai.forEach(id => newSelected.delete(id));
      }
      return Array.from(newSelected);
    });
  };

  const areAllDepartmentsSelectedForLoai = (loai: string): boolean => {
    const departmentsInLoai = availableDepartmentsByLoai[loai] || [];
    if (departmentsInLoai.length === 0) return false;
    return departmentsInLoai.every(dept => selectedDepartmentsByLoai.includes(`${loai}__${dept}`));
  };

  const getLocationFilterButtonLabel = () => {
    if (selectedDepartmentsByLoai.length === 0) {
      return "Tất cả địa điểm";
    }

    const activeLoai = new Set<string>();
    selectedDepartmentsByLoai.forEach(deptId => {
      const [loai] = deptId.split('__');
      activeLoai.add(loai);
    });

    const loaiCount = activeLoai.size;
    const deptCount = selectedDepartmentsByLoai.length;

    let label = "";
    if (loaiCount > 0) {
      label += `${loaiCount} Loại`;
    }
    if (deptCount > 0) {
      if (label) label += ", ";
      label += `${deptCount} P.ban`;
    }
    return label || "Chọn địa điểm";
  };

  const selectedDepartmentsFromLoaiFilter = useMemo(() => {
    return selectedDepartmentsByLoai.map(id => id.split('__')[1]).filter(Boolean);
  }, [selectedDepartmentsByLoai]);

  // Chatbot functions
  const handleSendMessage = async (text: string) => {
    if (!isChatbotOpen) setIsChatbotOpen(true);

    const newUserMessage: Message = {
      id: `user-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: Date.now(),
    };
    setMessages((prevMessages) => [...prevMessages, newUserMessage]);
    setIsChatbotLoading(true);

    try {
      const aiInput: EchoUserInputInput = {
        userInput: text,
        previousContext: conversationContext,
      };
      const aiResponse = await echoUserInput(aiInput);

      const newAiMessage: Message = {
        id: `ai-${Date.now()}`,
        text: aiResponse.echoedResponse,
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prevMessages) => [...prevMessages, newAiMessage]);
      
      setConversationContext(
        (prevCtx) => `${prevCtx}\nUser: ${text}\nAI: ${aiResponse.echoedResponse}`.slice(-2000)
      );

    } catch (error) {
      console.error('Error calling AI flow:', error);
      toast({
        title: "AI Error",
        description: "Oops! Something went wrong while talking to the AI. Please try again.",
        variant: "destructive",
      });
      const errorAiMessage: Message = {
        id: `ai-error-${Date.now()}`,
        text: "I'm having a little trouble responding right now. Please try sending your message again.",
        sender: 'ai',
        timestamp: Date.now(),
      };
      setMessages((prevMessages) => [...prevMessages, errorAiMessage]);
    } finally {
      setIsChatbotLoading(false);
    }
  };

  const toggleChatbot = () => {
    setIsChatbotOpen(!isChatbotOpen);
  };

  const handleClearChat = () => {
    setMessages([]);
    setConversationContext('');
    toast({
      title: "Đã xóa cuộc trò chuyện",
      description: "Cuộc trò chuyện đã được xóa thành công.",
    });
  };

  const handleExportChat = () => {
    const chatData = {
      messages: messages,
      exportedAt: new Date().toISOString(),
      totalMessages: messages.length
    };
    
    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    toast({
      title: "Xuất cuộc trò chuyện",
      description: "Cuộc trò chuyện đã được xuất thành công.",
    });
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  // Hiển thị lỗi cấu hình nếu có
  if (configError) {
    return <ConfigError type="supabase" message={configError} />;
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect in useEffect)
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col w-full h-full">
      <Header />
      <div className="flex flex-col w-full h-full p-0">
        <div className="w-full p-4 border-b bg-muted/30">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" asChild>
              <a href="/dashboard/salary">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Dashboard Lương
              </a>
            </Button>
            <Button variant="default" size="sm" asChild>
              <a href="/dashboard/revenue">
                <DollarSign className="h-4 w-4 mr-2" />
                Dashboard Doanh Thu
              </a>
            </Button>
          </div>
        </div>
        <div className="flex flex-col md:flex-row flex-1 w-full h-full p-0"> 
          <div className={cn(
            "w-full pt-0.5 pb-0.5 pl-0.5 pr-0 md:pt-1 md:pb-1 md:pl-1 md:pr-0.5 overflow-y-auto transition-all duration-300 ease-in-out",
            isChatbotOpen ? 'md:w-2/3' : 'md:flex-1'
          )}
          >
            <Card className="shadow-md rounded-lg h-full flex flex-col">
            <CardHeader className="pb-3 pt-4 px-3 md:px-4">
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-primary flex items-center gap-1.5">
                      <DollarSign className="h-5 w-5" />
                      Dashboard Doanh Thu
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      Phân tích chi tiết doanh thu theo thời gian, địa điểm và các chỉ số KPI. Bao gồm cả phân tích doanh thu lũy kế và theo tháng.
                    </CardDescription>
                  </div>

                <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 text-sm min-w-[200px] justify-between px-3">
                        <div className="flex items-center gap-1.5 truncate">
                          <CalendarDays className="h-3.5 w-3.5 opacity-80 shrink-0" />
                          <span className="truncate" title={getTimeFilterButtonLabel()}>{getTimeFilterButtonLabel()}</span>
                        </div>
                        <ChevronDown className="ml-1 h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[300px]" align="end">
                      <DropdownMenuLabel className="text-sm">Chọn Năm & Tháng</DropdownMenuLabel>
                      <DMSR />
                      <ScrollArea className="max-h-[380px]">
                        <div className="p-1">
                          <DropdownMenuSub key="all-years-sub-time">
                            <DropdownMenuSubTrigger
                              onSelect={(e) => e.preventDefault()}
                              className="text-xs pl-2 pr-1 py-1.5 w-full justify-start relative hover:bg-accent"
                            >
                              <span className="flex items-center gap-2">
                                {isMounted && selectedYear === null && <Circle className="h-2 w-2 fill-current text-primary" />}
                                {(!isMounted || (isMounted && selectedYear !== null)) && <span className="w-2 h-2 block ml-0.5 mr-[calc(0.5rem-2px)]"></span>}
                                Tất cả các năm
                              </span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-[220px]">
                              <DropdownMenuLabel className="text-xs">Chọn Tháng (cho Tất cả các năm)</DropdownMenuLabel>
                              <DMSR />
                              <ScrollArea className="max-h-[380px]">
                                <div className="p-1">
                                   <DropdownMenuCheckboxItem
                                      key="all-years-all-months-time"
                                      checked={selectedMonths.length === staticMonths.length}
                                      onCheckedChange={(checked) => handleAllMonthsSelection(null, checked as boolean)}
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-xs font-medium"
                                    >
                                      Tất cả các tháng
                                    </DropdownMenuCheckboxItem>
                                    <DMSR />
                                  {staticMonths.map((month) => (
                                    <DropdownMenuCheckboxItem
                                      key={`all-years-${month.value}-time`}
                                      checked={selectedMonths.includes(month.value)}
                                      onCheckedChange={(checked) => {
                                        setSelectedYear(null);
                                        handleMonthSelection(month.value, checked as boolean);
                                      }}
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-xs"
                                    >
                                      {month.label}
                                    </DropdownMenuCheckboxItem>
                                  ))}
                                </div>
                              </ScrollArea>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>

                          {isLoadingYears && availableYears.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">Đang tải năm...</div>
                          )}
                          {!isLoadingYears && availableYears.length === 0 && (
                             <div className="px-2 py-1.5 text-xs text-muted-foreground">Không có dữ liệu năm.</div>
                          )}
                          {availableYears.map((year) => (
                            <DropdownMenuSub key={`${year}-time`}>
                              <DropdownMenuSubTrigger
                                onSelect={(e) => e.preventDefault()}
                                className="text-xs pl-2 pr-1 py-1.5 w-full justify-start relative hover:bg-accent"
                              >
                                <span className="flex items-center gap-2">
                                   {isMounted && selectedYear === year && <Circle className="h-2 w-2 fill-current text-primary" />}
                                   {(!isMounted || (isMounted && selectedYear !== year)) && <span className="w-2 h-2 block ml-0.5 mr-[calc(0.5rem-2px)]"></span>}
                                  Năm {year}
                                </span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-[220px]">
                                <DropdownMenuLabel className="text-xs">Chọn Tháng (cho Năm {year})</DropdownMenuLabel>
                                <DMSR />
                                <ScrollArea className="max-h-[380px]">
                                  <div className="p-1">
                                     <DropdownMenuCheckboxItem
                                      key={`${year}-all-months-time`}
                                      checked={selectedMonths.length === staticMonths.length}
                                      onCheckedChange={(checked) => handleAllMonthsSelection(year, checked as boolean)}
                                      onSelect={(e) => e.preventDefault()}
                                      className="text-xs font-medium"
                                    >
                                      Tất cả các tháng
                                    </DropdownMenuCheckboxItem>
                                    <DMSR />
                                    {staticMonths.map((month) => (
                                      <DropdownMenuCheckboxItem
                                        key={`${year}-${month.value}-time`}
                                        checked={selectedMonths.includes(month.value)}
                                        onCheckedChange={(checked) => {
                                          setSelectedYear(year);
                                          handleMonthSelection(month.value, checked as boolean);
                                        }}
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-xs"
                                      >
                                        {month.label}
                                      </DropdownMenuCheckboxItem>
                                    ))}
                                  </div>
                                </ScrollArea>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          ))}
                        </div>
                      </ScrollArea>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9 text-sm min-w-[180px] justify-between px-3">
                        <div className="flex items-center gap-1.5 truncate">
                            <MapPin className="h-3.5 w-3.5 opacity-80 shrink-0" />
                            <span className="truncate" title={getLocationFilterButtonLabel()}>{getLocationFilterButtonLabel()}</span>
                        </div>
                        <ChevronDown className="ml-1 h-4 w-4 opacity-50 shrink-0" />
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[320px]" align="end">
                    <DropdownMenuLabel className="text-sm">Lọc theo Địa Điểm (Loại/Phòng ban)</DropdownMenuLabel>
                    <DMSR />
                    {isLoadingLocationFilters && (
                        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Đang tải địa điểm...
                        </div>
                    )}
                    {locationFilterError && !isLoadingLocationFilters && (
                         <div className="px-2 py-2 text-xs text-destructive bg-destructive/10 m-1 rounded-md">
                            <p className="font-medium">Lỗi tải địa điểm:</p>
                            <p>{locationFilterError}</p>
                            {locationFilterError.toLowerCase().includes("ms_org_diadiem") && (
                                <p className="mt-1 text-muted-foreground">Vui lòng đảm bảo bảng `MS_Org_Diadiem` tồn tại và có cột `Division`, `Loại`, `Department`.</p>
                            )}
                        </div>
                    )}
                    {!isLoadingLocationFilters && !locationFilterError && availableLocationTypes.length === 0 && (
                        <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                            Không có "Loại" địa điểm nào (với Division='Company').
                        </div>
                    )}
                    {!isLoadingLocationFilters && !locationFilterError && availableLocationTypes.length > 0 && (
                        <ScrollArea className="max-h-[380px]">
                        <div className="p-1 space-y-0.5">
                            {availableLocationTypes.map((loai) => (
                            <DropdownMenuSub key={loai}>
                                <DropdownMenuSubTrigger className="text-xs pl-2 pr-1 py-1.5 w-full justify-start hover:bg-accent">
                                {loai}
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="w-[250px]">
                                <DropdownMenuLabel className="text-xs">Phòng ban cho: {loai}</DropdownMenuLabel>
                                <DMSR />
                                <ScrollArea className="max-h-[300px]">
                                <div className="p-1">
                                {(availableDepartmentsByLoai[loai] || []).length > 0 ? (
                                    <>
                                    <DropdownMenuCheckboxItem
                                        key={`all-departments-${loai}`}
                                        checked={areAllDepartmentsSelectedForLoai(loai)}
                                        onCheckedChange={(checked) => handleSelectAllDepartmentsForLoai(loai, checked as boolean)}
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-xs font-medium"
                                    >
                                        Tất cả phòng ban ({loai})
                                    </DropdownMenuCheckboxItem>
                                    <DMSR />
                                    {(availableDepartmentsByLoai[loai] || []).map((dept) => (
                                        <DropdownMenuCheckboxItem
                                        key={`${loai}-${dept}`}
                                        checked={selectedDepartmentsByLoai.includes(`${loai}__${dept}`)}
                                        onCheckedChange={(checked) => handleDepartmentByLoaiSelection(loai, dept, checked as boolean)}
                                        onSelect={(e) => e.preventDefault()}
                                        className="text-xs"
                                        >
                                        {dept}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                    </>
                                ) : (
                                    <div className="px-2 py-2 text-xs text-muted-foreground">Không có phòng ban cho loại này.</div>
                                )}
                                </div>
                                </ScrollArea>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            ))}
                        </div>
                        </ScrollArea>
                    )}
                    </DropdownMenuContent>
                </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-3 px-3 md:px-4 pb-3 flex-grow flex flex-col overflow-hidden space-y-3">
              <Tabs value={activeDashboardTab} onValueChange={(value) => setActiveDashboardTab(value as DashboardTab)} className="flex-grow flex flex-col overflow-hidden">
                <div className="flex justify-start">
                  <TabsList className="shrink-0">
                    <TabsTrigger value="revenueOverview" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5"/> Tổng Quan & Phân Tích
                    </TabsTrigger>
                    <TabsTrigger value="revenueAnalysis" className="text-xs px-2.5 py-2.5 flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5"/> Doanh Thu Theo Khối
                    </TabsTrigger>
                    <TabsTrigger value="revenueMatrix" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                      <Target className="h-3.5 w-3.5"/> Ma Trận Doanh Thu
                    </TabsTrigger>

                  </TabsList>
                </div>

                {/* Tab: Tổng Quan & Phân Tích Doanh Thu */}
                <TabsContent value="revenueOverview" className="flex-grow overflow-y-auto space-y-3 mt-2">
                  <div className="grid gap-3 md:grid-cols-4">
                    <RevenueCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartments={selectedDepartmentsFromLoaiFilter} />
                    <RevenuePerFTEmployeeCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={[]} />
                    <RevenuePerWorkdayCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={[]} />
                    <ComparisonRevenueCard selectedMonths={selectedMonths} selectedDepartments={selectedDepartmentsFromLoaiFilter} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TargetRevenueCumulativeChart 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                    />
                    <TargetRevenueChart 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <RevenueMonthlyLineChart 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                      isCumulative={true}
                    />
                    <RevenueMonthlyLineChart 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                      isCumulative={false}
                    />
                  </div>
                  <RevenueDetailTable 
                    selectedMonths={selectedMonths} 
                    selectedYear={selectedYear} 
                    selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                    selectedNganhDoc={[]} 
                    selectedDonVi2={[]} 
                  />
                </TabsContent>

                {/* Tab: Doanh Thu Theo Khối */}
                <TabsContent value="revenueAnalysis" className="flex-grow overflow-y-auto space-y-3 mt-2">
                  <div className="grid gap-3 md:grid-cols-4">
                    <RevenueCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartments={selectedDepartmentsFromLoaiFilter} />
                    <RevenuePerFTEmployeeCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={[]} />
                    <RevenuePerWorkdayCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={[]} />
                    <ComparisonRevenueCard selectedMonths={selectedMonths} selectedDepartments={selectedDepartmentsFromLoaiFilter} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <TargetRevenueCumulativeChartByKhoi 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                    />
                    <TargetRevenueChartByKhoi 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <RevenueMonthlyLineChart 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                      isCumulative={true}
                    />
                    <RevenueMonthlyLineChart 
                      selectedMonths={selectedMonths} 
                      selectedYear={selectedYear} 
                      selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                      selectedNganhDoc={[]} 
                      selectedDonVi2={[]} 
                      isCumulative={false}
                    />
                  </div>
                  <RevenueDetailTableByKhoi 
                    selectedMonths={selectedMonths} 
                    selectedYear={selectedYear} 
                    selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                    selectedNganhDoc={[]} 
                    selectedDonVi2={[]} 
                  />
                </TabsContent>

                {/* Tab: Ma Trận Doanh Thu */}
                <TabsContent value="revenueMatrix" className="flex-grow overflow-y-auto space-y-3 mt-2">
                  <RevenueMatrixHeatmap 
                    selectedYear={selectedYear}
                    selectedMonths={selectedMonths}
                    selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                    selectedNganhDoc={[]}
                    selectedDonVi2={[]}
                  />
                </TabsContent>


              </Tabs>
            </CardContent>
          </Card>
          </div>

          {/* Chatbot Sidebar - Only show when open */}
          {isChatbotOpen && (
            <div className="w-full pt-0.5 pb-0.5 pr-0.5 pl-0 md:pt-1 md:pb-1 md:pr-1 md:pl-0.5 flex flex-col transition-all duration-300 ease-in-out overflow-hidden md:w-1/3">
              <div className="flex flex-col flex-1 bg-card text-foreground border rounded-lg shadow-soft-md overflow-hidden h-full min-h-[200px] md:min-h-0">
                <ChatHeader
                  isOpen={isChatbotOpen}
                  onToggle={toggleChatbot}
                  onClearChat={handleClearChat}
                  onExportChat={handleExportChat}
                  searchValue={searchValue}
                  onSearchChange={setSearchValue}
                  messageCount={messages.length}
                />
                
                <div 
                  id="chatbot-content-area"
                  className="flex flex-col flex-1 overflow-hidden transition-all duration-300 ease-in-out opacity-100 max-h-[100vh]"
                >
                  {messages.length === 0 && !isChatbotLoading && (
                    <QuickSuggestions 
                      onSuggestionClick={handleSuggestionClick} 
                      isLoading={isChatbotLoading} 
                    />
                  )}
                  <ChatHistory messages={messages} isLoading={isChatbotLoading} />
                  <ChatInput onSendMessage={handleSendMessage} isLoading={isChatbotLoading} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Floating Chatbot Button */}
      <ChatbotFloatingButton
        isOpen={isChatbotOpen}
        onToggle={toggleChatbot}
        messageCount={messages.length}
        hasUnreadMessages={false}
      />
    </div>
  );
}