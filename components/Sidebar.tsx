'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Users, Trash, Settings, LogOut } from 'lucide-react';
import { db } from '@/lib/indexeddb/db';
import { useState, useEffect } from 'react';
export function Sidebar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<{ id: string, email: string } | null>(null);
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setCurrentUser(data);
      })
      .catch(console.error);
  }, []);
  return (
    <aside 
      className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col z-10"
    >
      <div className="p-6">
        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">
          SyncDocs
        </h1>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        <Link 
          href="/"
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg font-medium transition-colors text-sm ${pathname === '/' ? 'bg-blue-100/50 text-blue-700' : 'hover:bg-slate-200/50 text-slate-600'}`}
        >
          <FileText size={16} />
          Documents
        </Link>
        <Link 
          href="/shared"
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg font-medium transition-colors text-sm ${pathname === '/shared' ? 'bg-blue-100/50 text-blue-700' : 'hover:bg-slate-200/50 text-slate-600'}`}
        >
          <Users size={16} />
          Shared with me
        </Link>
        <Link 
          href="/trash"
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg font-medium transition-colors text-sm ${pathname === '/trash' ? 'bg-blue-100/50 text-blue-700' : 'hover:bg-slate-200/50 text-slate-600'}`}
        >
          <Trash size={16} />
          Trash
        </Link>
      </nav>
      <div className="p-4 border-t border-slate-200 space-y-1">
        <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-slate-200/50 text-slate-600 font-medium transition-colors text-sm">
          <Settings size={16} />
          Settings
        </button>
        <button 
          onClick={async () => {
            await db.documents.clear();
            await db.operations.clear();
            await db.versions.clear();
            const { logout } = await import('@/app/(auth)/actions');
            await logout();
          }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-red-50 text-red-600 font-medium transition-colors text-sm mt-1"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
