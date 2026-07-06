'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Plus, Search, Settings, Trash, Users, LogOut, Edit2 } from 'lucide-react';
import { db, LocalDocument } from '@/lib/indexeddb/db';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';

export default function Dashboard() {
  const [documents, setDocuments] = useState<LocalDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<{ id: string, email: string } | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Fetch current user
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setCurrentUser(data);
      })
      .catch(console.error);

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

// ... (in component)
  const createNewDocument = async () => {
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'Untitled Document' })
      });

      if (res.ok) {
        const newDoc = await res.json();
        
        // Save to IndexedDB for offline access
        const localDoc: LocalDocument = {
          id: newDoc.id,
          title: newDoc.title,
          ownerId: newDoc.ownerId,
          createdAt: newDoc.createdAt,
          updatedAt: newDoc.updatedAt,
        };
        await db.documents.add(localDoc);
        
        // Navigate to the newly created document
        router.push(`/documents/${newDoc.id}`);
      } else {
        alert('Failed to create document on server.');
      }
    } catch (err) {
      console.error('Error creating document:', err);
      alert('Network error. Cannot create documents offline yet.');
    }
  };

  const deleteDocument = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent navigation
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    // Optimistic UI update
    setDocuments(prev => prev.filter(d => d.id !== id));
    await db.documents.delete(id);
    
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        throw new Error('Failed to delete on server');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      // Not restoring UI silently, but alerting the user is good practice
    }
  };

  const startEditing = (e: React.MouseEvent, doc: LocalDocument) => {
    e.stopPropagation();
    setEditingId(doc.id);
    setEditTitle(doc.title);
  };

  const saveTitle = async (id: string) => {
    setEditingId(null);
    if (!editTitle.trim()) return;

    setDocuments(prev => prev.map(d => d.id === id ? { ...d, title: editTitle.trim() } : d));
    await db.documents.update(id, { title: editTitle.trim(), updatedAt: new Date().toISOString() });

    try {
      await fetch(`/api/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() })
      });
    } catch (err) {
      console.error('Failed to sync title update to server:', err);
    }
  };

  const displayedDocs = documents.filter(doc => {
    if (doc.isShared) return false;
    if (searchQuery.trim() === '') return true;
    return doc.title.toLowerCase().includes(searchQuery.toLowerCase());
  });

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
              placeholder="Search documents..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={createNewDocument}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm rounded-lg font-medium shadow-sm transition-all"
            >
              <Plus size={16} />
              New Document
            </button>

            {/* Profile Option */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[13px] shadow-sm hover:shadow-md hover:scale-105 transition-all border-2 border-white ring-1 ring-slate-200/80 cursor-pointer"
                title={currentUser ? `Google Account\n${currentUser.email.split('@')[0]}\n${currentUser.email}` : "Loading..."}
              >
                {currentUser ? currentUser.email.charAt(0).toUpperCase() : 'U'}
              </button>
              
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 top-[48px] w-72 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-100 z-50 overflow-hidden"
                  >
                    <div className="p-6 border-b border-slate-100 flex flex-col items-center">
                       <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl mb-3 shadow-md border-4 border-white ring-1 ring-slate-100">
                         {currentUser ? currentUser.email.charAt(0).toUpperCase() : 'U'}
                       </div>
                       <h3 className="font-bold text-slate-800 text-lg">{currentUser ? currentUser.email.split('@')[0] : 'User'}</h3>
                       <p className="text-slate-500 text-sm">{currentUser ? currentUser.email : 'Loading...'}</p>
                    </div>
                    <div className="p-2">
                      <button className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center gap-3">
                        <Settings size={18} className="text-slate-400" /> Manage your Account
                      </button>
                      <button 
                        onClick={async () => {
                           await db.documents.clear();
                           await db.operations.clear();
                           await db.versions.clear();
                           const { logout } = await import('@/app/(auth)/actions');
                           await logout();
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors flex items-center gap-3 mt-1"
                      >
                        <LogOut size={18} className="text-red-400" /> Sign out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Document Grid */}
        <div className="p-8 overflow-y-auto">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight mb-6">Recent Documents</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedDocs.map((doc, i) => (
              <div
                key={doc.id}
                onClick={() => { if (editingId !== doc.id) router.push(`/documents/${doc.id}`) }}
                className="bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 rounded-xl p-4 cursor-pointer group flex flex-col transition-all duration-200 hover:-translate-y-1 relative"
              >
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-1">
                   <button 
                     onClick={(e) => startEditing(e, doc)}
                     className="p-1.5 bg-white text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md shadow-sm border border-slate-100 transition-colors"
                     title="Edit title"
                   >
                     <Edit2 size={14} />
                   </button>
                   <button 
                     onClick={(e) => deleteDocument(e, doc.id)}
                     className="p-1.5 bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md shadow-sm border border-slate-100 transition-colors"
                     title="Delete document"
                   >
                     <Trash size={14} />
                   </button>
                </div>
                <div className="h-32 bg-slate-50 rounded-lg mb-4 flex items-center justify-center group-hover:bg-blue-50 transition-colors border border-slate-100">
                   <FileText size={32} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="px-1" onClick={e => { if (editingId === doc.id) e.stopPropagation(); }}>
                  {editingId === doc.id ? (
                    <input 
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => saveTitle(doc.id)}
                      onKeyDown={e => { if (e.key === 'Enter') saveTitle(doc.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="font-semibold text-slate-800 text-base truncate bg-blue-50 border border-blue-200 rounded px-1 -ml-1 outline-none focus:ring-2 focus:ring-blue-500/30 w-full"
                    />
                  ) : (
                    <h3 className="font-semibold text-slate-800 text-base truncate">{doc.title}</h3>
                  )}
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Updated {new Date(doc.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            
            {documents.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                <FileText size={48} className="mb-4 opacity-50 text-slate-300" />
                <p className="font-medium">No documents yet. Create one to get started!</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
