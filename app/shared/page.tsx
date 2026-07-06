'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search } from 'lucide-react';
import { db, LocalDocument } from '@/lib/indexeddb/db';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

export default function SharedDocuments() {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Load documents from IndexedDB instantly (Offline-First)
    const loadDocs = async () => {
      const docs = await db.documents.orderBy('updatedAt').reverse().toArray();
      setDocuments(docs);

      // Background Sync: Fetch from backend to update local storage
      try {
        const res = await fetch('/api/documents', { cache: 'no-store' });
        if (res.ok) {
          const serverDocs: LocalDocument[] = await res.json();
          // Sync server docs to IndexedDB by wiping and replacing
          await db.documents.clear();
          if (serverDocs && serverDocs.length > 0) {
            await db.documents.bulkPut(serverDocs);
          }
          // Update state with merged/latest docs
          const updatedDocs = await db.documents.orderBy('updatedAt').reverse().toArray();
          setDocuments(updatedDocs);
        } else {
          console.error('Failed to fetch documents from server, status:', res.status);
        }
      } catch (err) {
        console.warn('Offline mode: Could not fetch latest documents from server.', err);
      }
    };
    loadDocs();
  }, []);

  const displayedDocs = documents.filter(doc => doc.isShared);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.02)] rounded-l-2xl border-l border-slate-200">
        
        {/* Header */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-slate-100">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search shared documents..." 
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </header>

        {/* Document Grid */}
        <div className="p-8 overflow-y-auto">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-6">Shared with Me</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedDocs.map((doc, i) => (
              <div
                key={doc.id}
                onClick={() => router.push(`/documents/${doc.id}`)}
                className="bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 rounded-xl p-4 cursor-pointer group flex flex-col transition-all duration-200 hover:-translate-y-1"
              >
                <div className="h-32 bg-slate-50 rounded-lg mb-4 flex items-center justify-center group-hover:bg-blue-50 transition-colors border border-slate-100">
                   <FileText size={32} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="px-1">
                  <h3 className="font-semibold text-slate-800 text-base truncate">{doc.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Updated {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                  <div className="mt-4 flex items-center">
                    <span className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md font-bold uppercase tracking-wide">
                      {doc.role || 'shared'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {displayedDocs.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText size={48} className="mb-4 opacity-50 text-slate-300" />
                <p className="font-medium">No documents have been shared with you yet.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
