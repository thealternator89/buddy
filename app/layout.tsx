import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { getAccountsWithBalances } from '@/lib/actions/accounts';
import { getCategoryTree } from '@/lib/actions/categories';
import { getPayees } from '@/lib/actions/payees';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Buddy | Transaction Tracker',
  description: 'Clean, reliable personal finance and transaction tracking',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accounts, categoryTree, payees] = await Promise.all([
    getAccountsWithBalances(),
    getCategoryTree(),
    getPayees(),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <Navbar accounts={accounts} categories={categoryTree} payees={payees} />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
