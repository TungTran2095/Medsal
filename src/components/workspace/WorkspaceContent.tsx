
"use client";

import React, { useState, ChangeEvent, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2, LayoutDashboard, Database, Sun, Moon, ChevronDown, Filter } from "lucide-react";
import type { PayrollEntry } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupabaseTableList from './SupabaseTableList';
import { Separator } from '@/components/ui/separator';
import TotalSalaryCard from '@/components/dashboard/TotalSalaryCard';
import EmployeeCountCard from '@/components/dashboard/EmployeeCountCard';
import MonthlySalaryTrendChart from '@/components/charts/MonthlySalaryTrendChart';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
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

type WorkspaceView = 'dbManagement' | 'dashboard';

interface NavItem {
  id: WorkspaceView;
  label: string;
  icon: React.ElementType;
}

interface MonthOption {
  value: number;
  label: string;
}

interface YearMonthOption {
  year: number;
  months: MonthOption[];
}

export default function WorkspaceContent() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<PayrollEntry[]>([]);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<WorkspaceView>('dashboard');
  const { theme, toggleTheme } = useTheme();

  // State for hierarchical filter
  const [yearMonthOptions, setYearMonthOptions] = useState<YearMonthOption[]>([]);
  const [isLoadingFilterOptions, setIsLoadingFilterOptions] = useState<boolean>(true);
  const [detailedSelections, setDetailedSelections] = useState<Record<number, number[]>>({});

  // Derived states passed to cards (compatible with existing RPC logic)
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);


  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
    { id: 'dbManagement', label: 'Quản Lý Cơ Sở Dữ Liệu', icon: Database },
  ];

  const fetchHierarchicalFilterOptions = useCallback(async () => {
    if (activeView !== 'dashboard') return;
    setIsLoadingFilterOptions(true);
    try {
      const { data: yearData, error: yearError } = await supabase
        .from('Fulltime')
        .select('nam')
        .order('nam', { ascending: false });

      if (yearError) throw yearError;

      const distinctYears: number[] = yearData
        ? Array.from(new Set(yearData.map(item => item.nam as number))).filter(year => year != null).sort((a, b) => b - a)
        : [];

      const options: YearMonthOption[] = [];
      for (const year of distinctYears) {
        const { data: monthData, error: monthError } = await supabase
          .from('Fulltime')
          .select('thang')
          .eq('nam', year);

        if (monthError) throw monthError;

        const distinctMonthNumbers: number[] = monthData
          ? Array.from(
              new Set(
                monthData
                  .map(item => {
                    if (item.thang === null || item.thang === undefined) return null;
                    const monthStr = String(item.thang).trim();
                    const numericPart = monthStr.replace(/\D/g, '');
                    return numericPart ? parseInt(numericPart, 10) : null;
                  })
                  .filter(month => month !== null && !isNaN(month) && month >= 1 && month <= 12) as number[]
              )
            ).sort((a, b) => a - b)
          : [];
        
        options.push({
          year: year,
          months: distinctMonthNumbers.map(monthNum => ({
            value: monthNum,
            label: `Tháng ${String(monthNum).padStart(2, '0')}`
          }))
        });
      }
      setYearMonthOptions(options);
      // Set initial selection: latest year, all its months
      if (options.length > 0 && options[0].months.length > 0) {
        const latestYear = options[0].year;
        setDetailedSelections({ [latestYear]: options[0].months.map(m => m.value) });
      }

    } catch (error: any) {
      console.error("Error fetching hierarchical filter options:", error);
      toast({
        title: "Lỗi Tải Dữ Liệu Lọc",
        description: "Không thể tải các tùy chọn bộ lọc từ cơ sở dữ liệu.",
        variant: "destructive",
      });
      setYearMonthOptions([]);
    } finally {
      setIsLoadingFilterOptions(false);
    }
  }, [activeView, toast]);

  useEffect(() => {
    fetchHierarchicalFilterOptions();
  }, [fetchHierarchicalFilterOptions]);

  useEffect(() => {
    const newSelectedYears = Object.entries(detailedSelections)
      .filter(([, months]) => months.length > 0)
      .map(([year]) => parseInt(year));

    const newSelectedMonths = Array.from(
      new Set(Object.values(detailedSelections).flat())
    );
    
    setSelectedYears(newSelectedYears.length > 0 ? newSelectedYears : []); // Pass empty array if no years are effectively selected
    setSelectedMonths(newSelectedMonths.length > 0 ? newSelectedMonths : []); // Pass empty array if no months are effectively selected

  }, [detailedSelections]);


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
          const datePartsMDY = entry.pay_date.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); 
          const dateISO = entry.pay_date.match(/^\d{4}-\d{2}-\d{2}/); 

          if (dateISO) {
             payDateObj = new Date(entry.pay_date);
          } else if (datePartsDMY) { 
            payDateObj = new Date(parseInt(datePartsDMY[3]), parseInt(datePartsDMY[2]) - 1, parseInt(datePartsDMY[1]));
          } else if (datePartsMDY) { 
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
      fetchHierarchicalFilterOptions(); 

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

  const handleHierarchicalSelection = (year: number, monthValue: number | 'all_months_for_year', checked: boolean) => {
    setDetailedSelections(prev => {
      const newSelections = { ...prev };
      if (!newSelections[year]) {
        newSelections[year] = [];
      }

      const yearOption = yearMonthOptions.find(yo => yo.year === year);
      const allMonthsForYear = yearOption ? yearOption.months.map(m => m.value) : [];

      if (monthValue === 'all_months_for_year') {
        if (checked) {
          newSelections[year] = [...allMonthsForYear];
        } else {
          newSelections[year] = [];
        }
      } else {
        const monthIdx = newSelections[year].indexOf(monthValue);
        if (checked && monthIdx === -1) {
          newSelections[year].push(monthValue);
          newSelections[year].sort((a,b) => a-b);
        } else if (!checked && monthIdx !== -1) {
          newSelections[year].splice(monthIdx, 1);
        }
      }
      // Remove year if no months are selected for it
      if (newSelections[year].length === 0) {
        delete newSelections[year];
      }
      return newSelections;
    });
  };
  
  const getFilterSummaryText = () => {
    const selectedYearCount = Object.keys(detailedSelections).length;
    if (selectedYearCount === 0) return "Lọc theo Kỳ";
    
    let summaryParts: string[] = [];
    Object.entries(detailedSelections).forEach(([year, months]) => {
      if (months.length > 0) {
        const yearOption = yearMonthOptions.find(yo => yo.year === parseInt(year));
        const allMonthsForThisYear = yearOption ? yearOption.months.length : 0;
        if (months.length === allMonthsForThisYear && allMonthsForThisYear > 0) {
          summaryParts.push(`${year} (Tất cả tháng)`);
        } else {
           summaryParts.push(`${year} (${months.length} tháng)`);
        }
      }
    });
    if (summaryParts.length === 0) return "Lọc theo Kỳ";
    if (summaryParts.length > 2) return `${summaryParts.slice(0,2).join(', ')}...`;
    return summaryParts.join(', ');
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
                      Bảng Điều Khiển Lương
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-0.5">
                      Phân tích và tổng quan dữ liệu lương từ bảng 'Fulltime'.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9 text-sm min-w-[150px] justify-between">
                          <div className="flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 opacity-80" />
                            <span>{getFilterSummaryText()}</span>
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[280px]" align="end">
                        <DropdownMenuLabel>Lọc theo Kỳ</DropdownMenuLabel>
                        <DMSR />
                        {isLoadingFilterOptions ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Đang tải dữ liệu lọc...</div>
                        ) : yearMonthOptions.length === 0 ? (
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Không có dữ liệu để lọc.</div>
                        ) : (
                          <ScrollArea className="max-h-[300px]">
                            <div className="p-1">
                            {yearMonthOptions.map(yearOption => (
                              <React.Fragment key={yearOption.year}>
                                <DropdownMenuLabel className="px-2 pt-2 pb-1 text-xs font-semibold text-primary">{`Năm ${yearOption.year}`}</DropdownMenuLabel>
                                {yearOption.months.length > 0 && (
                                    <DropdownMenuCheckboxItem
                                    key={`${yearOption.year}-all`}
                                    checked={
                                        detailedSelections[yearOption.year]?.length === yearOption.months.length &&
                                        yearOption.months.every(m => detailedSelections[yearOption.year]?.includes(m.value))
                                    }
                                    onCheckedChange={(checked) => handleHierarchicalSelection(yearOption.year, 'all_months_for_year', checked as boolean)}
                                    className="text-xs"
                                    >
                                    Tất cả tháng ({yearOption.months.length})
                                    </DropdownMenuCheckboxItem>
                                )}
                                <DMSR className="my-1" />
                                {yearOption.months.map(month => (
                                  <DropdownMenuCheckboxItem
                                    key={`${yearOption.year}-${month.value}`}
                                    checked={detailedSelections[yearOption.year]?.includes(month.value) ?? false}
                                    onCheckedChange={(checked) => handleHierarchicalSelection(yearOption.year, month.value, checked as boolean)}
                                    className="text-xs ml-2"
                                  >
                                    {month.label}
                                  </DropdownMenuCheckboxItem>
                                ))}
                                {yearMonthOptions.indexOf(yearOption) < yearMonthOptions.length - 1 && <DMSR className="my-2" />}
                              </React.Fragment>
                            ))}
                            </div>
                          </ScrollArea>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 px-3 md:px-4 pb-3 flex-grow overflow-y-auto space-y-3">
                <div className="grid gap-3 md:grid-cols-4">
                    <TotalSalaryCard selectedMonths={selectedMonths} selectedYears={selectedYears} />
                    <EmployeeCountCard selectedMonths={selectedMonths} selectedYears={selectedYears} />
                </div>
                <div className="mt-0"> {/* Ensure chart is below cards */}
                    <MonthlySalaryTrendChart selectedYears={selectedYears} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


    