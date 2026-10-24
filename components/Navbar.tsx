'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wallet,
  ArrowLeftRight,
  CalendarClock,
  SlidersHorizontal,
  LayoutDashboard,
  CreditCard,
  PieChart,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { APP_CONFIG } from '@/lib/constants';
import { AccountWithBalance } from '@/lib/actions/accounts';
import { CategoryNode, CategoryFlatItem } from '@/lib/category-utils';
import { PayeeWithRules } from '@/lib/actions/payees';
import { AuthUser } from '@/lib/auth';
import { logoutAction } from '@/lib/actions/auth';

interface NavbarProps {
  user?: AuthUser | null;
  accounts?: AccountWithBalance[];
  categories?: (CategoryNode | CategoryFlatItem)[];
  payees?: PayeeWithRules[];
}

export function Navbar({
  user,
}: NavbarProps) {
  const pathname = usePathname();

  if (!user || pathname === '/login' || pathname === '/signup') {
    return null;
  }

  const navItems = [
    { href: '/', label: 'Overview', icon: LayoutDashboard },
    { href: '/accounts', label: 'Accounts', icon: CreditCard },
    { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
    { href: '/budgets', label: 'Budgets', icon: PieChart },
    { href: '/scheduled', label: 'Scheduled', icon: CalendarClock },
    { href: '/manage', label: 'Manage', icon: SlidersHorizontal },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & App Name */}
          <div className="flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2.5 font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/20">
                <Wallet className="h-5 w-5" />
              </div>
              <span>Buddy</span>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                {APP_CONFIG.currency.code} ({APP_CONFIG.currency.symbol})
              </span>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname.startsWith(item.href) ||
                      (item.href === '/manage' && pathname.startsWith('/categories'));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                        : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right side: User Controls */}
          <div className="flex items-center gap-2">
            <div
              className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-100/80 dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300"
              title={user.email}
            >
              <UserIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
              <span className="max-w-[140px] truncate">{user.name}</span>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                title={`Sign out (${user.email})`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-50 hover:text-rose-600 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-rose-400"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </form>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden border-t border-zinc-200 dark:border-zinc-800 px-2 py-2 justify-around overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href) ||
                  (item.href === '/manage' && pathname.startsWith('/categories'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 py-1 px-2 text-[11px] sm:text-xs font-medium rounded-lg shrink-0',
                  isActive
                    ? 'text-emerald-600 font-semibold dark:text-emerald-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>
  );
}
