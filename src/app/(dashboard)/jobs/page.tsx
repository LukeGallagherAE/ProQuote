'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter } from 'lucide-react';
import { formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduledAt: string | null;
  createdAt: string;
  address: string | null;
  customer: { id: string; name: string; phone: string | null };
  assignee: { id: string; name: string } | null;
}

const STATUSES = ['ALL', 'PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/jobs').then(r => r.json()).then(setJobs).finally(() => setLoading(false));
  }, []);

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase()) ||
      j.customer.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || j.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-gray-500 text-sm">{jobs.length} total jobs</p>
        </div>
        <Link
          href="/jobs/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Job
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search jobs or customers…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : JOB_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No jobs found.</p>
            <Link href="/jobs/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">Create your first job</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Scheduled</th>
                  <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase tracking-wide">Assignee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-5">
                      <Link href={`/jobs/${job.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {job.title}
                      </Link>
                      {job.address && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{job.address}</p>}
                    </td>
                    <td className="py-3 px-5">
                      <p className="text-sm text-gray-900">{job.customer.name}</p>
                      {job.customer.phone && <p className="text-xs text-gray-400">{job.customer.phone}</p>}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                        {JOB_STATUS_LABELS[job.status]}
                      </span>
                    </td>
                    <td className="py-3 px-5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[job.priority]}`}>
                        {PRIORITY_LABELS[job.priority]}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-600">{formatDate(job.scheduledAt)}</td>
                    <td className="py-3 px-5 text-sm text-gray-600">{job.assignee?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
