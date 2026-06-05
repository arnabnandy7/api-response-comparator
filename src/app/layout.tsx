import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
