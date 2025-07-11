import React from 'react';
// import SystemWideSalaryComparisonChart from './SystemWideSalaryComparisonChart';
import MonthlyDoctorSalaryPerWorkdayChart from '@/components/charts/MonthlyDoctorSalaryPerWorkdayChart';
import DoctorSalaryPerWorkdayByJobTitleChart from '@/components/charts/DoctorSalaryPerWorkdayByJobTitleChart';
// import DoctorSalaryPerWorkdayByJobTitleChart from '@/components/charts/DoctorSalaryPerWorkdayByJobTitleChart';
// Sẽ import chart mới ở đây sau khi tạo

interface Props {
  year: number;
  month: number;
}

export default function SalaryComparisonSection({ year, month }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Biến Động Lương/Công Bác Sĩ</h3>
        <MonthlyDoctorSalaryPerWorkdayChart selectedYear={year} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Lương/Công Bác Sĩ theo Chức Danh (So sánh 2 năm)</h3>
        <DoctorSalaryPerWorkdayByJobTitleChart selectedYear={year} />
      </div>
      {/* Chart mới Biến Động Lương/Công Bác Sĩ theo chức danh sẽ render ở đây */}
    </div>
  );
} 