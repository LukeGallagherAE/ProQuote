'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, Users, DollarSign, Clock, TrendingUp, AlertCircle, ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface Stats {
  totalJobs: number;
  pendingJobs: number;
  completedJobs: number;
  totalCustomers: number;
  paidRevenue: number;
  unpaidRevenue: number;
  recentJobs: Job[];
  upcomingJobs: Job[];
  monthlyRevenue: { month: string; revenue: number }[];
}

interface Job {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduledAt: string | null;
  customer: { name: string };
  assignee?: { name: string } | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) return <p className="text-red-600">Failed to load dashboard data.</p>;

  const statCards = [
    { label: 'Total Jobs', value: stats.totalJobs, icon: Briefcase, color: 'bg-blue-500', change: `${stats.pendingJobs} pending` },
    { label: 'Customers', value: stats.totalCustomers, icon: Users, color: 'bg-emerald-500', change: 'All time' },
    { label: 'Revenue Collected', value: formatCurrency(stats.paidRevenue), icon: DollarSign, color: 'bg-violet-500', change: 'Paid invoices' },
    { label: 'Outstanding', value: formatCurrency(stats.unpaidRevenue), icon: Clock, color: 'bg-orange-500', change: 'Awaiting payment' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back. Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <div className={`w-10 h-10 ${card.color} rounded-lg flex items-center justify-center`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Revenue (Last 6 Months)</h2>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Jobs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Upcoming Jobs</h2>
            <Link href="/schedule" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          {stats.upcomingJobs.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No upcoming jobs scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {stats.upcomingJobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                      <p className="text-xs text-gray-500">{job.customer.name}</p>
                      <p className="text-xs text-blue-600">{formatDate(job.scheduledAt)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Jobs</h2>
          <Link href="/jobs" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Job</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      {job.title}
                    </Link>
                  </td>
                  <td className="py-3 px-5 text-sm text-gray-600">{job.customer.name}</td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                      {JOB_STATUS_LABELS[job.status]}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[job.priority]}`}>
                      {PRIORITY_LABELS[job.priority]}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-sm text-gray-600">{job.assignee?.name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
