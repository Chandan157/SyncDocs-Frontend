'use client';
import { login } from '../actions';
import { useActionState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/indexeddb/db';
export default function LoginPage() {
  const [error, formAction, isPending] = useActionState(
    async (prevState: any, formData: FormData) => {
      await db.documents.clear();
      await db.operations.clear();
      await db.versions.clear();
      const result = await login(formData);
      if (result?.error) {
        return result.error;
      }
      return null;
    },
    null
  );
  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white shadow-xl rounded-2xl border border-slate-200 p-8 transition-all">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Sign in to access your collaborative workspace.</p>
        </div>
        <form action={formAction} className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg text-center font-medium">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-slate-800"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 px-4 rounded-xl font-medium text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] focus:ring-4 focus:ring-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isPending ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="mt-8 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
}
