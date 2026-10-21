'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, demoLogin } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'customer' | 'merchant' | 'driver'>('customer');
  const [phone, setPhone] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      if (isRegister) {
        await register({ email, password, name, role, phone, vehicle });
      } else {
        await login(email, password);
      }
      router.push('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async (demoRole: 'customer' | 'merchant' | 'driver' | 'admin') => {
    setErrorMsg('');
    setLoading(true);
    try {
      await demoLogin(demoRole);
      if (demoRole === 'merchant') router.push('/merchant');
      else if (demoRole === 'driver') router.push('/driver');
      else if (demoRole === 'admin') router.push('/admin');
      else router.push('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '48px 20px', maxWidth: 460 }}>
      <div className="card">
        <div className="center" style={{ marginBottom: 20 }}>
          <div className="wm" style={{ fontSize: 28 }}>
            Buck<b>Duck</b>
          </div>
          <p className="tiny muted" style={{ marginTop: 4 }}>
            {isRegister ? 'Create an Account on StoreFront USA' : 'Sign In to Your Account'}
          </p>
        </div>

        {errorMsg && (
          <div className="card" style={{ background: 'var(--red-bg)', color: 'var(--red)', marginBottom: 16, padding: 12 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="stack">
          {isRegister && (
            <>
              <label className="field">
                Full Name
                <input
                  className="input"
                  required
                  placeholder="e.g. Ama Mensah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="field">
                Account Type
                <select
                  className="input"
                  value={role}
                  onChange={(e: any) => setRole(e.target.value)}
                >
                  <option value="customer">Shopper / Customer</option>
                  <option value="merchant">Merchant Store Owner</option>
                  <option value="driver">Delivery Driver</option>
                </select>
              </label>

              <label className="field">
                Phone Number
                <input
                  className="input"
                  placeholder="(301) 555-0100"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>

              {role === 'driver' && (
                <label className="field">
                  Vehicle Model & Color
                  <input
                    className="input"
                    placeholder="e.g. Toyota Sienna · Silver"
                    value={vehicle}
                    onChange={(e) => setVehicle(e.target.value)}
                  />
                </label>
              )}
            </>
          )}

          <label className="field">
            Email Address
            <input
              type="email"
              className="input"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            Password
            <input
              type="password"
              className="input"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div className="center" style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Already have an account? Sign In' : 'Need an account? Register here'}
          </button>
        </div>

        {/* 1-Click Demo Buttons */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
          <div className="tiny muted center strong" style={{ textTransform: 'uppercase', marginBottom: 12 }}>
            1-Click Instant Demo Login
          </div>

          <div className="grid g2" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleDemo('customer')}
            >
              🛒 Customer
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleDemo('merchant')}
            >
              🏪 Merchant
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleDemo('driver')}
            >
              🚗 Driver
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleDemo('admin')}
            >
              ⚙️ Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
