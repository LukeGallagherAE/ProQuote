'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface LineItem { description: string; quantity: number; unitPrice: number; }
interface Customer { id: string; name: string; }
interface Job { id: string; title: string; customerId: string; }

export default function NewQuotePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ customerId: params.get('customerId') ?? '', jobId: params.get('jobId') ?? '', status: 'DRAFT', notes: '', validUntil: '', taxRate: 10 });
  const [items, setItems] = useState<LineItem[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    Promise.all([
      fetch('/api/customers').then(r => r.json()),
      fetch('/api/jobs').then(r => r.json()),
    ]).then(([c, j]) => { setCustomers(c); setJobs(j); });
  }, []);

  function addItem() { setItems(i => [...i, { description: '', quantity: 1, unitPrice: 0 }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, key: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [key]: key === 'description' ? value : Number(value) } : item));
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tax = subtotal * (form.taxRate / 100);
  const total = subtotal + tax;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, jobId: form.jobId || null, validUntil: form.validUntil || null, items }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      const q = await res.json();
      router.push(`/quotes/${q.id}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/quotes" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
              <select required value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select customer…</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Linked Job</label>
              <select value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">No job</option>
                {jobs.filter(j => !form.customerId || j.customerId === form.customerId).map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="DRAFT">Draft</option><option value="SENT">Sent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Terms, conditions, notes for the customer…" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Line Items</h2>
            <button type="button" onClick={addItem}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-6">Description</div>
              <div className="col-span-2">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-1">Total</div>
              <div className="col-span-1" />
            </div>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                  placeholder="Description" required
                  className="col-span-6 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', e.target.value)}
                  className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="col-span-1 text-sm font-medium text-right">{formatCurrency(item.quantity * item.unitPrice)}</div>
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-500 ml-auto">Tax Rate (%)</label>
              <input type="number" min="0" max="100" value={form.taxRate} onChange={e => setForm(f => ({ ...f, taxRate: Number(e.target.value) }))}
                className="w-20 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-gray-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm">
              <span className="text-gray-500">GST ({form.taxRate}%)</span><span className="font-medium">{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-end gap-8 text-base font-bold border-t border-gray-100 pt-2">
              <span>Total</span><span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Creating…' : 'Create Quote'}
          </button>
          <Link href="/quotes" className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
