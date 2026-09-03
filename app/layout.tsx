import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import SiteHeader from '@/components/site-header';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BingeTrack',
  description: 'Dizi takip uygulaması',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className={geist.className}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}

