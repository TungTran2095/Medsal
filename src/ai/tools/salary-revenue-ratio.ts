import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface LocationData {
  location_name: string;
  ft_salary_ratio_component: number;
  pt_salary_ratio_component: number;
}

// Hàm gộp các đơn vị thành Med Đông Nam Bộ
function groupLocations(location: string): string {
  const dongNamBo = ['Med TP.HCM', 'Med Đồng Nai', 'Med Bình Dương', 'Med Bình Phước', 'Med BR-VT'];
  return dongNamBo.includes(location) ? 'Med Đông Nam Bộ' : location;
}

// Hàm lấy dữ liệu tỷ lệ lương/doanh thu theo địa điểm
export async function getSalaryRevenueRatioByLocation(year: number, month: number) {
  try {
    const { data, error } = await supabase
      .rpc('get_salary_revenue_ratio_components_by_location', {
        p_filter_year: year,
        p_filter_months: [month],
        p_filter_locations: null
      });

    if (error) throw error;

    // Gộp các đơn vị thuộc Đông Nam Bộ
    const groupedData = data.reduce((acc: LocationData[], curr: LocationData) => {
      const groupedLocation = groupLocations(curr.location_name);
      const existingGroup = acc.find(item => item.location_name === groupedLocation);

      if (existingGroup) {
        existingGroup.ft_salary_ratio_component += curr.ft_salary_ratio_component;
        existingGroup.pt_salary_ratio_component += curr.pt_salary_ratio_component;
      } else {
        acc.push({
          location_name: groupedLocation,
          ft_salary_ratio_component: curr.ft_salary_ratio_component,
          pt_salary_ratio_component: curr.pt_salary_ratio_component
        });
      }

      return acc;
    }, []);

    // Sắp xếp theo tổng tỷ lệ lương
    return groupedData.sort((a: LocationData, b: LocationData) => {
      const totalA = a.ft_salary_ratio_component + a.pt_salary_ratio_component;
      const totalB = b.ft_salary_ratio_component + b.pt_salary_ratio_component;
      return totalB - totalA;
    });
  } catch (error) {
    console.error('Error fetching salary revenue ratio:', error);
    throw error;
  }
}

// Hàm tạo chart options cho biểu đồ tỷ lệ lương/doanh thu
export function getSalaryRevenueRatioChartOptions(data: LocationData[]) {
  return {
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
        columnWidth: '40%', // Giảm độ rộng của bar xuống 40%
        borderRadius: 4,
        dataLabels: {
          position: 'top'
        }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: function(val: number) {
        return (val * 100).toFixed(1) + '%';
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
      categories: data.map(item => item.location_name),
      labels: {
        rotate: -45,
        style: {
          fontSize: '12px'
        }
      }
    },
    yaxis: {
      title: {
        text: 'Tỷ lệ (%)'
      },
      labels: {
        formatter: function(val: number) {
          return (val * 100).toFixed(0) + '%';
        }
      }
    },
    fill: {
      opacity: 1
    },
    tooltip: {
      y: {
        formatter: function(val: number) {
          return (val * 100).toFixed(1) + '%';
        }
      }
    },
    legend: {
      position: 'top'
    },
    colors: ['#008FFB', '#00E396']
  };
} 