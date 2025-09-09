"use client";

import React, { useState, ChangeEvent, useEffect, useCallback, useMemo } from 'react';
import Papa from 'papaparse';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Loader2, LayoutDashboard, Database, Sun, Moon, ChevronDown, FilterIcon, GanttChartSquare, MapPin, Settings2, Circle, Percent, Target, FolderKanban, BarChart3, Filter as FilterIconLucide, Briefcase, ListChecks, UserCheck, Users, LineChart, Banknote, ScatterChart as ScatterChartIconLucide, CalendarDays, UsersRound, AlertTriangle, DollarSign } from "lucide-react";
import type { PayrollEntry, FlatOrgUnit, OrgNode } from '@/types';
import { supabase } from '@/lib/supabaseClient';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SupabaseTableList from './SupabaseTableList';
import AiToolsViewer from './AiToolsViewer';
import HierarchicalOrgFilter from './HierarchicalOrgFilter';
import { Separator } from '@/components/ui/separator';
import TotalSalaryCard from '@/components/dashboard/TotalSalaryCard';
import TotalSalaryParttimeCard from '@/components/dashboard/TotalSalaryParttimeCard';
import RevenueCard from '@/components/dashboard/RevenueCard';
import SalaryToRevenueRatioCard from '@/components/dashboard/SalaryToRevenueRatioCard';
import CombinedMonthlyTrendChart from '@/components/charts/MonthlySalaryTrendChart';
import SalaryProportionPieChart from '@/components/charts/SalaryProportionPieChart';
import LocationSalaryRevenueColumnChart from '@/components/charts/LocationSalaryRevenueColumnChart';
import TargetRevenueChart from '@/components/charts/TargetRevenueChart';
import ComparisonFulltimeSalaryCard from '@/components/comparison/ComparisonFulltimeSalaryCard';
import ComparisonParttimeSalaryCard from '@/components/comparison/ComparisonParttimeSalaryCard';
import ComparisonCombinedSalaryCard from '@/components/comparison/ComparisonCombinedSalaryCard';
import ComparisonRevenueCard from '@/components/comparison/ComparisonRevenueCard';
import ComparisonSalaryRevenueRatioCard from '@/components/comparison/ComparisonSalaryRevenueRatioCard';
import LocationComparisonTable from '@/components/comparison/LocationComparisonTable';
import NganhDocComparisonTable from '@/components/comparison/NganhDocComparisonTable';
import AverageFTSalaryPerEmployeeCard from '@/components/dashboard/AverageFTSalaryPerEmployeeCard';
import RevenuePerFTEmployeeCard from '@/components/dashboard/RevenuePerFTEmployeeCard';
import EmployeeCountCard from '@/components/dashboard/EmployeeCountCard';
import MonthlyEmployeeTrendChart from '@/components/charts/MonthlyEmployeeTrendChart';
import MonthlyAvgSalaryRevenuePerEmployeeChart from '@/components/charts/MonthlyAvgSalaryRevenuePerEmployeeChart';
import AverageSalaryPerWorkdayCard from '@/components/dashboard/AverageSalaryPerWorkdayCard';
import RevenuePerWorkdayCard from '@/components/dashboard/RevenuePerWorkdayCard';
import LocationWorkloadEfficiencyScatterChart from '@/components/charts/LocationWorkloadEfficiencyScatterChart';
import LocationSalaryPerWorkdayVsTotalWorkdaysScatterChart from '@/components/charts/LocationSalaryPerWorkdayVsTotalWorkdaysScatterChart';
import DetailedSalaryTable from '@/components/workspace/DetailedSalaryTable';
import SalaryMechanismCheckTable from '@/components/workspace/SalaryMechanismCheckTable';
import DoctorCountCard from '@/components/dashboard/DoctorCountCard';
import DoctorSalaryCard from '@/components/dashboard/DoctorSalaryCard';
import DoctorSalaryPerWorkdayCard from '@/components/dashboard/DoctorSalaryPerWorkdayCard';
import MonthlyDoctorSalaryPerWorkdayChart from '@/components/charts/MonthlyDoctorSalaryPerWorkdayChart';
import DoctorSalaryPerWorkdayByJobTitleChart from '@/components/charts/DoctorSalaryPerWorkdayByJobTitleChart';
import DoctorSalaryRankingTable from '@/components/dashboard/DoctorSalaryRankingTable';
import BackOfficeEmployeeRatioCard from '@/components/dashboard/BackOfficeEmployeeRatioCard';
import BackOfficeEmployeeRatioTrendChart from '@/components/charts/BackOfficeEmployeeRatioTrendChart';
import BackOfficeSalaryRatioCard from '@/components/dashboard/BackOfficeSalaryRatioCard';
import BackOfficeSalaryRatioTrendChart from '@/components/charts/BackOfficeSalaryRatioTrendChart';
import NganhDocKpiComparisonTable from '@/components/comparison/NganhDocKpiComparisonTable';
import SystemWideNganhDocComparisonTable from '@/components/comparison/SystemWideNganhDocComparisonTable';
import MonthlySalaryProvinceTable from '@/components/comparison/MonthlySalaryProvinceTable';
import MonthlySalaryHanoiTable from '@/components/comparison/MonthlySalaryHanoiTable';


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
import ConfigError from "@/components/ui/ConfigError";

