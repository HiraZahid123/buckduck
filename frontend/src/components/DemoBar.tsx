'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function DemoBar() {
  const { user, demoLogin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isDriver = pathname?.startsWith('/driver');
  const curRole = user?.role || (pathname?.startsWith('/admin') ? 'admin' : pathname?.startsWith('/merchant') ? 'merchant' : pathname?.startsWith('/driver') ? 'driver' : 'customer');

  const switchRole = async (role: 'customer' | 'merchant' | 'driver' | 'admin') => {
    await demoLogin(role);
    if (role === 'customer') router.push('/');
    else if (role === 'merchant') router.push('/merchant');
    else if (role === 'driver') router.push('/driver');
    else if (role === 'admin') router.push('/admin');
  };

  return (
    <div className={`demo-bar no-print ${isDriver ? 'in-driver' : ''}`}>
      <b>DEMO · View as</b>
      <button
        type="button"
        className={curRole === 'customer' ? 'on' : ''}
        onClick={() => switchRole('customer')}
      >
        🛒 Shopper
      </button>
      <button
        type="button"
        className={curRole === 'merchant' ? 'on' : ''}
        onClick={() => switchRole('merchant')}
      >
        🏪 Merchant
      </button>
      <button
        type="button"
        className={curRole === 'driver' ? 'on' : ''}
        onClick={() => switchRole('driver')}
      >
        🚚 Driver
      </button>
      <button
        type="button"
        className={curRole === 'admin' ? 'on' : ''}
        onClick={() => switchRole('admin')}
      >
        🛡️ Admin
      </button>
    </div>
  );
}
