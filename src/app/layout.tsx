import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/src/components/theme-provider';

export const metadata: Metadata = {
  title: 'API Response Comparator',
  description:
    'Compare JSON API responses across Dev, QA, and Prod using JSON, URLs, or cURL.',
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
