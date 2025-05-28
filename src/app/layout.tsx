import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
// Removed Button, LayoutDashboard, MessageCircle as they are no longer used in the header

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'App Pro Dashboard', // Updated title
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
            {/* Removed navigation buttons for Chatbot and Workspace */}
          </nav>
        </header>
        <main className="flex-grow flex flex-col"> {/* Adjusted main for flex layout */}
         {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
