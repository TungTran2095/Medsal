
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed from Montserrat
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from '@/contexts/ThemeContext';

// Changed font to Inter
const inter = Inter({
  variable: '--font-inter', // Changed variable name
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
      <body className={`${inter.variable} font-sans antialiased flex flex-col min-h-screen`}> {/* Used Inter variable */}
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
