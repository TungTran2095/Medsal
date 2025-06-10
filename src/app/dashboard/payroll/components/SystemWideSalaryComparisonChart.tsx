import React from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
  year: number;
  month: number;
}

export default function SystemWideSalaryComparisonChart({ year, month }: Props) {
  const [ftData, setFtData] = React.useState<any[]>([]);
  const [ptData, setPtData] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        // Lấy dữ liệu lương toàn thời gian theo ngành dọc
        const { data: ftSalaryData, error: ftError } = await supabase
          .rpc('get_nganhdoc_ft_salary_hanoi', {
            p_filter_year: year,
            p_filter_months: [month]
          });

        if (ftError) throw ftError;

        // Lấy dữ liệu lương bán thời gian theo đơn vị 2
        const { data: ptSalaryData, error: ptError } = await supabase
          .rpc('get_donvi2_pt_salary', {
            p_filter_year: year,
            p_filter_months: [month]
          });

        if (ptError) throw ptError;

        setFtData(ftSalaryData || []);
        setPtData(ptSalaryData || []);
      } catch (error) {
        console.error('Error fetching salary data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [year, month]);

  if (loading) {
    return <div>Đang tải dữ liệu...</div>;
  }

  const options = {
    chart: {
      type: 'bar',
      height: 400,
      toolbar: {
        show: false
      }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '40%',
        borderRadius: 4,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return val.toLocaleString('vi-VN') + ' đ';
      },
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#304758']
      }
    },
    stroke: {
      show: true,
      width: 2,
      colors: ['transparent']
    },
    xaxis: {
      categories: [...new Set([...ftData.map(item => item.nganh_doc_key), ...ptData.map(item => item.don_vi_2_key)])],
      labels: {
        rotate: -45,
        style: {
          fontSize: '12px'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Tổng lương (VNĐ)'
      },
      labels: {
        formatter: function(val: number) {
          return val.toLocaleString('vi-VN') + ' đ';
        }
      }
    },
    fill: {
      opacity: 1
    },
    tooltip: {
      y: {
        formatter: function(val: number) {
          return val.toLocaleString('vi-VN') + ' đ';
        }
      }
    },
    legend: {
      position: 'top'
    },
    colors: ['#008FFB', '#00E396']
  };

  const series = [
    {
      name: 'Lương Toàn Thời Gian',
      data: ftData.map(item => item.ft_salary)
    },
    {
      name: 'Lương Bán Thời Gian',
      data: ptData.map(item => item.pt_salary)
    }
  ];

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