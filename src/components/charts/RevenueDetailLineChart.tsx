"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RevenueDetailLineChartProps {
  data: Array<{
    month: string;
    chi_tieu: number;
    thuc_hien: number;
  }>;
  businessUnit: string;
}

export default function RevenueDetailLineChart({ data, businessUnit }: RevenueDetailLineChartProps) {
  const formatCurrency = (value: number) => {
    if (value === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px] p-4">
      <h4 className="text-sm font-semibold mb-3 text-center">
        Chỉ tiêu và Doanh thu thực hiện theo tháng - {businessUnit}
      </h4>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="month" 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => value.replace('Tháng ', 'T')}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
              return value.toString();
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="chi_tieu" 
            stroke="#8884d8" 
            strokeWidth={2}
            name="Chỉ tiêu doanh thu"
            dot={{ r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="thuc_hien" 
            stroke="#82ca9d" 
            strokeWidth={2}
            name="Doanh thu thực hiện"
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}




