import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'manager' ? '/admin' : '/home');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Ambient glow blobs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-navy/60 blur-[120px] pointer-events-none" />

      {/* Logo */}
      <div className="mb-12 text-center relative z-10">
        <div className="w-36 h-36 mx-auto flex items-center justify-center">
          <img src="/images/BlueBayou_bv.png" alt="Blue Bayou" className="w-full h-full object-contain" />
        </div>
        <p className="mt-3 text-sm font-bold tracking-widest uppercase text-white">Staff Portal</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm relative z-10">
        <div className="panel p-8 space-y-5">
          <div>
            <label className="label-xs block mb-2">Email</label>
            <input
              type="email"
              className="field"
              placeholder="you@bluebayou.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label-xs block mb-2">Password</label>
            <input
              type="password"
              className="field"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs font-semibold">{error}</p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </div>

        {/* Demo credentials */}
        <div className="mt-6 space-y-2">
          <p className="label-xs text-center mb-3">Demo accounts</p>
          {[
            { label: 'Employee',   email: 'sarah@bluebayou.com' },
            { label: 'Manager',    email: 'manager@bluebayou.com' },
            { label: 'Sys Admin',  email: 'sysadmin@bluebayou.com' },
          ].map(d => (
            <button
              key={d.email}
              type="button"
              onClick={() => { setEmail(d.email); setPassword('password'); }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-md bg-shell hover:bg-rim/60 border border-rim/60 transition-colors"
            >
              <span className="text-xs font-semibold text-fog-hi">{d.label}</span>
              <span className="text-xs text-fog font-mono truncate">{d.email}</span>
            </button>
          ))}
        </div>
      </form>

      {/* Animated waves — two layers, seamless tiling paths (start Y = end Y) */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none" style={{ height: '90px' }}>
        {/* Back layer — slow */}
        <div className="absolute bottom-0 left-0 flex" style={{ width: '200%', animation: 'wave-flow 40s linear infinite' }}>
          {[0, 1].map(i => (
            <svg key={i} viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ flex: '0 0 50%', height: '90px', display: 'block' }}>
              <path fill="#00C8FF" fillOpacity="0.08"
                d="M0,45 C360,5 720,85 1080,45 C1260,25 1380,65 1440,45 L1440,90 L0,90 Z" />
            </svg>
          ))}
        </div>
        {/* Front layer — faster, brighter, offset phase */}
        <div className="absolute bottom-0 left-0 flex" style={{ width: '200%', animation: 'wave-flow 28s linear infinite', animationDelay: '-10s' }}>
          {[0, 1].map(i => (
            <svg key={i} viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ flex: '0 0 50%', height: '90px', display: 'block' }}>
              <path fill="#00C8FF" fillOpacity="0.16"
                d="M0,55 C240,15 480,90 720,55 C960,20 1200,85 1440,55 L1440,90 L0,90 Z" />
            </svg>
          ))}
        </div>
      </div>
    </div>
  );
}
