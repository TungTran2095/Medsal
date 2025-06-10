import React from 'react';
import HanoiSalaryComparisonChart from './HanoiSalaryComparisonChart';
import SystemWideSalaryComparisonChart from './SystemWideSalaryComparisonChart';

interface Props {
  year: number;
  month: number;
}

export default function SalaryComparisonSection({ year, month }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Bảng so sánh theo ngành dọc tại Hà Nội</h3>
        <HanoiSalaryComparisonChart year={year} month={month} />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">Bảng so sánh theo ngành dọc toàn hệ thống</h3>
        <SystemWideSalaryComparisonChart year={year} month={month} />
      </div>
    </div>
  );
} 