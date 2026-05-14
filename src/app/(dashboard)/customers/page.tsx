'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Phone, Mail, MapPin } from 'lucide-react';

interface Customer {
  id: string; name: string; email: string | null; phone: string | null;
  city: string | null; state: string | null;
  _count: { jobs: number; invoices: number; quotes: number };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', postcode: '', notes: '' });

  function load() {
    fetch('/api/customers').then(r => r.json()).then(setCustomers).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? '').includes(search)
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ name: '', email: '', phone: '', address: '', city: '', state: '', postcode: '', notes: '' });
      setShowForm(false);
      load();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm">{customers.length} total customers</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">New Customer</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0400 000 000" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Street address" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="City" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
                  <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="NSW" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Postcode</label>
                  <input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="2000" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Saving…' : 'Add Customer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Link key={c.id} href={`/customers/${c.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500">{c._count.jobs} jobs</span>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900">{c.name}</h3>
              <div className="mt-2 space-y-1">
                {c.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="w-3 h-3" />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="w-3 h-3" />{c.email}</div>}
                {c.city && <div className="flex items-center gap-1.5 text-xs text-gray-500"><MapPin className="w-3 h-3" />{c.city}{c.state ? `, ${c.state}` : ''}</div>}
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400 text-sm">No customers found.</div>
          )}
        </div>
      )}
    </div>
  );
}
