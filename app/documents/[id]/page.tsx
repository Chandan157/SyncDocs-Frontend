'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';

import { ArrowLeft, Sparkles, Share2, Clock, CheckCircle2, WifiOff, MoreVertical, ChevronRight, FileText, Star, Folder, Cloud, CloudOff, History, MessageSquare, Settings, LogOut } from 'lucide-react';
import { db } from '@/lib/indexeddb/db';

const TiptapEditor = dynamic(() => import('@/components/editor/TiptapEditor'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-500">Loading collaborative editor...</div>
});
export default function DocumentPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [title, setTitle] = useState('Untitled Document');
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string, email: string } | null>(null);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  const toggleHistory = async () => {
    setIsHistoryOpen(!isHistoryOpen);
    if (!isHistoryOpen && isOnline) {
      try {
        const res = await fetch(`/api/documents/${id}/history`);
        if (res.ok) {
          setHistoryData(await res.json());
        }
      } catch (err) {
        console.error('Failed to fetch history:', err);
      }
    }
  };

  useEffect(() => {
    // Basic offline/online detection
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initialize Auth & Fetch Document from Backend API
    const init = async () => {
      try {
        // Fetch current user details for the profile dropdown
        fetch('/api/auth/me')
          .then(res => res.json())
          .then(data => {
            if (!data.error) setCurrentUser(data);
          })
          .catch(err => console.error('Failed to fetch user:', err));

        // Fetch the token independently first so the editor can connect even if doc fetch fails
        const tokenRes = await fetch('/api/auth/token');
        if (tokenRes.ok) {
          const { token: wsToken } = await tokenRes.json();
          setToken(wsToken);
        }

        // Fetch document metadata from Next.js API route
        const res = await fetch(`/api/documents/${id}`);

        if (res.status === 403 || res.status === 401) {
          setError('You do not have access to this document or you are not logged in.');
          return;
        }

        if (res.ok) {
          const doc = await res.json();
          setTitle(doc.title);
          // Also sync to offline storage
          db.documents.put(doc).catch(console.error);
        } else {
          // Fallback to offline storage if server is unreachable
          const localDoc = await db.documents.get(id);
          if (localDoc) setTitle(localDoc.title);
        }
      } catch (err) {
        console.error('Error fetching document', err);
        // Fallback to offline storage
        const localDoc = await db.documents.get(id);
        if (localDoc) setTitle(localDoc.title);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [id, router]);

  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Debounce the title save to backend and local DB
  useEffect(() => {
    const saveTitle = async () => {
      if (title === 'Untitled Document' || !id) return; // Skip initial state or invalid id
      
      try {
        await db.documents.update(id, { title, updatedAt: new Date().toISOString() });
      } catch (err) {
        console.warn('Local document update failed, possibly missing:', err);
      }
      
      if (isOnline) {
        setIsSavingTitle(true);
        try {
          await fetch(`/api/documents/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title || 'Untitled Document' }) // Ensure a title is sent
          });
        } catch (err) {
          console.error('Failed to sync title update to server:', err);
        } finally {
          setIsSavingTitle(false);
        }
      }
    };

    const timeoutId = setTimeout(saveTitle, 500); // 500ms debounce
    return () => clearTimeout(timeoutId);
  }, [title, id, isOnline]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white shadow-xl rounded-xl border border-red-500/20">
          <div className="text-red-500 mb-4 flex justify-center"><WifiOff size={48} /></div>
          <h1 className="text-2xl font-bold mb-2 text-slate-800">Access Denied</h1>
          <p className="text-slate-500">{error}</p>
          <button onClick={() => router.push('/')} className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-lg shadow-sm">Return to Dashboard</button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500">Authenticating...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Main Editor Area */}
      <main className="flex-1 flex flex-col relative z-0 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-[#f9fbfd] border-b border-slate-200 shadow-sm min-h-[76px] py-4 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')} 
              className="relative flex items-center justify-center w-[44px] h-[44px] bg-gradient-to-b from-slate-800 to-slate-950 rounded-xl shadow-md cursor-pointer hover:shadow-lg hover:-translate-y-[1px] transition-all duration-300 group overflow-hidden border border-slate-700/80" 
              title="Back to Dashboard"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/40 via-transparent to-purple-500/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 to-transparent opacity-50" />
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400 group-hover:text-cyan-300 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 relative z-10">
                <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"/>
                <path d="M12 12V21"/>
                <path d="M20 7.5L12 12L4 7.5"/>
              </svg>
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <input 
                  value={title}
                  onChange={handleTitleChange}
                  className="bg-transparent text-[19px] font-medium text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#4285f4]/30 rounded px-2 py-1 w-64 truncate transition-all placeholder:text-slate-400"
                  placeholder="Untitled Document"
                />
                {isSavingTitle && <span className="text-xs text-slate-400">Saving...</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleHistory}
              className={`p-2 rounded-full transition-colors ${isHistoryOpen ? 'bg-[#e8f0fe] text-[#1967d2]' : 'hover:bg-slate-200 text-slate-600'}`}
              title="Version history"
            >
              <History size={22} strokeWidth={1.5} />
            </button>
            
            <div className="w-px h-8 bg-slate-300 mx-1"></div>

            {/* Portal for Share & Avatars */}
            <div id="editor-header-portal" className="flex items-center gap-4"></div>

            {/* Upgrade/AI Button */}
            <button 
              onClick={() => setIsAiOpen(!isAiOpen)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-medium transition-all text-[14px] shadow-sm ml-2 ${
                isAiOpen 
                ? 'bg-[#d2e3fc] text-[#1967d2] shadow-inner' 
                : 'bg-[#e8f0fe] text-[#1967d2] hover:bg-[#d2e3fc]'
              }`}
            >
              <Sparkles size={16} />
              AI Boost
            </button>

            {/* Profile Option */}
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[15px] shadow-sm hover:shadow-md hover:scale-105 transition-all ml-4 border-2 border-white ring-1 ring-slate-200/80 cursor-pointer"
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
                    className="absolute right-0 top-[52px] w-72 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-slate-100 z-50 overflow-hidden"
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
                           router.push('/');
                           // Note: to fully logout server-side, call the logout Server Action here
                           // by importing it, but since this is a simple UI update we just clear indexedDB and push to index
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

        <div className="flex-1 py-12 px-4 w-full">
          {/* Tiptap Editor handles the document state */}
          <TiptapEditor documentId={id} />
        </div>
      </main>

      {/* AI Assistant Sidebar */}
      <AnimatePresence>
        {isAiOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-slate-200 bg-slate-50 flex flex-col z-20"
          >
            <div className="p-4 border-b border-slate-200 flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              <h2 className="font-semibold text-slate-800 text-sm">AI Assistant</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
               {/* Minimal AI Options */}
               <div className="space-y-2">
                 {['Summarize', 'Fix Grammar', 'Make it Professional', 'Continue Writing'].map((opt) => (
                   <button key={opt} className="w-full p-3 text-left bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm rounded-xl transition-all text-sm font-medium text-slate-700">
                     {opt}
                   </button>
                 ))}
               </div>
               
               {/* Chat Interface Placeholder */}
               <div className="mt-8">
                 <div className="bg-white p-4 rounded-xl text-sm border border-purple-100 shadow-sm text-slate-600 leading-relaxed">
                    Hello! I'm your AI assistant. Select text in the editor to get started or ask me to generate something new.
                 </div>
               </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Version History Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-slate-200 bg-[#f8f9fa] flex flex-col z-20"
          >
            <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-[#f8f9fa]">
              <h2 className="text-lg text-slate-800">Version history</h2>
              <button className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><MoreVertical size={20} /></button>
            </div>
            
            <div className="p-4 border-b border-slate-200">
               <select className="w-full bg-white border border-slate-300 text-slate-700 py-1.5 px-3 rounded text-sm outline-none focus:border-blue-500">
                 <option>All versions</option>
                 <option>Named versions</option>
               </select>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-3 ml-2 uppercase tracking-wide">Today</h3>
                <div className="space-y-1">
                  {historyData.map((ver, idx) => (
                    <div 
                      key={ver.id} 
                      className={`relative flex items-start gap-2 p-3 rounded-xl cursor-pointer transition-colors ${ver.isCurrent ? 'bg-white shadow-sm ring-1 ring-blue-500' : 'hover:bg-white/60 hover:shadow-sm'}`}
                    >
                      {ver.isCurrent && (
                        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2">
                          <ChevronRight size={16} className="text-slate-400" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-slate-900 text-sm">
                            {new Date(ver.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}, {new Date(ver.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <button className="text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100"><MoreVertical size={16} /></button>
                        </div>
                        {ver.isCurrent && <div className="text-xs text-slate-500 mb-1.5 font-medium">Current version</div>}
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <div className={`w-2 h-2 rounded-full ${ver.color || 'bg-emerald-500'}`} />
                          <span className="truncate">{ver.author}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {historyData.length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-400">
                      No history found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
