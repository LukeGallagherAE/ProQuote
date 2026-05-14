'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Plus } from 'lucide-react';
import { formatDate, formatCurrency, JOB_STATUS_COLORS, JOB_STATUS_LABELS, INVOICE_STATUS_COLORS } from '@/lib/utils';

interface Customer {
  id: string; name: string; email: string | null; phone: string | null;
  address: string | null; city: string | null; state: string | null; postcode: string | null; notes: string | null;
  jobs: { id: string; title: string; status: string; scheduledAt: string | null; assignee: { name: string } | null }[];
  quotes: { id: string; number: string; total: number; status: string; createdAt: string }[];
  invoices: { id: string; number: string; total: number; status: string; createdAt: string }[];
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', city: '', state: '', postcode: '', notes: '' });

  useEffect(() => {
    fetch(`/api/customers/${id}`).then(r => r.json()).then(c => {
      setCustomer(c);
      setForm({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', address: c.address ?? '', city: c.city ?? '', state: c.state ?? '', postcode: c.postcode ?? '', notes: c.notes ?? '' });
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const updated = await fetch(`/api/customers/${id}`).then(r => r.json());
    setCustomer(updated);
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this customer? This cannot be undone.')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    router.push('/customers');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!customer) return <p className="text-red-600">Customer not found.</p>;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customers" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
            <p className="text-sm text-gray-500">{customer.jobs.length} jobs &middot; {customer.invoices.length} invoices</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
            <Edit className="w-4 h-4" /> {editing ? 'Cancel' : 'Edit'}
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div>
          {editing ? (
            <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 text-sm">Edit Customer</h2>
              {[['name', 'Name *', 'text', true], ['email', 'Email', 'email', false], ['phone', 'Phone', 'tel', false], ['address', 'Address', 'text', false], ['city', 'City', 'text', false], ['state', 'State', 'text', false], ['postcode', 'Postcode', 'text', false]].map(([key, label, type, req]) => (
                <div key={key as string}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label as string}</label>
                  <input type={type as string} required={!!req} value={form[key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [key as string]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">Save Changes</button>
            </form>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-4">Contact Info</h2>
              <div className="space-y-3">
                {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-gray-400" /><span>{customer.phone}</span></div>}
                {customer.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-gray-400" /><span>{customer.email}</span></div>}
                {(customer.address || customer.city) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      {customer.address && <p>{customer.address}</p>}
                      {customer.city && <p>{customer.city}{customer.state ? ` ${customer.state}` : ''} {customer.postcode}</p>}
                    </div>
                  </div>
                )}
                {customer.notes && <div className="pt-3 border-t border-gray-100"><p className="text-xs text-gray-500 mb-1">Notes</p><p className="text-sm text-gray-700">{customer.notes}</p></div>}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Jobs ({customer.jobs.length})</h2>
              <Link href={`/jobs/new?customerId=${id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> New Job
              </Link>
            </div>
            {customer.jobs.length === 0 ? <p className="text-sm text-gray-400 p-4">No jobs yet.</p> : (
              <ul className="divide-y divide-gray-100">
                {customer.jobs.map(j => (
                  <li key={j.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <Link href={`/jobs/${j.id}`} className="text-sm font-medium text-blue-600 hover:underline">{j.title}</Link>
                      <p className="text-xs text-gray-500">{formatDate(j.scheduledAt)} {j.assignee ? `· ${j.assignee.name}` : ''}</p>
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLORS[j.status]}`}>{JOB_STATUS_LABELS[j.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Invoices ({customer.invoices.length})</h2>
              <Link href={`/invoices/new?customerId=${id}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> New Invoice</Link>
            </div>
            {customer.invoices.length === 0 ? <p className="text-sm text-gray-400 p-4">No invoices yet.</p> : (
              <ul className="divide-y divide-gray-100">
                {customer.invoices.map(inv => (
                  <li key={inv.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <Link href={`/invoices/${inv.id}`} className="text-sm font-medium text-blue-600 hover:underline">{inv.number}</Link>
                      <p className="text-xs text-gray-500">{formatDate(inv.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCurrency(inv.total)}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
