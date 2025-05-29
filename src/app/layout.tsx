
import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/contexts/ThemeContext';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Echo Chamber',
  description: 'AI-powered application with Chatbot and Workspace.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>{/* suppressHydrationWarning might be needed if theme causes initial mismatch */}
      <body className={`${montserrat.variable} font-sans antialiased flex flex-col min-h-screen`}>
        <ThemeProvider>
          <main className="flex-grow flex flex-col">
          {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
