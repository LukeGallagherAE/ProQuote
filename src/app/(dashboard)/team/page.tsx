'use client';
import { useEffect, useState } from 'react';
import { Plus, User, Phone, Mail, Briefcase, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Member {
  id: string; name: string; email: string; role: string;
  phone: string | null; createdAt: string;
  _count: { jobs: number };
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  TECHNICIAN: 'bg-gray-100 text-gray-700',
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'TECHNICIAN', phone: '' });

  function load() {
    fetch('/api/team').then(r => r.json()).then(setMembers).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm({ name: '', email: '', password: '', role: 'TECHNICIAN', phone: '' });
      setShowForm(false);
      load();
    } else {
      const d = await res.json();
      setError(d.error || 'Failed to create member');
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from the team?`)) return;
    await fetch(`/api/team/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 text-sm">{members.length} team members</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">New Team Member</h2>
          {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
                <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Min. 8 characters" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="TECHNICIAN">Technician</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0400 000 000" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                {saving ? 'Adding…' : 'Add Member'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-sm font-medium text-gray-700 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{m.name.charAt(0).toUpperCase()}</span>
                </div>
                <button onClick={() => handleDelete(m.id, m.name)}
                  className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-gray-900">{m.name}</h3>
              <span className={`inline-flex mt-1 px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[m.role] ?? 'bg-gray-100 text-gray-700'}`}>{m.role}</span>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail className="w-3 h-3" />{m.email}</div>
                {m.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="w-3 h-3" />{m.phone}</div>}
                <div className="flex items-center gap-1.5 text-xs text-gray-500"><Briefcase className="w-3 h-3" />{m._count.jobs} assigned jobs</div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400"><User className="w-3 h-3" />Member since {formatDate(m.createdAt)}</div>
              </div>
            </div>
          ))}
          {members.length === 0 && <div className="col-span-full text-center py-16 text-gray-400 text-sm">No team members yet.</div>}
        </div>
      )}
    </div>
  );
}
