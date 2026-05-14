'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS } from '@/lib/utils';

interface Invoice {
  id: string; number: string; status: string; total: number;
  createdAt: string; dueDate: string | null; paidAt: string | null;
  customer: { id: string; name: string };
  job: { id: string; title: string } | null;
}

const STATUSES = ['ALL', 'DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    fetch('/api/invoices').then(r => r.json()).then(setInvoices).finally(() => setLoading(false));
  }, []);

  const filtered = invoices.filter(inv => {
    const matchSearch = inv.number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer.name.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filter === 'ALL' || inv.status === filter);
  });

  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const totalOwed = invoices.filter(i => ['SENT', 'OVERDUE'].includes(i.status)).reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm">{invoices.length} total invoices</p>
        </div>
        <Link href="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Collected</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalOwed)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search invoices…" value={search} onChange={e => setSearch(e.target.value)}
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
            <p className="text-gray-400 text-sm">No invoices found.</p>
            <Link href="/invoices/new" className="text-blue-600 text-sm hover:underline mt-2 inline-block">Create your first invoice</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Due</th>
                <th className="text-left py-3 px-5 text-xs font-medium text-gray-500 uppercase">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-5">
                    <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-blue-600 hover:underline">{inv.number}</Link>
                    <p className="text-xs text-gray-400">{formatDate(inv.createdAt)}</p>
                  </td>
                  <td className="py-3 px-5 text-sm text-gray-900">{inv.customer.name}</td>
                  <td className="py-3 px-5">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                  </td>
                  <td className="py-3 px-5 text-sm font-semibold text-gray-900">{formatCurrency(inv.total)}</td>
                  <td className="py-3 px-5 text-sm text-gray-600">{formatDate(inv.dueDate)}</td>
                  <td className="py-3 px-5 text-sm text-gray-600">{formatDate(inv.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
