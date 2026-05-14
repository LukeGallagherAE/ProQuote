'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, CheckCircle, Clock, MapPin, User, FileText, Receipt } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime, JOB_STATUS_COLORS, JOB_STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/utils';

interface TeamMember { id: string; name: string; }
interface Job {
  id: string; title: string; description: string | null; status: string; priority: string;
  scheduledAt: string | null; completedAt: string | null; address: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
  customer: { id: string; name: string; email: string | null; phone: string | null; address: string | null };
  assignee: { id: string; name: string; email: string; phone: string | null } | null;
  quote: { id: string; number: string; total: number; status: string } | null;
  invoice: { id: string; number: string; total: number; status: string } | null;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', status: '', priority: '', assignedId: '', scheduledAt: '', address: '', notes: '' });

  useEffect(() => {
    Promise.all([
      fetch(`/api/jobs/${id}`).then(r => r.json()),
      fetch('/api/team').then(r => r.json()),
    ]).then(([j, t]) => {
      setJob(j);
      setTeam(t);
      setForm({
        title: j.title,
        description: j.description ?? '',
        status: j.status,
        priority: j.priority,
        assignedId: j.assignee?.id ?? '',
        scheduledAt: j.scheduledAt ? new Date(j.scheduledAt).toISOString().slice(0, 16) : '',
        address: j.address ?? '',
        notes: j.notes ?? '',
      });
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, assignedId: form.assignedId || null, scheduledAt: form.scheduledAt || null }),
    });
    if (res.ok) {
      const updated = await fetch(`/api/jobs/${id}`).then(r => r.json());
      setJob(updated);
      setEditing(false);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Delete this job? This cannot be undone.')) return;
    await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
    router.push('/jobs');
  }

  async function markComplete() {
    const res = await fetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    if (res.ok) {
      const updated = await fetch(`/api/jobs/${id}`).then(r => r.json());
      setJob(updated);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  if (!job) return <p className="text-red-600">Job not found.</p>;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${JOB_STATUS_COLORS[job.status]}`}>
                {JOB_STATUS_LABELS[job.status]}
              </span>
              <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[job.priority]}`}>
                {PRIORITY_LABELS[job.priority]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {job.status !== 'COMPLETED' && job.status !== 'CANCELLED' && (
            <button onClick={markComplete} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">
              <CheckCircle className="w-4 h-4" /> Mark Complete
            </button>
          )}
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-2 px-3 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
            <Edit className="w-4 h-4" /> {editing ? 'Cancel Edit' : 'Edit'}
          </button>
          <button onClick={handleDelete} className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Edit Job</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="PENDING">Pending</option><option value="SCHEDULED">Scheduled</option>
                <option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="LOW">Low</option><option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option><option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select value={form.assignedId} onChange={e => setForm(f => ({ ...f, assignedId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Unassigned</option>
                {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
              <input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(false)}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Job Details</h2>
              {job.description && <p className="text-sm text-gray-700 mb-4">{job.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Scheduled</p>
                    <p className="font-medium">{formatDateTime(job.scheduledAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs">Completed</p>
                    <p className="font-medium">{formatDateTime(job.completedAt)}</p>
                  </div>
                </div>
                {job.address && (
                  <div className="flex items-start gap-2 col-span-2">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-500 text-xs">Address</p>
                      <p className="font-medium">{job.address}</p>
                    </div>
                  </div>
                )}
              </div>
              {job.notes && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Internal Notes</p>
                  <p className="text-sm text-gray-700">{job.notes}</p>
                </div>
              )}
            </div>

            {/* Quote & Invoice */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 text-sm">Quote</h3>
                </div>
                {job.quote ? (
                  <div>
                    <Link href={`/quotes/${job.quote.id}`} className="text-blue-600 text-sm font-medium hover:underline">{job.quote.number}</Link>
                    <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(job.quote.total)}</p>
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 mt-1">{job.quote.status}</span>
                  </div>
                ) : (
                  <Link href={`/quotes/new?jobId=${job.id}`} className="text-sm text-blue-600 hover:underline">Create quote</Link>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 text-sm">Invoice</h3>
                </div>
                {job.invoice ? (
                  <div>
                    <Link href={`/invoices/${job.invoice.id}`} className="text-blue-600 text-sm font-medium hover:underline">{job.invoice.number}</Link>
                    <p className="text-lg font-bold text-gray-900 mt-1">{formatCurrency(job.invoice.total)}</p>
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 mt-1">{job.invoice.status}</span>
                  </div>
                ) : (
                  <Link href={`/invoices/new?jobId=${job.id}`} className="text-sm text-blue-600 hover:underline">Create invoice</Link>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Customer</h3>
              <div className="space-y-2 text-sm">
                <Link href={`/customers/${job.customer.id}`} className="font-medium text-blue-600 hover:underline block">{job.customer.name}</Link>
                {job.customer.phone && <p className="text-gray-600">{job.customer.phone}</p>}
                {job.customer.email && <p className="text-gray-600">{job.customer.email}</p>}
                {job.customer.address && <p className="text-gray-500 text-xs">{job.customer.address}</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Assigned To</h3>
              {job.assignee ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{job.assignee.name}</p>
                    {job.assignee.phone && <p className="text-xs text-gray-500">{job.assignee.phone}</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Unassigned</p>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-3">Timeline</h3>
              <div className="space-y-2 text-xs text-gray-500">
                <div><span className="font-medium">Created:</span> {formatDate(job.createdAt)}</div>
                <div><span className="font-medium">Updated:</span> {formatDate(job.updatedAt)}</div>
                {job.scheduledAt && <div><span className="font-medium">Scheduled:</span> {formatDate(job.scheduledAt)}</div>}
                {job.completedAt && <div><span className="font-medium">Completed:</span> {formatDate(job.completedAt)}</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
