'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, CheckCircle, Send } from 'lucide-react';
import { formatCurrency, formatDate, INVOICE_STATUS_COLORS } from '@/lib/utils';

interface Invoice {
  id: string; number: string; status: string;
  subtotal: number; tax: number; total: number;
  notes: string | null; dueDate: string | null; paidAt: string | null; createdAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  job: { id: string; title: string } | null;
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch(`/api/invoices/${id}`).then(r => r.json()).then(setInvoice).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: string) {
    await fetch(`/api/invoices/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  async function handleDelete() {
    if (!confirm('Delete this invoice?')) return;
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
    router.push('/invoices');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!invoice) return <p className="text-red-600">Invoice not found.</p>;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/invoices" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{invoice.number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${INVOICE_STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
              <span className="text-xs text-gray-400">{formatDate(invoice.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {invoice.status === 'DRAFT' && (
            <button onClick={() => updateStatus('SENT')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Send className="w-4 h-4" /> Mark Sent
            </button>
          )}
          {invoice.status === 'SENT' && (
            <button onClick={() => updateStatus('PAID')} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              <CheckCircle className="w-4 h-4" /> Mark Paid
            </button>
          )}
          <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Bill To</p>
            <Link href={`/customers/${invoice.customer.id}`} className="font-semibold text-blue-600 hover:underline">{invoice.customer.name}</Link>
            {invoice.customer.phone && <p className="text-sm text-gray-600">{invoice.customer.phone}</p>}
            {invoice.customer.email && <p className="text-sm text-gray-600">{invoice.customer.email}</p>}
          </div>
          <div className="text-right space-y-1">
            <div><p className="text-xs text-gray-500">Due Date</p><p className="font-medium text-sm">{formatDate(invoice.dueDate)}</p></div>
            {invoice.paidAt && <div><p className="text-xs text-gray-500">Paid On</p><p className="font-medium text-sm text-green-600">{formatDate(invoice.paidAt)}</p></div>}
            {invoice.job && <div><p className="text-xs text-gray-500">Job</p><Link href={`/jobs/${invoice.job.id}`} className="text-sm text-blue-600 hover:underline">{invoice.job.title}</Link></div>}
          </div>
        </div>

        <table className="w-full mb-4">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Unit Price</th>
              <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoice.items.map(item => (
              <tr key={item.id}>
                <td className="py-3 text-sm">{item.description}</td>
                <td className="py-3 text-sm text-right">{item.quantity}</td>
                <td className="py-3 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="py-3 text-sm font-medium text-right">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(invoice.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">GST</span><span>{formatCurrency(invoice.tax)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2"><span>Total</span><span>{formatCurrency(invoice.total)}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
