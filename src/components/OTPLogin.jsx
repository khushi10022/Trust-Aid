import React, { useState, useRef, useEffect } from 'react';
import './OTPLogin.css';

// Simulated OTP service (replace with real SMS/email provider)
function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }

export default function OTPLogin({ onLogin }) {
  const [mode, setMode]         = useState('phone'); // 'phone' | 'email'
  const [value, setValue]       = useState('');
  const [step, setStep]         = useState('input'); // 'input' | 'otp' | 'success'
  const [otp, setOtp]           = useState(['','','','','','']);
  const [sentOtp, setSentOtp]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [devOtp, setDevOtp]     = useState(''); // show OTP in dev mode
  const otpRefs                 = useRef([]);
  const timerRef                = useRef(null);

  useEffect(() => {
    // Check if already logged in
    try {
      const sess = localStorage.getItem('ta_session');
      if (sess) { const s = JSON.parse(sess); if (s.loggedIn) onLogin(s); }
    } catch {}
  }, []);

  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => setResendTimer(t => t - 1), 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  const validate = () => {
    if (mode === 'phone') {
      if (!/^[6-9]\d{9}$/.test(value.replace(/\s/g,''))) { setError('Enter valid 10-digit Indian mobile number'); return false; }
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setError('Enter a valid email address'); return false; }
    }
    return true;
  };

  const sendOTP = async () => {
    if (!validate()) return;
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 900));
    const code = generateOTP();
    setSentOtp(code);
    setDevOtp(code); // In production, remove this — send via SMS/email API
    setStep('otp');
    setResendTimer(30);
    setLoading(false);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (!otp[i] && i > 0) { otpRefs.current[i-1]?.focus(); }
      const n = [...otp]; n[i] = ''; setOtp(n);
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0) { otpRefs.current[i-1]?.focus(); return; }
    if (e.key === 'ArrowRight' && i < 5) { otpRefs.current[i+1]?.focus(); return; }
  };

  const handleOtpChange = (i, val) => {
    const digit = val.replace(/\D/,'').slice(-1);
    const n = [...otp]; n[i] = digit; setOtp(n);
    if (digit && i < 5) setTimeout(() => otpRefs.current[i+1]?.focus(), 10);
    // Auto-verify when all filled
    if (digit && i === 5) {
      const full = [...n.slice(0,5), digit].join('');
      if (full.length === 6) setTimeout(() => verifyOTP(full), 100);
    }
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
    if (pasted.length === 6) {
      const n = pasted.split('');
      setOtp(n);
      otpRefs.current[5]?.focus();
      setTimeout(() => verifyOTP(pasted), 100);
    }
    e.preventDefault();
  };

  const verifyOTP = async (code) => {
    const entered = code || otp.join('');
    if (entered.length < 6) { setError('Enter complete 6-digit OTP'); return; }
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 700));
    if (entered === sentOtp) {
      setStep('success');
      const session = { loggedIn: true, loginMethod: mode, identifier: value, loginAt: Date.now() };
      try { localStorage.setItem('ta_session', JSON.stringify(session)); } catch {}
      setTimeout(() => onLogin(session), 800);
    } else {
      setError('Incorrect OTP. Please try again.');
      setOtp(['','','','','','']);
      otpRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const resend = async () => {
    if (resendTimer > 0) return;
    const code = generateOTP();
    setSentOtp(code); setDevOtp(code);
    setOtp(['','','','','','']); setError('');
    setResendTimer(30);
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  return (
    <div className="otp-root">
      <div className="otp-card">
        <div className="otp-header">
          <div className="otp-logo">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="otp-brand">TrustAid</div>
          <div className="otp-tagline">Secure Emergency Platform</div>
        </div>

        {step === 'input' && (
          <div className="otp-body">
            <div className="otp-step-title">Sign In</div>
            <div className="otp-step-sub">We'll send a One-Time Password to verify you</div>

            <div className="otp-mode-toggle">
              {['phone','email'].map(m => (
                <button key={m} className={`otp-mode-btn ${mode===m?'active':''}`}
                  onClick={() => { setMode(m); setValue(''); setError(''); }}>
                  {m === 'phone' ? '📞 Phone' : '✉️ Email'}
                </button>
              ))}
            </div>

            <div className="otp-field">
              <label className="otp-label">
                {mode === 'phone' ? 'Mobile Number' : 'Email Address'}
              </label>
              <div className="otp-input-wrap">
                {mode === 'phone' && <span className="otp-prefix">+91</span>}
                <input
                  className={`otp-input ${error ? 'error' : ''}`}
                  type={mode === 'phone' ? 'tel' : 'email'}
                  placeholder={mode === 'phone' ? '98765 43210' : 'you@example.com'}
                  value={value}
                  onChange={e => { setValue(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && sendOTP()}
                  maxLength={mode === 'phone' ? 10 : 60}
                  autoFocus
                />
              </div>
              {error && <div className="otp-error">{error}</div>}
            </div>

            <button className="otp-btn-primary" onClick={sendOTP} disabled={loading || !value.trim()}>
              {loading ? <><span className="otp-spin"/>Sending OTP...</> : 'Send OTP →'}
            </button>

            <div className="otp-note">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Your data is encrypted and stored securely on your device only.
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="otp-body">
            <div className="otp-step-title">Enter OTP</div>
            <div className="otp-step-sub">
              OTP sent to {mode === 'phone' ? `+91 ${value}` : value}
              <button className="otp-change-link" onClick={() => { setStep('input'); setOtp(['','','','','','']); setError(''); }}>
                Change
              </button>
            </div>

            {devOtp && (
              <div className="otp-dev-hint">
                🔧 Dev mode — OTP: <strong>{devOtp}</strong>
              </div>
            )}

            <div className="otp-digits" onPaste={handleOtpPaste}>
              {otp.map((d,i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  className={`otp-digit ${d ? 'filled' : ''} ${error ? 'err' : ''}`}
                  type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                />
              ))}
            </div>

            {error && <div className="otp-error center">{error}</div>}

            <button className="otp-btn-primary" onClick={() => verifyOTP()} disabled={loading || otp.join('').length < 6}>
              {loading ? <><span className="otp-spin"/>Verifying...</> : 'Verify OTP ✓'}
            </button>

            <div className="otp-resend-row">
              {resendTimer > 0 ? (
                <span className="otp-resend-timer">Resend OTP in {resendTimer}s</span>
              ) : (
                <button className="otp-resend-btn" onClick={resend}>Resend OTP</button>
              )}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="otp-body otp-success-body">
            <div className="otp-success-icon">✅</div>
            <div className="otp-step-title">Verified!</div>
            <div className="otp-step-sub">Login successful. Loading TrustAid...</div>
            <div className="otp-success-bar"/>
          </div>
        )}
      </div>
    </div>
  );
}
