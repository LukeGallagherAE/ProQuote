'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2, CheckCircle, Send, X } from 'lucide-react';
import { formatCurrency, formatDate, QUOTE_STATUS_COLORS } from '@/lib/utils';

interface Quote {
  id: string; number: string; status: string;
  subtotal: number; tax: number; total: number;
  notes: string | null; validUntil: string | null; createdAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  job: { id: string; title: string } | null;
  items: { id: string; description: string; quantity: number; unitPrice: number; total: number }[];
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch(`/api/quotes/${id}`).then(r => r.json()).then(setQuote).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: string) {
    await fetch(`/api/quotes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  async function handleDelete() {
    if (!confirm('Delete this quote?')) return;
    await fetch(`/api/quotes/${id}`, { method: 'DELETE' });
    router.push('/quotes');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!quote) return <p className="text-red-600">Quote not found.</p>;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{quote.number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${QUOTE_STATUS_COLORS[quote.status]}`}>{quote.status}</span>
              <span className="text-xs text-gray-400">{formatDate(quote.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {quote.status === 'DRAFT' && (
            <button onClick={() => updateStatus('SENT')} className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Send className="w-4 h-4" /> Mark Sent
            </button>
          )}
          {quote.status === 'SENT' && (
            <>
              <button onClick={() => updateStatus('ACCEPTED')} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
                <CheckCircle className="w-4 h-4" /> Accept
              </button>
              <button onClick={() => updateStatus('REJECTED')} className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
                <X className="w-4 h-4" /> Reject
              </button>
            </>
          )}
          <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">Customer</p>
            <Link href={`/customers/${quote.customer.id}`} className="font-semibold text-blue-600 hover:underline">{quote.customer.name}</Link>
            {quote.customer.phone && <p className="text-sm text-gray-600">{quote.customer.phone}</p>}
            {quote.customer.email && <p className="text-sm text-gray-600">{quote.customer.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Valid Until</p>
            <p className="font-medium">{formatDate(quote.validUntil)}</p>
            {quote.job && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Job</p>
                <Link href={`/jobs/${quote.job.id}`} className="text-sm text-blue-600 hover:underline">{quote.job.title}</Link>
              </div>
            )}
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
            {quote.items.map(item => (
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
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(quote.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">GST</span><span>{formatCurrency(quote.tax)}</span></div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2">
              <span>Total</span><span>{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>

        {quote.notes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-1">Notes</p>
            <p className="text-sm text-gray-700">{quote.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
