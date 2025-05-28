import type { Metadata } from 'next';
import Link from 'next/link';
import { Montserrat } from 'next/font/google'; // Changed from Geist
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const montserrat = Montserrat({ // Changed from geistSans/geistMono
  variable: '--font-montserrat',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Echo Chamber', // Updated title
  description: 'AI-powered application with Chatbot and Workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-sans antialiased flex flex-col min-h-screen`}> {/* Apply Montserrat variable and font-sans */}
        <header className="border-b p-4 shadow-sm bg-card sticky top-0 z-50">
          <nav className="container mx-auto flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-primary">
              Echo Chamber {/* Updated App Name */}
            </Link>
          </nav>
        </header>
        <main className="flex-grow flex flex-col">
         {children}
        </main>
        <Toaster />
      </body>
    </html>
  );
}
