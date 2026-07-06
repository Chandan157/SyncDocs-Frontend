'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import { Heading } from '@tiptap/extension-heading';
import { ListItem } from '@tiptap/extension-list-item';
import { Table } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { OTClient, Operation } from './ot/OTClient';
import { db } from '@/lib/indexeddb/db';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, List, ListOrdered, Quote, Code, Undo, Redo, Printer, SpellCheck, Paintbrush, Minus, Plus, Type, Highlighter, Link as LinkIcon, MessageSquarePlus, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify, ListTodo, Outdent, Indent, Eraser, ChevronDown, Lock } from 'lucide-react';
import Underline from '@tiptap/extension-underline';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
export default function TiptapEditor({ documentId }: { documentId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const otClientRef = useRef<OTClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeUsers, setActiveUsers] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch('/api/auth/token')
      .then(res => res.json())
      .then(data => {
        if (data.token) setToken(data.token);
      });
  }, []);
  const isApplyingRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      FontFamily,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      TiptapImage
    ],
    content: '',
    editable: isReady,
    immediatelyRender: false,
    onTransaction: ({ transaction, editor }) => {
      if (transaction.docChanged && !isApplyingRef.current) {
        const html = editor.getHTML();
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          db.documents.update(documentId, { content: html, updatedAt: new Date().toISOString() }).catch(() => {});
        }, 500);
        if (otClientRef.current) {
          otClientRef.current.applyLocalOperation({
            type: 'replace',
            position: 0,
            length: 999999,
            text: html
          });
        }
      }
    }
  });
  useEffect(() => {
    if (!editor) return;
    let isMounted = true;
    db.documents.get(documentId).then(localDoc => {
      if (!isMounted) return;
      if (localDoc && editor.isEmpty) {
        isApplyingRef.current = true;
        editor.commands.setContent(localDoc.content || '');
        isApplyingRef.current = false;
      }
      setIsReady(true);
      editor.setEditable(true); 
    }).catch(console.error);
    return () => { isMounted = false; };
  }, [editor, documentId]);
  useEffect(() => {
    if (!token || !editor) return;
    let wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:1234';
      wsUrl = backendUrl.replace(/^http/, 'ws');
    }
    const client = new OTClient(wsUrl, documentId, token);
    otClientRef.current = client;
    client.onDocumentLoaded = (serverContent: string, role?: string) => {
      if (role) setMyRole(role);
      if (!editor || editor.isDestroyed) return;
      const localContent = editor.getHTML();
      const isEmpty = (html: string) => {
        if (!html) return true;
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === '';
      };
      const serverEmpty = isEmpty(serverContent);
      const localEmpty = isEmpty(localContent);
      const rawServer = (serverContent || '').replace(/<p><br><\/p>/g, '').replace(/<p><\/p>/g, '').trim();
      const rawLocal = (localContent || '').replace(/<p><br><\/p>/g, '').replace(/<p><\/p>/g, '').trim();
      if (!serverEmpty && !localEmpty && rawServer !== rawLocal && role !== 'viewer') {
        setConflictState({ serverContent, localContent });
      } else {
        if (serverEmpty && !localEmpty) {
            if (otClientRef.current) {
              otClientRef.current.clearPendingOperations();
              otClientRef.current.applyLocalOperation({ type: 'replace', position: 0, text: localContent });
            }
        } else if (rawServer === rawLocal && otClientRef.current) {
            otClientRef.current.clearPendingOperations();
        } else {
            isApplyingRef.current = true;
            editor.commands.setContent(serverContent);
            isApplyingRef.current = false;
            if (otClientRef.current) {
              otClientRef.current.clearPendingOperations();
            }
        }
      }
      setIsReady(true);
      editor.setEditable(role !== 'viewer');
    };
    client.onIncomingOperation = (op: Operation) => {
      if (!editor || editor.isDestroyed) return;
      if (op.type === 'replace' && op.position === 0) {
        isApplyingRef.current = true;
        const { from, to } = editor.state.selection;
        editor.chain()
          .setContent(op.text || '')
          .setTextSelection({ from, to })
          .run();
        isApplyingRef.current = false;
      }
    };
    client.onUserJoined = (userId) => {
      setActiveUsers(prev => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    };
    client.onUserLeft = (userId) => {
      setActiveUsers(prev => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    };
    return () => {
      client.destroy();
    };
  }, [token, documentId, editor]);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState('viewer');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fontSize, setFontSize] = useState(11);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [sharedMembers, setSharedMembers] = useState<any[]>([]);
  const [isFetchingMembers, setIsFetchingMembers] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const findPortal = () => {
      const el = document.getElementById('editor-header-portal');
      if (el) setPortalTarget(el);
      else setTimeout(findPortal, 100);
    };
    findPortal();
  }, []);
  const [conflictState, setConflictState] = useState<{serverContent: string, localContent: string} | null>(null);
  const fetchMembers = async () => {
    setIsFetchingMembers(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/members`);
      if (res.ok) {
        setSharedMembers(await res.json());
      }
    } catch(e) {}
    setIsFetchingMembers(false);
  };
  const handleShare = async (targetEmail: string, targetRole: string) => {
    try {
      const res = await fetch(`/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, role: targetRole })
      });
      const data = await res.json();
      if (res.ok) {
        setShareEmail('');
        fetchMembers(); 
      } else {
        alert('Error: ' + data.error);
      }
    } catch(e) {
      alert('Failed to update share.');
    }
  };
  useEffect(() => {
    if (otClientRef.current) {
      otClientRef.current.onError = (msg: string) => setSyncError(msg);
      const oldOnLoaded = otClientRef.current.onDocumentLoaded;
      otClientRef.current.onDocumentLoaded = (content, role) => {
        if (role) setMyRole(role);
        if (oldOnLoaded) oldOnLoaded(content, role);
      };
      otClientRef.current.onReconnectDocumentLoaded = (serverContent, role) => {
        if (role) setMyRole(role);
        let localContent = '';
        if (editor && !editor.isDestroyed) {
          try {
            localContent = editor.getHTML();
          } catch (err) {
            console.warn('Could not read local content during reconnect:', err);
          }
        }
        const isEmpty = (html: string) => {
          if (!html) return true;
          return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim() === '';
        };
        const serverEmpty = isEmpty(serverContent);
        const localEmpty = isEmpty(localContent);
        const rawServer = (serverContent || '').replace(/<p><br><\/p>/g, '').replace(/<p><\/p>/g, '').trim();
        const rawLocal = (localContent || '').replace(/<p><br><\/p>/g, '').replace(/<p><\/p>/g, '').trim();
        if (!serverEmpty && !localEmpty && rawServer !== rawLocal && role !== 'viewer') {
          setConflictState({ serverContent, localContent });
        } else {
          if (serverEmpty && !localEmpty) {
            if (otClientRef.current) {
              otClientRef.current.clearPendingOperations();
              otClientRef.current.applyLocalOperation({ type: 'replace', position: 0, text: localContent });
            }
          } else if (rawServer === rawLocal && otClientRef.current) {
            otClientRef.current.clearPendingOperations();
          } else {
            if (editor && !editor.isDestroyed) {
              isApplyingRef.current = true;
              editor.commands.setContent(serverContent);
              isApplyingRef.current = false;
            }
            if (otClientRef.current) {
              otClientRef.current.clearPendingOperations();
            }
          }
        }
      };
    }
  }, [token, documentId, editor]);
  if (syncError) {
    return <div className="p-8 text-red-500 font-bold bg-red-50 h-full">Connection Error: {syncError}</div>;
  }
  if (!editor) return <div className="p-8">Loading OT Engine...</div>;
  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden relative border border-slate-200 rounded-xl shadow-sm">
      <div className="h-10 border-b border-slate-200 flex items-center px-2 bg-slate-50 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
           <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30" title="Undo"><Undo size={14} /></button>
           <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30" title="Redo"><Redo size={14} /></button>
           <div className="relative flex items-center ml-1 mr-2">
             <select 
               className="appearance-none pl-1 pr-5 py-1 rounded hover:bg-slate-200 cursor-pointer text-sm text-slate-600 bg-transparent outline-none"
               value={zoom}
               onChange={e => setZoom(Number(e.target.value))}
             >
               <option value={0.5}>50%</option>
               <option value={0.75}>75%</option>
               <option value={1}>100%</option>
               <option value={1.5}>150%</option>
               <option value={2}>200%</option>
             </select>
             <ChevronDown size={14} className="absolute right-1 pointer-events-none text-slate-600" />
           </div>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <div className="relative flex items-center ml-1 mr-2">
             <select
               className="appearance-none pl-2 pr-6 py-1 rounded hover:bg-slate-200 cursor-pointer text-sm text-slate-600 min-w-[100px] bg-transparent outline-none"
               value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
               onChange={(e) => {
                 const val = e.target.value;
                 if (val === 'p') editor.chain().focus().setParagraph().run();
                 else editor.chain().focus().toggleHeading({ level: parseInt(val.replace('h', '')) as any }).run();
               }}
             >
               <option value="p">Normal text</option>
               <option value="h1">Heading 1</option>
               <option value="h2">Heading 2</option>
               <option value="h3">Heading 3</option>
             </select>
             <ChevronDown size={14} className="absolute right-1 pointer-events-none text-slate-600" />
           </div>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <div className="relative flex items-center ml-1 mr-2">
             <select
               className="appearance-none pl-2 pr-6 py-1 rounded hover:bg-slate-200 cursor-pointer text-sm text-slate-600 min-w-[80px] bg-transparent outline-none"
               value={editor.getAttributes('textStyle').fontFamily || 'Arial'}
               onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
             >
               <option value="Arial">Arial</option>
               <option value="Courier New">Courier New</option>
               <option value="Georgia">Georgia</option>
               <option value="Times New Roman">Times</option>
               <option value="Verdana">Verdana</option>
             </select>
             <ChevronDown size={14} className="absolute right-1 pointer-events-none text-slate-600" />
           </div>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <div className="flex items-center ml-1 mr-1">
             <button onClick={() => {
               const newSize = Math.max(1, fontSize - 1);
               setFontSize(newSize);
               editor.chain().focus().setMark('textStyle', { fontSize: `${newSize}pt` }).run();
             }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600"><Minus size={14} /></button>
             <span className="w-8 text-center text-sm border border-slate-300 rounded mx-1 select-none">{fontSize}</span>
             <button onClick={() => {
               const newSize = fontSize + 1;
               setFontSize(newSize);
               editor.chain().focus().setMark('textStyle', { fontSize: `${newSize}pt` }).run();
             }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-600"><Plus size={14} /></button>
           </div>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <button onClick={() => editor.chain().focus().toggleBold().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('bold') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Bold"><Bold size={14} /></button>
           <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('italic') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Italic"><Italic size={14} /></button>
           <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('underline') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Underline"><UnderlineIcon size={14} /></button>
           <button onClick={() => editor.chain().focus().setColor('#000000').run()} className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200 border-b-4 border-black box-border" title="Text color"><Type size={14} /></button>
           <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('highlight') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Highlight color"><Highlighter size={14} /></button>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <button onClick={() => {
             const url = window.prompt('URL');
             if (url) editor.chain().focus().setLink({ href: url }).run();
           }} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('link') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Insert link"><LinkIcon size={14} /></button>
           <button onClick={() => {
             const url = window.prompt('Image URL');
             if (url) editor.chain().focus().setImage({ src: url }).run();
           }} className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200" title="Insert image"><ImageIcon size={14} /></button>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Align left"><AlignLeft size={14} /></button>
           <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Center align"><AlignCenter size={14} /></button>
           <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Align right"><AlignRight size={14} /></button>
           <button onClick={() => editor.chain().focus().setTextAlign('justify').run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive({ textAlign: 'justify' }) ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Justify"><AlignJustify size={14} /></button>
           <div className="w-px h-5 bg-slate-300 mx-1"></div>
           <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('taskList') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Checklist"><ListTodo size={14} /></button>
           <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Bulleted list"><List size={14} /></button>
           <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`w-7 h-7 flex items-center justify-center rounded ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-200'}`} title="Numbered list"><ListOrdered size={14} /></button>
           <button onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-200" title="Clear formatting"><Eraser size={14} /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-100 p-8">
        <div 
          className="max-w-4xl mx-auto min-h-[1056px] bg-white shadow-md ring-1 ring-slate-200 sm:rounded-lg p-12 transition-all"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', marginBottom: `${(zoom - 1) * 1056}px` }}
        >
          <EditorContent 
            editor={editor} 
            className="prose prose-lg prose-slate max-w-none outline-none focus:outline-none min-h-[800px]"
          />
        </div>
      </div>
      {isShareOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[90vh]">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Share Document</h3>
            <div className="flex gap-2 mb-6">
              <input 
                type="email" 
                value={shareEmail}
                onChange={e => setShareEmail(e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                placeholder="colleague@example.com"
              />
              <select 
                value={shareRole}
                onChange={e => setShareRole(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none text-sm cursor-pointer"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <button 
                onClick={() => handleShare(shareEmail, shareRole)}
                disabled={!shareEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors text-sm shadow-sm"
              >
                Invite
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-[200px] mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">People with access</h4>
              {isFetchingMembers ? (
                <div className="text-sm text-slate-500 text-center py-4">Loading members...</div>
              ) : sharedMembers.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-4">No one has been invited yet.</div>
              ) : (
                <div className="space-y-1">
                  {sharedMembers.map(member => (
                    <div key={member.userId} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                      <div className="text-sm font-medium text-slate-700">{member.email}</div>
                      <select 
                        value={member.role}
                        onChange={(e) => handleShare(member.email, e.target.value)}
                        className="px-2 py-1 text-xs border border-transparent hover:border-slate-200 bg-transparent hover:bg-white rounded outline-none cursor-pointer text-slate-600 transition-all focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="remove" className="text-red-500">Remove access</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-2">
              <button 
                onClick={() => setIsShareOpen(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium transition-colors text-sm shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      {portalTarget && createPortal(
        <>
          <div className="flex -space-x-2">
             {Array.from(activeUsers).map(u => (
                <div key={u} className="w-[34px] h-[34px] rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-black/5" title={u}>
                   {u.substring(0, 2).toUpperCase()}
                </div>
             ))}
          </div>
          {myRole !== 'viewer' && (
            <div className="flex items-center bg-[#c2e7ff] text-[#001d35] rounded-full overflow-hidden transition-colors hover:bg-[#b0dcf5] ml-1 shadow-sm">
              <button 
                onClick={() => {
                  setIsShareOpen(true);
                  fetchMembers();
                }}
                className="flex items-center gap-2 pl-4 pr-3 py-2 text-[14px] font-medium hover:bg-black/5 transition-colors"
              >
                <Lock size={16} strokeWidth={2.5} />
                Share
              </button>
              <div className="w-px h-5 bg-[#001d35]/20"></div>
              <button 
                onClick={() => {
                  setIsShareOpen(true);
                  fetchMembers();
                }}
                className="px-2 py-2 hover:bg-black/5 transition-colors"
              >
                <ChevronDown size={16} strokeWidth={2.5} />
              </button>
            </div>
          )}
        </>,
        portalTarget
      )}
      {conflictState && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-slate-200">
            <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Sync Conflict Detected</h2>
            <p className="text-slate-500 mb-6 font-medium">You made changes while offline, but the server has a newer version. Please choose which version to keep.</p>
            <div className="flex-1 grid grid-cols-2 gap-8 overflow-hidden">
              {}
              <div className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-slate-200">
                <div className="bg-slate-50 p-4 font-bold text-slate-700 text-center border-b border-slate-200 flex justify-between items-center">
                  <span>Your Offline Changes</span>
                  <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">Unsaved</span>
                </div>
                <div className="flex-1 overflow-auto p-6 prose prose-slate max-w-none bg-white" dangerouslySetInnerHTML={{ __html: conflictState.localContent }} />
                <div className="p-4 border-t border-slate-200 bg-slate-50">
                  <button 
                    onClick={() => {
                      if (otClientRef.current) {
                        otClientRef.current.clearPendingOperations();
                        otClientRef.current.applyLocalOperation({ 
                          type: 'replace', 
                          position: 0, 
                          text: conflictState.localContent 
                        });
                      }
                      setConflictState(null);
                    }}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-lg font-medium transition-all shadow-sm"
                  >
                    Keep My Offline Changes
                  </button>
                </div>
              </div>
              {}
              <div className="flex flex-col rounded-xl overflow-hidden shadow-sm border border-emerald-200">
                <div className="bg-emerald-50 p-4 font-bold text-emerald-800 text-center border-b border-emerald-200 flex justify-between items-center">
                  <span>Current Server Version</span>
                  <span className="bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-xs">Canonical</span>
                </div>
                <div className="flex-1 overflow-auto p-6 prose prose-slate max-w-none bg-white" dangerouslySetInnerHTML={{ __html: conflictState.serverContent }} />
                <div className="p-4 border-t border-emerald-100 bg-emerald-50">
                  <button 
                    onClick={() => {
                      if (editor) {
                        isApplyingRef.current = true;
                        editor.commands.setContent(conflictState.serverContent);
                        isApplyingRef.current = false;
                      }
                      if (otClientRef.current) {
                        otClientRef.current.clearPendingOperations();
                      }
                      setConflictState(null);
                    }}
                    className="w-full py-2.5 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-100 active:scale-[0.98] rounded-lg font-medium transition-all shadow-sm"
                  >
                    Discard Mine & Keep Server
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-slate-200">
               <button 
                 onClick={() => {
                   const mergedContent = conflictState.serverContent + '<p><br/></p><p><strong>--- Your Offline Changes ---</strong></p><p><br/></p>' + conflictState.localContent;
                   if (editor) {
                     isApplyingRef.current = true;
                     editor.commands.setContent(mergedContent);
                     isApplyingRef.current = false;
                   }
                   if (otClientRef.current) {
                     otClientRef.current.clearPendingOperations();
                     otClientRef.current.applyLocalOperation({ 
                       type: 'replace', 
                       position: 0, 
                       text: mergedContent 
                     });
                   }
                   setConflictState(null);
                 }}
                 className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-lg font-bold transition-all shadow-md flex justify-center items-center gap-2"
               >
                 Keep Both (Merge Offline Changes Below Server Version)
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
