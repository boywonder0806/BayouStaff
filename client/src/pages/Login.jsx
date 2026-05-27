import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [emailErr, setEmailErr]   = useState('');
  const [passwordErr, setPasswordErr] = useState('');
  const [serverError, setServerError] = useState('');
  const [locked, setLocked]       = useState(false);
  const [attempts, setAttempts]   = useState(0);
  const [loading, setLoading]     = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  function validateFields() {
    let ok = true;
    if (!email.trim()) {
      setEmailErr('Email is required.'); ok = false;
    } else if (!EMAIL_RE.test(email.trim())) {
      setEmailErr('Please enter a valid email address.'); ok = false;
    } else {
      setEmailErr('');
    }
    if (!password) {
      setPasswordErr('Password is required.'); ok = false;
    } else {
      setPasswordErr('');
    }
    return ok;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    setLocked(false);
    if (!validateFields()) return;
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate(user.role === 'manager' || user.role === 'sysadmin' ? '/scheduler' : '/home');
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Unable to sign in. Please try again.';
      const isLockMsg = msg.toLowerCase().includes('locked');
      setLocked(isLockMsg);
      setServerError(msg);
      if (!isLockMsg) setAttempts(n => n + 1);
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
      <form onSubmit={handleSubmit} className="w-full max-w-sm relative z-10" noValidate>
        <div className="panel p-8 space-y-5">

          {/* Email */}
          <div>
            <label className="label-xs block mb-2">Email</label>
            <input
              type="email"
              className={`field transition-colors ${emailErr ? 'border-red-500/70 focus:border-red-500' : ''}`}
              placeholder="you@soaknfun.com"
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailErr) setEmailErr(''); if (serverError) { setServerError(''); setLocked(false); } }}
              autoComplete="email"
              autoFocus
            />
            {emailErr && (
              <p className="text-red-400 text-10 font-semibold mt-1.5 flex items-center gap-1">
                <AlertSmIcon /> {emailErr}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="label-xs block mb-2">Password</label>
            <input
              type="password"
              className={`field transition-colors ${passwordErr ? 'border-red-500/70 focus:border-red-500' : ''}`}
              placeholder="••••••••"
              value={password}
              onChange={e => { setPassword(e.target.value); if (passwordErr) setPasswordErr(''); if (serverError) { setServerError(''); setLocked(false); } }}
              autoComplete="current-password"
            />
            {passwordErr && (
              <p className="text-red-400 text-10 font-semibold mt-1.5 flex items-center gap-1">
                <AlertSmIcon /> {passwordErr}
              </p>
            )}
          </div>

          {/* Server error banner */}
          {serverError && (
            <div className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-xs font-semibold
              ${locked
                ? 'bg-amber-950/50 border-amber-500/30 text-amber-300'
                : 'bg-red-950/50 border-red-500/30 text-red-400'
              }`}>
              <span className="shrink-0 mt-0.5">
                {locked ? <LockIcon /> : <AlertIcon />}
              </span>
              <span className="leading-relaxed">{serverError}</span>
            </div>
          )}

          {/* Hint after multiple failed attempts */}
          {attempts >= 3 && !locked && (
            <p className="text-10 text-fog text-center leading-relaxed">
              Having trouble? Contact your system administrator to reset your password.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Signing in…
              </>
            ) : 'Sign In'}
          </button>
        </div>
      </form>

      {/* Animated waves */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none" style={{ height: '90px' }}>
        <div className="absolute bottom-0 left-0 flex" style={{ width: '200%', animation: 'wave-flow 40s linear infinite' }}>
          {[0, 1].map(i => (
            <svg key={i} viewBox="0 0 1440 90" preserveAspectRatio="none" style={{ flex: '0 0 50%', height: '90px', display: 'block' }}>
              <path fill="#00C8FF" fillOpacity="0.08"
                d="M0,45 C360,5 720,85 1080,45 C1260,25 1380,65 1440,45 L1440,90 L0,90 Z" />
            </svg>
          ))}
        </div>
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

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function AlertSmIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
