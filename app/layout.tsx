import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { TimeZoneSync } from '@/components/TimeZoneSync';
import { getCurrentUser } from '@/lib/auth';
import { getServerTimeZone } from '@/lib/server-timezone';
import { TIMEZONE_COOKIE_NAME } from '@/lib/constants';

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
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Buddy',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, serverTimeZone] = await Promise.all([
    getCurrentUser(),
    getServerTimeZone(),
  ]);

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var tz=Intl.DateTimeFormat().resolvedOptions().timeZone;if(tz){document.cookie="${TIMEZONE_COOKIE_NAME}="+encodeURIComponent(tz)+"; path=/; max-age=31536000; SameSite=Lax"}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <TimeZoneSync serverTimeZone={serverTimeZone} />
        {user && <Navbar user={user} />}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
