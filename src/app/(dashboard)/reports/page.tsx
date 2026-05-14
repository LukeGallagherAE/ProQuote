'use client';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface Stats {
  totalJobs: number; pendingJobs: number; completedJobs: number;
  totalCustomers: number; paidRevenue: number; unpaidRevenue: number;
  monthlyRevenue: { month: string; revenue: number }[];
}

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  const completionRate = stats.totalJobs > 0 ? Math.round((stats.completedJobs / stats.totalJobs) * 100) : 0;

  const jobStatusData = [
    { name: 'Completed', value: stats.completedJobs },
    { name: 'Pending', value: stats.pendingJobs },
    { name: 'Other', value: Math.max(0, stats.totalJobs - stats.completedJobs - stats.pendingJobs) },
  ].filter(d => d.value > 0);

  const revenueData = [
    { name: 'Collected', value: stats.paidRevenue },
    { name: 'Outstanding', value: stats.unpaidRevenue },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 text-sm">Business performance overview</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: stats.totalJobs.toString() },
          { label: 'Completion Rate', value: `${completionRate}%` },
          { label: 'Total Revenue', value: formatCurrency(stats.paidRevenue + stats.unpaidRevenue) },
          { label: 'Total Customers', value: stats.totalCustomers.toString() },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Revenue */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Revenue Breakdown</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={revenueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {revenueData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Job Status */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Jobs by Status</h2>
          {jobStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={jobStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {jobStatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No job data yet.</p>
          )}
        </div>

        {/* Summary table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Summary</h2>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {[
                ['Total Jobs', stats.totalJobs],
                ['Completed Jobs', stats.completedJobs],
                ['Pending Jobs', stats.pendingJobs],
                ['Total Customers', stats.totalCustomers],
                ['Revenue Collected', formatCurrency(stats.paidRevenue)],
                ['Revenue Outstanding', formatCurrency(stats.unpaidRevenue)],
                ['Total Invoiced', formatCurrency(stats.paidRevenue + stats.unpaidRevenue)],
                ['Completion Rate', `${completionRate}%`],
              ].map(([label, value]) => (
                <tr key={label as string}>
                  <td className="py-2.5 text-gray-500">{label}</td>
                  <td className="py-2.5 font-semibold text-gray-900 text-right">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
