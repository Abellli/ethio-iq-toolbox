import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ethio IQ Toolbox — Admin',
  description: 'Survey, analytics, and campaign management for Ethio IQ Toolbox clients.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
