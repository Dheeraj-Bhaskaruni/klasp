import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/Navigation';
import { AppProvider } from '@/contexts/AppContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VoiceTeacher — Learn anything, spoken aloud',
  description:
    'An AI-powered voice teaching app. Speak your questions, upload your notes, and let GPT-4 teach you through conversation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetBrainsMono.variable} h-full`}
    >
      <body className="min-h-full bg-gray-950 text-gray-100 antialiased">
        <AppProvider>
          <Navigation />
          {/* Top padding to clear the fixed navigation bar */}
          <main className="pt-14 min-h-screen">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
