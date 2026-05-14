'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { formatCurrency, formatDate, QUOTE_STATUS_COLORS } from '@/lib/utils';

interface Quote {
  id: string; number: string; status: string; total: number;
  createdAt: string; validUntil: string | null;
  customer: { id: string; name: string };
  job: { id: string; title: string } | null;
}

const STATUSES = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/quotes').then(r => r.json()).then(setQuotes).finally(() => setLoading(false));
  }, []);

  const filtered = quotes.filter(q => {
    const matchSearch = q.number.toLowerCase().includes(search.toLowerCase()) ||
      q.customer.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filter === 'ALL' || q.status === filter);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-gray-500 text-sm">{quotes.length} total quotes</p>
        </div>
        <Link href="/quotes/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Quote
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search quotes…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border border-gray-300 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Statuses' : s}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-sm">No quotes found.</p>
            <Link href="/quotes/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">Create your first quote</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Quote #</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Valid Until</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/quotes/${q.id}`} className="text-sm font-medium text-blue-600 hover:underline">{q.number}</Link>
                    <p className="text-xs text-gray-400">{formatDate(q.createdAt)}</p>
                  </td>
                  <td className="py-3 px-5 text-sm text-gray-900">{q.customer.name}</td>
                  <td className="py-3 px-5 text-sm text-gray-600">{q.job ? <Link href={`/jobs/${q.job.id}`} className="text-blue-600 hover:underline">{q.job.title}</Link> : '—'}</td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_COLORS[q.status]}`}>{q.status}</span>
                  </td>
                  <td className="py-3 px-5 text-sm font-semibold text-gray-900">{formatCurrency(q.total)}</td>
                  <td className="py-3 px-5 text-sm text-gray-600">{formatDate(q.validUntil)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
