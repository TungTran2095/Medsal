import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface ProvinceKpiRow {
  department_name: string;
  ft_salary_2025: number;
  pt_salary_2025: number;
  total_salary_2025: number;
  quy_cung_2025: number;
}

interface NganhDocKpiProvinceTableProps {
  data: ProvinceKpiRow[];
  isLoading?: boolean;
}

const formatCurrency = (value: number | null | undefined) =>
  value == null
    ? "N/A"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);

export default function NganhDocKpiProvinceTable({
  data,
  isLoading,
}: NganhDocKpiProvinceTableProps) {
  if (isLoading) return <div>Đang tải dữ liệu...</div>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Địa điểm/Đơn vị</TableHead>
          <TableHead className="text-right">Lương FT 2025</TableHead>
          <TableHead className="text-right">Lương PT 2025</TableHead>
          <TableHead className="text-right">Tổng lương 2025</TableHead>
          <TableHead className="text-right">Quỹ cứng 2025</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.department_name}>
            <TableCell>{row.department_name}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.ft_salary_2025)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.pt_salary_2025)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.total_salary_2025)}</TableCell>
            <TableCell className="text-right">{formatCurrency(row.quy_cung_2025)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 