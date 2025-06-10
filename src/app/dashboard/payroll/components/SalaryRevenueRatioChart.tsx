import React from 'react';
import dynamic from 'next/dynamic';
import { getSalaryRevenueRatioByLocation, getSalaryRevenueRatioChartOptions } from '@/ai/tools/salary-revenue-ratio';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

interface Props {
  year: number;
  month: number;
}

export default function SalaryRevenueRatioChart({ year, month }: Props) {
  const [data, setData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        const ratioData = await getSalaryRevenueRatioByLocation(year, month);
        setData(ratioData);
      } catch (error) {
        console.error('Error fetching salary revenue ratio:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [year, month]);

  if (loading) {
    return <div>Đang tải dữ liệu...</div>;
  }

  const series = [
    {
      name: 'Lương Toàn Thời Gian',
      data: data.map(item => item.ft_salary_ratio_component)
    },
    {
      name: 'Lương Bán Thời Gian',
      data: data.map(item => item.pt_salary_ratio_component)
    }
  ];

  const options = getSalaryRevenueRatioChartOptions(data);

  return (
    <div className="w-full">
      <Chart
        options={options}
        series={series}
        type="bar"
        height={400}
      />
    </div>
  );
} 