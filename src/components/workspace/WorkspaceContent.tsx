
"use client";

import React, { useState, ChangeEvent, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2, LayoutDashboard, Database, Sun, Moon, ChevronDown, Filter as FilterIcon, GanttChartSquare, BarChartHorizontal } from "lucide-react"; // Updated icon
import type { PayrollEntry } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupabaseTableList from './SupabaseTableList';
import { Separator } from '@/components/ui/separator';
import TotalSalaryCard from '@/components/dashboard/TotalSalaryCard';
import TotalSalaryParttimeCard from '@/components/dashboard/TotalSalaryParttimeCard';
import RevenueCard from '@/components/dashboard/RevenueCard';
import SalaryToRevenueRatioCard from '@/components/dashboard/SalaryToRevenueRatioCard';
import CombinedMonthlyTrendChart from '@/components/charts/MonthlySalaryTrendChart';
import SalaryProportionPieChart from '@/components/charts/SalaryProportionPieChart';
import LocationSalaryRevenueChart from '@/components/charts/LocationSalaryRevenueColumnChart'; // Updated import name for clarity
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator as DMSR,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem as SidebarMenuItemComponent,
  SidebarMenuButton,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type WorkspaceView = 'dbManagement' | 'dashboard';
type DashboardTab = 'payrollOverview' | 'comparison'; 

interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: React.ElementType;
}

interface MonthOption {
  value: number;
  label: string;
}

const staticMonths: MonthOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: `Tháng ${String(i + 1).padStart(2, '0')}`,
}));


