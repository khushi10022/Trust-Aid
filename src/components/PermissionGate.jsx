import React, { useState, useEffect } from 'react';
import './PermissionGate.css';

const PERMISSIONS = [
  {
    id: 'location',
    icon: '📍',
    title: 'Location Access',
    reason: 'Required to send your GPS coordinates during emergencies and dispatch the nearest services to you.',
    why: 'Your precise location helps emergency teams reach you faster.',
    critical: true,
    request: async () => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve('unavailable');
        navigator.geolocation.getCurrentPosition(
          () => resolve('granted'),
          (e) => resolve(e.code === 1 ? 'denied' : 'unavailable'),
          { timeout: 8000 }
        );
      });
    },
  },
  {
    id: 'microphone',
    icon: '🎤',
    title: 'Microphone Access',
    reason: 'Enables voice input so you can speak your emergency query hands-free without typing.',
    why: 'In an emergency, speaking is faster than typing.',
    critical: false,
    request: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        return 'granted';
      } catch (e) {
        return e.name === 'NotAllowedError' ? 'denied' : 'unavailable';
      }
    },
  },
  {
    id: 'camera',
    icon: '📷',
    title: 'Camera Access',
    reason: 'Allows you to capture and share photos or videos of incidents for evidence or to show responders.',
    why: 'Visual evidence helps emergency services assess situations remotely.',
    critical: false,
    request: async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(t => t.stop());
        return 'granted';
      } catch (e) {
        return e.name === 'NotAllowedError' ? 'denied' : 'unavailable';
      }
    },
  },
  {
    id: 'gallery',
    icon: '🖼️',
    title: 'Gallery / File Access',
    reason: 'Allows you to attach photos or documents from your device when reporting incidents or sharing evidence.',
    why: 'Attach existing evidence photos directly from your gallery.',
    critical: false,
    request: async () => {
      // Gallery/file access is handled via <input type="file"> — test by attempting to trigger it
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        // Modern browsers allow this without blocking; we grant directly
        return 'granted';
      } catch {
        return 'unavailable';
      }
    },
  },
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Push Notifications',
    reason: 'Allows emergency alerts and service updates to reach you even when the app is in the background.',
    why: 'Receive critical alerts and SOS confirmations instantly.',
    critical: false,
    request: async () => {
      if (!('Notification' in window)) return 'unavailable';
      if (Notification.permission === 'granted') return 'granted';
      const result = await Notification.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    },
  },
];

