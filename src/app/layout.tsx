import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { Button } from '@/components/ui/button';
import { LayoutDashboard, MessageCircle } from 'lucide-react';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Echo Chamber & Workspace',
  description: 'AI-powered application with Chatbot and Workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}>
        <header className="border-b p-4 shadow-sm bg-card sticky top-0 z-50">
          <nav className="container mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-primary">
              App Pro
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="ghost" asChild>
                <Link href="/">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Chatbot
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/workspace">
                  <LayoutDashboard className="mr-2 h-5 w-5" />
                  Workspace
                </Link>
              </Button>
            </div>
          </nav>
        </header>
        <main className="flex-grow container mx-auto py-6">
         {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
