import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SyncDocs - Local-First Collaborative Editor',
  description: 'A production-grade Local-First Collaborative Document Editor',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-slate-50 text-slate-900 transition-colors duration-300`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
