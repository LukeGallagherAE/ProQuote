'use client';
import { signOut } from 'next-auth/react';
import { LogOut, Bell } from 'lucide-react';

interface Props {
  user?: { name?: string | null; email?: string | null };
}

export function Header({ user }: Props) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <button className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-none">{user?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="ml-2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
