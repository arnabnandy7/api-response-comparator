import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/src/components/theme-provider';

export const metadata: Metadata = {
  title: 'API Response Comparator',
  description: 'Compare API response payloads side by side.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