export default function WorkspaceContent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PayrollEntry[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<WorkspaceView>('dashboard');
  const { theme, toggleTheme } = useTheme();

  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>('payrollOverview');


  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
    { id: 'dbManagement', label: 'Quản Lý Cơ Sở Dữ Liệu', icon: Database },
  ];

  const fetchDistinctYears = useCallback(async () => {
    if (activeView !== 'dashboard') return;
    setIsLoadingYears(true);
    try {
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
          yearsData.push(...data.map(item => item[yearColumn]).filter(nam => nam !== null && nam !== undefined));
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
        if (sortedYears.length > 0 && selectedYear === null) { 
            setSelectedYear(sortedYears[0]);
        }
      } else {
         setAvailableYears([]);
      }
    } catch (error: any) {
      console.error("Error fetching distinct years:", error);
      toast({
        title: "Lỗi Tải Dữ Liệu Năm",
        description: "Không thể tải danh sách năm từ cơ sở dữ liệu.",
        variant: "destructive",
      });
      setAvailableYears([]);
    } finally {
      setIsLoadingYears(false);
    }
  }, [activeView, toast, selectedYear]);


  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchDistinctYears();
    }
  }, [activeView, fetchDistinctYears]);


  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type !== 'text/csv') {
        toast({
          title: "Loại Tệp Không Hợp Lệ",
          description: "Vui lòng tải lên tệp CSV.",
          variant: "destructive",
        });
        setSelectedFile(null);
        setParsedData([]);
        event.target.value = '';
        return;
      }
      setSelectedFile(file);
      parseCsv(file);
    } else {
      setSelectedFile(null);
      setParsedData([]);
    }
  };

  const parseCsv = (file: File) => {
    setIsLoadingCsv(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        const payrollEntries: PayrollEntry[] = data.map(row => ({
          employee_id: row['Employee ID'] || row['employee_id'] || '',
          employee_name: row['Employee Name'] || row['employee_name'] || '',
          salary: parseFloat(String(row['Salary'] || row['salary'] || row['tong_thu_nhap'] || '0').replace(/,/g, '')),
          pay_date: row['Pay Date'] || row['pay_date'] || '',
        })).filter(entry => entry.employee_id && entry.employee_name && entry.pay_date);

        if (payrollEntries.length === 0 && data.length > 0) {
          toast({
            title: "Lỗi Xử Lý CSV",
            description: "Không thể xử lý các mục hợp lệ. Kiểm tra tiêu đề CSV: 'Employee ID', 'Employee Name', 'Salary' (hoặc 'tong_thu_nhap'), 'Pay Date'.",
            variant: "destructive",
          });
        } else if (payrollEntries.length > 0) {
          toast({
            title: "Đã Xử Lý CSV",
            description: `${payrollEntries.length} mục được tìm thấy. Xem lại và tải lên.`,
          });
        }
        setParsedData(payrollEntries);
        setIsLoadingCsv(false);
      },
      error: (error) => {
        toast({
          title: "Lỗi Xử Lý CSV",
          description: error.message,
          variant: "destructive",
        });
        setIsLoadingCsv(false);
        setParsedData([]);
      }
    });
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast({
        title: "Không Có Dữ Liệu",
        description: "Không có dữ liệu để tải lên. Vui lòng chọn và xử lý tệp CSV trước.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const dataToUpload = parsedData.map(entry => {
        let payDateObj = null;
        let thang: string | null = null;
        let nam: number | null = null;

        if (entry.pay_date) {
          const datePartsDMY = entry.pay_date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
          const datePartsMDY = entry.pay_date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // M/D/YYYY or MM/DD/YYYY
          const dateISO = entry.pay_date.match(/^\d{4}-\d{2}-\d{2}/);

          if (dateISO) {
             payDateObj = new Date(entry.pay_date);
          } else if (datePartsDMY) { // Assuming D/M/YYYY or DD/MM/YYYY
            payDateObj = new Date(parseInt(datePartsDMY[3]), parseInt(datePartsDMY[2]) - 1, parseInt(datePartsDMY[1]));
          } else if (datePartsMDY) { // Assuming M/D/YYYY or MM/DD/YYYY
            payDateObj = new Date(parseInt(datePartsMDY[3]), parseInt(datePartsMDY[1]) - 1, parseInt(datePartsMDY[2]));
          } else {
             payDateObj = new Date(entry.pay_date);
          }

          if (payDateObj && !isNaN(payDateObj.getTime())) {
            const monthNumber = payDateObj.getMonth() + 1;
            thang = `Tháng ${String(monthNumber).padStart(2, '0')}`;
            nam = payDateObj.getFullYear();
          } else {
            console.warn(`Invalid date format for pay_date: ${entry.pay_date}. Setting thang and nam to null.`);
            payDateObj = null; 
            thang = null;
            nam = null;
          }
        }

        return {
          employee_id: entry.employee_id,
          employee_name: entry.employee_name,
          tong_thu_nhap: entry.salary, 
          pay_date: payDateObj ? payDateObj.toISOString().split('T')[0] : null,
          thang: thang,
          nam: nam,
        };
      });


      const { error } = await supabase
        .from('Fulltime') 
        .insert(dataToUpload);

      if (error) {
        throw error;
      }

      toast({
        title: "Tải Lên Thành Công",
        description: `${parsedData.length} mục lương đã được tải lên bảng 'Fulltime' của Supabase.`,
      });
      setParsedData([]);
      setSelectedFile(null);
      const fileInput = document.getElementById('payroll-csv-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      if (activeView === 'dashboard') {
          fetchDistinctYears();
      }

    } catch (error: any) {
      console.error("Supabase upload error:", error);
      toast({
        title: "Tải Lên Thất Bại",
        description: error.message || "Đã xảy ra lỗi không mong muốn trong quá trình tải lên.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

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

  const getFilterButtonLabel = () => {
    const yearText = selectedYear ? `Năm ${selectedYear}` : "Tất cả năm";
    
    let monthText;
    if (selectedMonths.length === 0 || selectedMonths.length === staticMonths.length) {
      monthText = "Tất cả tháng";
    } else if (selectedMonths.length === 1) {
      const month = staticMonths.find(m => m.value === selectedMonths[0]);
      monthText = month ? month.label : "1 tháng";
    } else {
      monthText = `${selectedMonths.length} tháng`;
    }
    return `${yearText} - ${monthText}`;
  };


  return (
    <SidebarProvider defaultOpen={false} >
      <Sidebar collapsible="icon">
        <SidebarHeader>
           <div className="flex items-center justify-between p-2">
            <span className="text-base font-semibold text-sidebar-primary group-data-[state=collapsed]:hidden">
              Không Gian Làm Việc
            </span>
            <SidebarTrigger className="h-7 w-7" />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-1 flex flex-col">
          <SidebarMenu className="flex-grow">
            {navItems.map(item => {
              const IconComponent = item.icon;
              return (
                <SidebarMenuItemComponent key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveView(item.id)}
                    isActive={activeView === item.id}
                    tooltip={{content: item.label, side: "right", align:"center"}}
                    size="sm"
                  >
                    <IconComponent className="h-4 w-4"/>
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItemComponent>
              );
            })}
          </SidebarMenu>
          <div className="mt-auto p-2 group-data-[state=expanded]:border-t group-data-[state=expanded]:border-sidebar-border">
            <div className="flex items-center justify-between group-data-[state=collapsed]:justify-center">
              <Label htmlFor="theme-toggle" className="text-xs text-sidebar-foreground group-data-[state=collapsed]:hidden">
                Giao Diện
              </Label>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-sidebar-foreground" />
                <Switch
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                  aria-label="Toggle theme"
                  className="h-5 w-9 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 [&>span]:h-4 [&>span]:w-4"
                />
                <Moon className="h-4 w-4 text-sidebar-foreground" />
              </div>
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="flex-grow overflow-y-auto p-0.5 md:p-1">
        <div className="space-y-1 h-full">
          {activeView === 'dbManagement' && (
            <>
              <Card className="w-full flex flex-col shadow-md rounded-lg">
                <CardHeader className="items-center border-b pb-2 pt-3">
                  <FileText className="h-5 w-5 mb-0.5 text-primary" />
                  <CardTitle className="text-base font-semibold">Nhập Bảng Lương CSV</CardTitle>
                  <CardDescription className="text-xs">Nhập dữ liệu lương từ tệp CSV và tải lên bảng 'Fulltime' của Supabase.</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col p-2 space-y-1">
                  <div className="space-y-0.5">
                    <label htmlFor="payroll-csv-input" className="text-xs font-medium">
                      Tải Lên Bảng Lương CSV
                    </label>
                    <Input
                      id="payroll-csv-input"
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isLoadingCsv || isUploading}
                      className="file:mr-2 file:py-1 file:px-1.5 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 h-8 text-xs"
                    />
                    {selectedFile && (
                      <p className="text-xs text-muted-foreground">
                        Đã chọn: {selectedFile.name}
                      </p>
                    )}
                  </div>

                  {parsedData.length > 0 && !isLoadingCsv && (
                    <div className="space-y-1 flex-grow flex flex-col min-h-[80px]">
                      <h3 className="text-sm font-semibold">Xem Trước Dữ Liệu (5 Hàng Đầu)</h3>
                      <div className="border rounded-md overflow-x-auto flex-grow">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="py-1 px-1.5 text-xs">Mã NV</TableHead>
                              <TableHead className="py-1 px-1.5 text-xs">Tên NV</TableHead>
                              <TableHead className="py-1 px-1.5 text-xs">Lương</TableHead>
                              <TableHead className="py-1 px-1.5 text-xs">Ngày Trả</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedData.slice(0, 5).map((entry, index) => (
                              <TableRow key={index}>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.employee_id}</TableCell>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.employee_name}</TableCell>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.salary.toFixed(0)}</TableCell>
                                <TableCell className="py-1 px-1.5 text-xs">{entry.pay_date}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {parsedData.length > 5 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Hiển thị 5 hàng đầu của {parsedData.length} tổng số mục.
                        </p>
                      )}
                    </div>
                  )}

                  {(isLoadingCsv && !parsedData.length) && (
                      <div className="flex flex-col items-center justify-center text-muted-foreground py-2 min-h-[50px]">
                          <Loader2 className="h-4 w-4 animate-spin mb-0.5" />
                          <p className="text-xs">Đang xử lý tệp...</p>
                      </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || isLoadingCsv || parsedData.length === 0}
                    className="w-full mt-auto text-xs py-1 h-8"
                  >
                    {isUploading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Tải Lên Bảng Fulltime Supabase
                  </Button>
                </CardContent>
              </Card>

              <Separator className="my-1"/>

              <SupabaseTableList />
            </>
          )}
          {activeView === 'dashboard' && (
             <Card className="shadow-md rounded-lg h-full flex flex-col">
              <CardHeader className="pb-3 pt-4 px-3 md:px-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-primary flex items-center gap-1.5">
                      <LayoutDashboard className="h-5 w-5" />
                       Phân Tích Lương & Doanh Thu Tổng Hợp
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9 text-sm min-w-[200px] justify-between px-3">
                          <div className="flex items-center gap-1.5 truncate">
                            <FilterIcon className="h-3.5 w-3.5 opacity-80 shrink-0" />
                            <span className="truncate" title={getFilterButtonLabel()}>{getFilterButtonLabel()}</span>
                          </div>
                          <ChevronDown className="ml-1 h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[280px]" align="end">
                        <DropdownMenuLabel className="text-sm">Chọn Năm</DropdownMenuLabel>
                        <DMSR />
                        <DropdownMenuRadioGroup
                          value={selectedYear === null ? "all" : String(selectedYear)}
                          onValueChange={(value) => {
                            setSelectedYear(value === "all" ? null : parseInt(value));
                          }}
                          className="p-1"
                        >
                          <DropdownMenuRadioItem value="all" disabled={isLoadingYears} className="text-xs">
                            Tất cả các năm
                          </DropdownMenuRadioItem>
                          {isLoadingYears && availableYears.length === 0 && (
                             <div className="px-2 py-1.5 text-xs text-muted-foreground">Đang tải năm...</div>
                          )}
                          {!isLoadingYears && availableYears.length === 0 && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">Không có dữ liệu năm.</div>
                          )}
                          {availableYears.map((year) => (
                            <DropdownMenuRadioItem key={year} value={String(year)} className="text-xs">
                              Năm {year}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        
                        <DMSR />
                        <DropdownMenuLabel className="text-sm">Chọn Tháng</DropdownMenuLabel>
                        <DMSR />
                        <ScrollArea className="max-h-[200px]">
                          <div className="p-1">
                            {staticMonths.map((month) => (
                              <DropdownMenuCheckboxItem
                                key={month.value}
                                checked={selectedMonths.includes(month.value)}
                                onCheckedChange={(checked) => handleMonthSelection(month.value, checked as boolean)}
                                className="text-xs"
                              >
                                {month.label}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </div>
                        </ScrollArea>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 px-3 md:px-4 pb-3 flex-grow flex flex-col overflow-hidden space-y-3">
                <Tabs value={activeDashboardTab} onValueChange={(value) => setActiveDashboardTab(value as DashboardTab)} className="flex-grow flex flex-col overflow-hidden">
                  <div className="flex justify-start">
                    <TabsList className="shrink-0">
                      <TabsTrigger value="payrollOverview" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <LayoutDashboard className="h-3.5 w-3.5"/> Tổng Quan Lương & Doanh Thu
                      </TabsTrigger>
                      <TabsTrigger value="comparison" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <GanttChartSquare className="h-3.5 w-3.5"/> So sánh cùng kỳ
                      </TabsTrigger>
                    </TabsList>
                  </div>
                  <TabsContent value="payrollOverview" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="grid gap-3 md:grid-cols-4">
                        <TotalSalaryCard selectedMonths={selectedMonths} selectedYear={selectedYear} />
                        <TotalSalaryParttimeCard selectedMonths={selectedMonths} selectedYear={selectedYear} />
                        <RevenueCard selectedMonths={selectedMonths} selectedYear={selectedYear} />
                        <SalaryToRevenueRatioCard selectedMonths={selectedMonths} selectedYear={selectedYear} /> 
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <CombinedMonthlyTrendChart selectedYear={selectedYear} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3"> 
                        <div className="md:col-span-1">
                           <SalaryProportionPieChart selectedMonths={selectedMonths} selectedYear={selectedYear} />
                        </div>
                        <div className="md:col-span-2">
                           <LocationSalaryRevenueChart selectedMonths={selectedMonths} selectedYear={selectedYear} />
                        </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="comparison" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <GanttChartSquare className="h-12 w-12 mb-4" />
                      <p className="text-lg font-medium">Trang So Sánh Cùng Kỳ</p>
                      <p className="text-sm">Nội dung cho trang này sẽ được phát triển.</p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