type WorkspaceView = 'dbManagement' | 'dashboard' | 'aiTools';
type DashboardTab = 'payrollOverview' | 'comparison' | 'kpiComparison' | 'hanoiSalaryReview' | 'salaryReview' | 'salaryAnalysisTab' | 'salaryWorkloadAnalysis' | 'detailedSalaryAnalysis' | 'doctorSalaryAnalysis' | 'homeSalaryAnalysis' | 'revenueAnalysis';

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
  const [configError, setConfigError] = useState<string | null>(null);

  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [availableLocationTypes, setAvailableLocationTypes] = useState<string[]>([]);
  const [availableDepartmentsByLoai, setAvailableDepartmentsByLoai] = useState<Record<string, string[]>>({});
  const [selectedDepartmentsByLoai, setSelectedDepartmentsByLoai] = useState<string[]>([]); // Stores "Loại__Department"
  const [isLoadingLocationFilters, setIsLoadingLocationFilters] = useState<boolean>(false);
  const [locationFilterError, setLocationFilterError] = useState<string | null>(null);

  const [orgHierarchyData, setOrgHierarchyData] = useState<OrgNode[]>([]);
  const [selectedOrgUnitIds, setSelectedOrgUnitIds] = useState<string[]>([]); // Stores IDs from ms_org_nganhdoc
  const [isLoadingOrgHierarchy, setIsLoadingOrgHierarchy] = useState<boolean>(false);
  const [orgHierarchyError, setOrgHierarchyError] = useState<string | null>(null);
  const [flatOrgUnits, setFlatOrgUnits] = useState<FlatOrgUnit[]>([]);


  const [activeDashboardTab, setActiveDashboardTab] = useState<DashboardTab>('payrollOverview');

  const [isMounted, setIsMounted] = useState(false); // Corrected syntax error here


  useEffect(() => {
    setIsMounted(true);
  }, []);


  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
    { id: 'dbManagement', label: 'Quản Lý CSDL', icon: Database },
    { id: 'aiTools', label: 'Công Cụ AI', icon: Settings2 },
  ];

  const fetchDistinctYears = useCallback(async () => {
    if (activeView !== 'dashboard') return;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, toast]);

  const fetchLocationFilterOptions = useCallback(async () => {
    if (activeView !== 'dashboard') return;
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
  }, [activeView, toast]);


 const buildTree = useCallback((items: FlatOrgUnit[], parentId: string | null = "1"): OrgNode[] => {
    const children = items
      .filter(item => String(item.Parent_ID) === String(parentId))
      .map(item => ({
        id: String(item.ID),
        name: item.Department,
        parent_id: item.Parent_ID ? String(item.Parent_ID) : null,
        children: buildTree(items, String(item.ID))
      }));
    return children.sort((a,b) => a.name.localeCompare(b.name));
  }, []);


  const fetchAndBuildOrgHierarchy = useCallback(async () => {
    if (activeView !== 'dashboard') return;
    setIsLoadingOrgHierarchy(true);
    setOrgHierarchyError(null);
    setOrgHierarchyData([]);
    setFlatOrgUnits([]);

    try {
      const { data, error } = await supabase.from('ms_org_nganhdoc').select('ID, Parent_ID, Department');

      if (error) {
        console.error("Supabase error object from 'ms_org_nganhdoc':", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        let displayErrorMessage = `Lỗi khi truy vấn 'ms_org_nganhdoc': ${error.message || 'Unknown error'}`;
        if (error.code === '42P01' || (error.message && error.message.toLowerCase().includes("relation \"ms_org_nganhdoc\" does not exist"))) {
             displayErrorMessage = "Lỗi: Bảng 'ms_org_nganhdoc' không tìm thấy. Vui lòng kiểm tra tên bảng và đảm bảo nó tồn tại trong schema 'public'. Xem README.md.";
        } else if (error.code === '42501') {
             displayErrorMessage = "Lỗi: Không có quyền truy cập bảng 'ms_org_nganhdoc'. Kiểm tra chính sách RLS.";
        }
        throw new Error(displayErrorMessage);
      }

      const flatData = (data || []).map(d => ({...d, ID: String(d.ID), Parent_ID: d.Parent_ID ? String(d.Parent_ID) : null})) as FlatOrgUnit[];
      setFlatOrgUnits(flatData);

      const medGroupRoot = flatData.find(item => String(item.ID) === "1");

      if (medGroupRoot) {
        const hierarchy = [{
            id: String(medGroupRoot.ID),
            name: medGroupRoot.Department,
            parent_id: medGroupRoot.Parent_ID ? String(medGroupRoot.Parent_ID) : null,
            children: buildTree(flatData, String(medGroupRoot.ID))
        }];
        setOrgHierarchyData(hierarchy);
      } else {
        const rootItems = flatData.filter(item => !item.Parent_ID || item.Parent_ID === null);
        const hierarchy = rootItems.map(item => ({
            id: String(item.ID),
            name: item.Department,
            parent_id: null,
            children: buildTree(flatData, String(item.ID))
        })).sort((a,b) => a.name.localeCompare(b.name));
        
        setOrgHierarchyData(hierarchy);
        if (hierarchy.length === 0 && flatData.length > 0) {
             setOrgHierarchyError("Không tìm thấy đơn vị gốc (ID=1 hoặc Parent_ID NULL) trong 'ms_org_nganhdoc'. Kiểm tra dữ liệu.");
        } else if (flatData.length === 0) {
             setOrgHierarchyData([]);
        }
      }

    } catch (err: any) {
       console.error("Error fetching/building org hierarchy from MS_Org_nganhdoc:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      const errorMessage = err.message || err.details || err.error_description || (typeof err === 'object' ? JSON.stringify(err) : "Không thể tải dữ liệu cơ cấu tổ chức từ 'ms_org_nganhdoc'.");
      setOrgHierarchyError(errorMessage);
    } finally {
      setIsLoadingOrgHierarchy(false);
    }
  }, [activeView, buildTree]);


  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchDistinctYears();
      fetchLocationFilterOptions();
      fetchAndBuildOrgHierarchy();
    }
  }, [activeView, fetchDistinctYears, fetchLocationFilterOptions, fetchAndBuildOrgHierarchy]);

  const selectedDepartmentsFromLoaiFilter = useMemo(() => {
    return selectedDepartmentsByLoai.map(id => id.split('__')[1]).filter(Boolean);
  }, [selectedDepartmentsByLoai]);

  const selectedNganhDocForFilter = useMemo(() => {
    if (selectedOrgUnitIds.length === 0 || flatOrgUnits.length === 0) return [];
    return selectedOrgUnitIds
      .map(id => flatOrgUnits.find(u => String(u.ID) === String(id))?.Department)
      .filter(Boolean) as string[];
  }, [selectedOrgUnitIds, flatOrgUnits]);

  const selectedDonVi2ForFilter = useMemo(() => {
    if (selectedOrgUnitIds.length === 0 || flatOrgUnits.length === 0) return [];
    return selectedOrgUnitIds
      .map(id => flatOrgUnits.find(u => String(u.ID) === String(id))?.Department)
      .filter(Boolean) as string[];
  }, [selectedOrgUnitIds, flatOrgUnits]);


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

  // Hiển thị lỗi cấu hình nếu có
  if (configError) {
    return <ConfigError type="supabase" message={configError} />;
  }

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
            <div className="flex flex-col gap-1 h-full">
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
              <div className="flex-grow">
                <SupabaseTableList />
              </div>
            </div>
          )}
          {activeView === 'aiTools' && (
            <AiToolsViewer />
          )}
          {activeView === 'dashboard' && (
             <Card className="shadow-md rounded-lg h-full flex flex-col">
              <CardHeader className="pb-3 pt-4 px-3 md:px-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-primary flex items-center gap-1.5">
                      <LayoutDashboard className="h-5 w-5" />
                       Phân Tích Lương Tổng Hợp
                    </CardTitle>
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      Phân tích chi tiết lương theo thời gian, địa điểm và các chỉ số KPI quan trọng
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-wrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="h-9 text-sm min-w-[200px] justify-between px-3">
                          <div className="flex items-center gap-1.5 truncate">
                            <FilterIconLucide className="h-3.5 w-3.5 opacity-80 shrink-0" />
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
                                  {(!isMounted || (isMounted && selectedYear !== null)) && <span className="w-2 h-2 block ml-0.5 mr-[calc(0.5rem-2px)]"></span>} {}
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
                                     {(!isMounted || (isMounted && selectedYear !== year)) && <span className="w-2 h-2 block ml-0.5 mr-[calc(0.5rem-2px)]"></span>} {}
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
                    
                    <HierarchicalOrgFilter
                        hierarchy={orgHierarchyData}
                        selectedIds={selectedOrgUnitIds}
                        onSelectionChange={setSelectedOrgUnitIds}
                        isLoading={isLoadingOrgHierarchy}
                        error={orgHierarchyError}
                        triggerButtonLabel="Cơ Cấu Tổ Chức"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-3 px-3 md:px-4 pb-3 flex-grow flex flex-col overflow-hidden space-y-3">
                <Tabs value={activeDashboardTab} onValueChange={(value) => setActiveDashboardTab(value as DashboardTab)} className="flex-grow flex flex-col overflow-hidden">
                  <div className="flex justify-start">
                    <TabsList className="shrink-0">
                      <TabsTrigger value="payrollOverview" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <LayoutDashboard className="h-3.5 w-3.5"/> Tổng Quan Lương
                      </TabsTrigger>
                      <TabsTrigger value="comparison" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <GanttChartSquare className="h-3.5 w-3.5"/> So sánh cùng kỳ
                      </TabsTrigger>
                       <TabsTrigger value="kpiComparison" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <Target className="h-3.5 w-3.5"/> Quỹ lương lũy kế
                      </TabsTrigger>
                      <TabsTrigger value="hanoiSalaryReview" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5"/> Duyệt lương tháng Hà Nội
                      </TabsTrigger>
                      <TabsTrigger value="salaryReview" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5"/> Duyệt lương tháng ĐVTV
                      </TabsTrigger>
                      <TabsTrigger value="salaryAnalysisTab" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <FolderKanban className="h-3.5 w-3.5"/> Phân tích lương
                      </TabsTrigger>
                      <TabsTrigger value="salaryWorkloadAnalysis" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5"/> Lương và Hiệu suất
                      </TabsTrigger>
                       <TabsTrigger value="detailedSalaryAnalysis" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5"/> Chi tiết lương
                      </TabsTrigger>
                      <TabsTrigger value="doctorSalaryAnalysis" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <UserCheck className="h-3.5 w-3.5"/> Phân tích lương bác sĩ
                      </TabsTrigger>
                      <TabsTrigger value="homeSalaryAnalysis" className="text-xs px-2.5 py-1.5 flex items-center gap-1">
                        <UsersRound className="h-3.5 w-3.5"/> Phân tích lương tại nhà
                      </TabsTrigger>
                      
                    </TabsList>
                  </div>

                 {/* Dashboard Tabs Content */}

                  {/* Tab: Tổng Quan Lương & Doanh Thu */}

                  <TabsContent value="payrollOverview" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <TotalSalaryCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} />
                        <TotalSalaryParttimeCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                        <RevenueCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartments={selectedDepartmentsFromLoaiFilter} />
                        <SalaryToRevenueRatioCard selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <CombinedMonthlyTrendChart selectedYear={selectedYear} selectedMonths={selectedMonths} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-1">
                           <SalaryProportionPieChart selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                        </div>
                        <div className="md:col-span-2">
                           <LocationSalaryRevenueColumnChart selectedMonths={selectedMonths} selectedYear={selectedYear} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                        </div>
                    </div>
                  </TabsContent>

                   {/* Tab: So sánh cùng kỳ */}

                  <TabsContent value="comparison" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="grid gap-3 md:grid-cols-5">
                        <ComparisonFulltimeSalaryCard selectedMonths={selectedMonths} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} />
                        <ComparisonParttimeSalaryCard selectedMonths={selectedMonths} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                        <ComparisonCombinedSalaryCard selectedMonths={selectedMonths} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                        <ComparisonRevenueCard selectedMonths={selectedMonths} selectedDepartments={selectedDepartmentsFromLoaiFilter} />
                        <ComparisonSalaryRevenueRatioCard selectedMonths={selectedMonths} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} selectedNganhDoc={selectedNganhDocForFilter} selectedDonVi2={selectedDonVi2ForFilter} />
                    </div>
                    <NganhDocComparisonTable
                        selectedMonths={selectedMonths}
                        selectedNganhDoc={selectedNganhDocForFilter}
                        selectedDonVi2={selectedDonVi2ForFilter}
                        orgHierarchyData={orgHierarchyData}
                        flatOrgUnits={flatOrgUnits}
                    />
                    <SystemWideNganhDocComparisonTable
                        selectedMonths={selectedMonths}
                        selectedNganhDoc={selectedNganhDocForFilter}
                        selectedDonVi2={selectedDonVi2ForFilter}
                        orgHierarchyData={orgHierarchyData}
                        flatOrgUnits={flatOrgUnits}
                    />
                     <LocationComparisonTable selectedMonths={selectedMonths} selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} />
                  </TabsContent>

                   {/* Tab: Quỹ lương lũy kế */}
                  <TabsContent value="kpiComparison" className="flex-grow overflow-y-auto space-y-3 mt-2">
                     <NganhDocKpiComparisonTable
                        orgHierarchyData={orgHierarchyData}
                        flatOrgUnits={flatOrgUnits}
                      />
                  </TabsContent>

                  {/* Tab: Duyệt lương tháng Hà Nội */}
                  <TabsContent value="hanoiSalaryReview" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <MonthlySalaryHanoiTable
                      orgHierarchyData={orgHierarchyData}
                      flatOrgUnits={flatOrgUnits}
                    />
                  </TabsContent>

                  {/* Tab: Duyệt lương tháng ĐVTV */}
                  <TabsContent value="salaryReview" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <MonthlySalaryProvinceTable
                      orgHierarchyData={orgHierarchyData}
                      flatOrgUnits={flatOrgUnits}
                    />
                    <SalaryMechanismCheckTable 
                      selectedYear={selectedYear}
                      selectedMonths={selectedMonths}
                    />
                  </TabsContent>

                  <TabsContent value="salaryAnalysisTab" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                      <BackOfficeEmployeeRatioCard 
                        selectedYear={selectedYear} 
                        selectedMonths={selectedMonths} 
                        selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter} 
                        selectedNganhDoc={selectedNganhDocForFilter} 
                        selectedDonVi2={selectedDonVi2ForFilter} 
                      />
                      <BackOfficeSalaryRatioCard selectedYear={selectedYear} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <BackOfficeEmployeeRatioTrendChart selectedYear={selectedYear} />
                      <BackOfficeSalaryRatioTrendChart selectedYear={selectedYear} />
                    </div>
                  </TabsContent>

                   {/* Tab: Lương và Hiệu suất */}

                  <TabsContent value="salaryWorkloadAnalysis" className="flex-grow overflow-y-auto space-y-3 mt-2">
                     <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
                        <EmployeeCountCard
                            selectedMonths={selectedMonths}
                            selectedYear={selectedYear}
                            selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                            selectedNganhDoc={selectedNganhDocForFilter}
                        />
                        <AverageFTSalaryPerEmployeeCard
                            selectedMonths={selectedMonths}
                            selectedYear={selectedYear}
                            selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                            selectedNganhDoc={selectedNganhDocForFilter}
                        />
                        <RevenuePerFTEmployeeCard
                            selectedMonths={selectedMonths}
                            selectedYear={selectedYear}
                            selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                            selectedNganhDoc={selectedNganhDocForFilter}
                        />
                        <AverageSalaryPerWorkdayCard
                             selectedMonths={selectedMonths}
                             selectedYear={selectedYear}
                             selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                             selectedNganhDoc={selectedNganhDocForFilter}
                        />
                        <RevenuePerWorkdayCard
                             selectedMonths={selectedMonths}
                             selectedYear={selectedYear}
                             selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                             selectedNganhDoc={selectedNganhDocForFilter}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                         <MonthlyEmployeeTrendChart
                            selectedYear={selectedYear}
                            selectedMonths={selectedMonths}
                            selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                            selectedNganhDoc={selectedNganhDocForFilter}
                        />
                        <MonthlyAvgSalaryRevenuePerEmployeeChart
                            selectedYear={selectedYear}
                            selectedMonths={selectedMonths}
                            selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                            selectedNganhDoc={selectedNganhDocForFilter}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <LocationWorkloadEfficiencyScatterChart
                            selectedYear={selectedYear}
                            selectedMonths={selectedMonths}
                            selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                            selectedNganhDoc={selectedNganhDocForFilter}
                        />
                        <LocationSalaryPerWorkdayVsTotalWorkdaysScatterChart
                             selectedYear={selectedYear}
                             selectedMonths={selectedMonths}
                             selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                             selectedNganhDoc={selectedNganhDocForFilter}
                        />
                    </div>
                  </TabsContent>

                   {/* Tab: Chi tiết lương */}
                  <TabsContent value="detailedSalaryAnalysis" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <DetailedSalaryTable
                        selectedYear={selectedYear}
                        selectedMonths={selectedMonths}
                        selectedDepartmentsForDiadiem={selectedDepartmentsFromLoaiFilter}
                        selectedNganhDoc={selectedNganhDocForFilter}
                    />
                  </TabsContent>
                  {/* Tab: Phân tích lương bác sĩ */}
                  <TabsContent value="doctorSalaryAnalysis" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="space-y-4 mt-2">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <DoctorCountCard />
                        <DoctorSalaryCard />
                        <DoctorSalaryPerWorkdayCard />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <MonthlyDoctorSalaryPerWorkdayChart selectedYear={selectedYear} />
                        <DoctorSalaryPerWorkdayByJobTitleChart selectedYear={selectedYear} />
                      </div>
                      <div className="mt-4">
                        <DoctorSalaryRankingTable />
                      </div>
                    </div>
                  </TabsContent>
                  {/* Tab: Phân tích lương tại nhà */}
                  <TabsContent value="homeSalaryAnalysis" className="flex-grow overflow-y-auto space-y-3 mt-2">
                    <div className="mt-4 text-base font-semibold text-center text-primary">Phân tích lương tại nhà (đang phát triển)</div>
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

