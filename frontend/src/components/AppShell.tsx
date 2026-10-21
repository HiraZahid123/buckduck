'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import DemoBar from './DemoBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = pathname?.startsWith('/admin') || pathname?.startsWith('/merchant') || pathname?.startsWith('/driver');

  return (
    <>
      {!isPortal && <Header />}
      <main style={{ minHeight: isPortal ? '100vh' : 'calc(100vh - 350px)' }}>{children}</main>
      {!isPortal && <Footer />}
      <DemoBar />
    </>
  );
}
