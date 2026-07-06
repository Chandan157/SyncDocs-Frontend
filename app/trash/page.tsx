'use client';
import { motion } from 'framer-motion';
import { Search, Trash2 } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
export default function TrashDocuments() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {}
      <Sidebar />
      {}
      <main className="flex-1 flex flex-col relative z-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.02)] rounded-l-2xl border-l border-slate-200">
        {}
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-100">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search trash..." 
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </header>
        {}
        <div className="p-8 overflow-y-auto">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-6">Trash</h2>
          <div className="flex flex-col items-center justify-center py-32 text-slate-400">
            <Trash2 size={48} className="mb-4 opacity-50 text-slate-300" />
            <h3 className="text-lg font-semibold text-slate-800 mb-1">Trash is empty</h3>
            <p className="text-sm font-medium">Items moved to the trash will appear here.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
