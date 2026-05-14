'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Receipt,
  Calendar,
  UserCog,
  BarChart3,
  Wrench,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/schedule', label: 'Schedule', icon: Calendar },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/quotes', label: 'Quotes', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/team', label: 'Team', icon: UserCog },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 flex flex-col h-full">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-lg leading-none">ProQuote</span>
            <p className="text-slate-400 text-xs mt-0.5">Field Services</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-700">
        <p className="text-xs text-slate-500 px-3">© 2024 ProQuote</p>
      </div>
    </aside>
  );
}