const STATUS_META = {
  granted:     { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓', label: 'Granted' },
  denied:      { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', icon: '✗', label: 'Denied' },
  unavailable: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '—', label: 'Unavailable' },
  skipped:     { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '○', label: 'Skipped' },
};

export default function PermissionGate({ onComplete }) {
  const [step, setStep]           = useState(0);
  const [statuses, setStatuses]   = useState({});
  const [requesting, setRequesting] = useState(false);
  const [done, setDone]           = useState(false);
  const [animDir, setAnimDir]     = useState('forward'); // forward | back

  // Skip gate if already completed
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ta_permissions');
      if (stored) onComplete(JSON.parse(stored));
    } catch {}
  }, []);

  const current = PERMISSIONS[step];
  const currentStatus = statuses[current?.id];
  const progress = (step / PERMISSIONS.length) * 100;

  const requestPerm = async () => {
    setRequesting(true);
    const result = await current.request();
    const updated = { ...statuses, [current.id]: result };
    setStatuses(updated);
    setRequesting(false);
  };

  const skip = () => {
    const updated = { ...statuses, [current.id]: 'skipped' };
    setStatuses(updated);
  };

  const next = () => {
    if (!currentStatus) return;
    setAnimDir('forward');
    if (step + 1 >= PERMISSIONS.length) {
      try { localStorage.setItem('ta_permissions', JSON.stringify(statuses)); } catch {}
      setDone(true);
      setTimeout(() => onComplete(statuses), 900);
    } else {
      setStep(s => s + 1);
    }
  };

  const prev = () => {
    if (step === 0) return;
    setAnimDir('back');
    setStep(s => s - 1);
  };

  if (done) {
    const grantedCount = Object.values(statuses).filter(s => s === 'granted').length;
    return (
      <div className="pg-root">
        <div className="pg-done-card">
          <div className="pg-done-icon">✅</div>
          <div className="pg-done-title">Setup Complete!</div>
          <div className="pg-done-sub">{grantedCount} of {PERMISSIONS.length} permissions granted</div>
          <div className="pg-done-chips">
            {PERMISSIONS.map(p => {
              const s = statuses[p.id];
              const m = STATUS_META[s] || STATUS_META.skipped;
              return (
                <div key={p.id} className="pg-done-chip" style={{background: m.bg, borderColor: m.border, color: m.color}}>
                  {p.icon} {p.title.split(' ')[0]} {m.icon}
                </div>
              );
            })}
          </div>
          <div className="pg-loading">Loading TrustAid...</div>
        </div>
      </div>
    );
  }

  const sm = currentStatus ? STATUS_META[currentStatus] : null;

  return (
    <div className="pg-root">
      <div className="pg-card">
        {/* Header */}
        <div className="pg-header">
          <div className="pg-logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div className="pg-header-text">
            <div className="pg-title">TrustAid Setup</div>
            <div className="pg-subtitle">Permissions for your safety</div>
          </div>
        </div>

        {/* Progress */}
        <div className="pg-progress-outer">
          <div className="pg-progress-bar">
            <div className="pg-progress-fill" style={{ width: `${progress + (100/PERMISSIONS.length)}%` }}/>
          </div>
          <div className="pg-step-counter">{step + 1} / {PERMISSIONS.length}</div>
        </div>

        {/* Tracker dots */}
        <div className="pg-dots">
          {PERMISSIONS.map((p, i) => {
            const s = statuses[p.id];
            const m = s ? STATUS_META[s] : null;
            return (
              <div
                key={p.id}
                className={`pg-dot ${i === step ? 'current' : ''} ${s ? 'done' : ''} ${i < step ? 'past' : ''}`}
                style={m ? { background: m.bg, borderColor: m.border, color: m.color } : {}}
                title={p.title}
              >
                {i < step && s ? STATUS_META[s].icon : i === step ? p.icon : '○'}
              </div>
            );
          })}
        </div>

        {/* Permission card */}
        <div className="pg-perm-card" key={current.id} style={{animation: `${animDir==='forward'?'slideInRight':'slideInLeft'} .3s ease`}}>
          <div className="pg-perm-icon">{current.icon}</div>
          <div className="pg-perm-title">
            {current.title}
            {current.critical && <span className="pg-required">Required</span>}
          </div>
          <div className="pg-perm-reason">{current.reason}</div>
          <div className="pg-perm-why">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,marginTop:'1px'}}>
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
            </svg>
            {current.why}
          </div>

          {/* Result message */}
          {sm && (
            <div className="pg-result-msg" style={{ background: sm.bg, borderColor: sm.border, color: sm.color }}>
              <span style={{fontSize:'16px'}}>{sm.icon === '✓' ? '✅' : sm.icon === '✗' ? '⚠️' : 'ℹ️'}</span>
              <div>
                <strong>{sm.label}</strong>
                {currentStatus === 'denied' && (
                  <span> — Enable in browser Settings → Site Permissions → {current.title}</span>
                )}
                {currentStatus === 'unavailable' && (
                  <span> — Not available on this device/browser.</span>
                )}
                {currentStatus === 'granted' && (
                  <span> — {current.title} is active.</span>
                )}
                {currentStatus === 'skipped' && (
                  <span> — You can enable this later in Settings.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="pg-actions">
          {!currentStatus ? (
            <div className="pg-action-row">
              <button
                className="pg-btn-allow"
                onClick={requestPerm}
                disabled={requesting}
              >
                {requesting ? (
                  <><span className="pg-spin"/>Requesting access...</>
                ) : (
                  <><span>{current.icon}</span>Allow {current.title}</>
                )}
              </button>
              {!current.critical && (
                <button className="pg-btn-skip" onClick={skip}>
                  Skip for now
                </button>
              )}
            </div>
          ) : (
            <div className="pg-action-row">
              {step > 0 && (
                <button className="pg-btn-back" onClick={prev}>← Back</button>
              )}
              <button className="pg-btn-next" onClick={next} style={{flex:1}}>
                {step + 1 >= PERMISSIONS.length ? 'Complete Setup ✓' : 'Continue →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
