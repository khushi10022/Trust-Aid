import React, { useState, useEffect, useRef } from 'react';
import './SOSButton.css';

export default function SOSButton({ location }) {
  const [state, setState]       = useState('idle');   // idle | confirm | active | sent
  const [countdown, setCountdown] = useState(5);
  const intervalRef = useRef(null);

  // cleanup
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const handleSOS = () => {
    if (state === 'idle') {
      setState('confirm');
    } else if (state === 'confirm') {
      setState('active');
      let c = 5;
      setCountdown(c);
      intervalRef.current = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          triggerSOS();
        }
      }, 1000);
    }
  };

  const triggerSOS = () => {
    setState('sent');
    // Vibrate if available
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 600]);
    // Auto-reset after 10s
    setTimeout(() => { setState('idle'); setCountdown(5); }, 10000);
  };

  const cancel = (e) => {
    e?.stopPropagation();
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setState('idle');
    setCountdown(5);
  };

  const locationText = location
    ? `📍 ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)} · Accuracy ±${location.accuracy}m`
    : '📍 Location unavailable — enable GPS for precise dispatch';

  return (
    <div className={`sos-bar sos-${state}`} role="region" aria-label="SOS Emergency Button">
      {state === 'idle' && (
        <button className="sos-idle-btn" onClick={handleSOS} aria-label="Activate SOS Emergency">
          <div className="sos-pulse-ring" />
          <div className="sos-idle-inner">
            <span className="sos-icon-big" aria-hidden>🆘</span>
            <div className="sos-idle-text">
              <span className="sos-label-main">SOS EMERGENCY</span>
              <span className="sos-label-sub">Tap to activate emergency alert</span>
            </div>
            <div className="sos-chevron">›</div>
          </div>
        </button>
      )}

      {state === 'confirm' && (
        <div className="sos-confirm-wrap">
          <div className="sos-confirm-left">
            <span className="sos-warn-icon">⚠️</span>
            <div>
              <div className="sos-confirm-title">Confirm Emergency SOS?</div>
              <div className="sos-confirm-sub">This will alert emergency services with your location</div>
            </div>
          </div>
          <div className="sos-confirm-actions">
            <button className="sos-cancel-btn" onClick={cancel}>Cancel</button>
            <button className="sos-go-btn" onClick={handleSOS}>
              🆘 Send SOS
            </button>
          </div>
        </div>
      )}

      {state === 'active' && (
        <div className="sos-active-wrap">
          <div className="sos-countdown-ring">
            <svg viewBox="0 0 44 44" className="sos-ring-svg">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="white" strokeWidth="3"
                strokeDasharray={`${(countdown / 5) * 113} 113`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{transition:'stroke-dasharray 1s linear'}}
              />
              <text x="22" y="27" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">{countdown}</text>
            </svg>
          </div>
          <div className="sos-active-text">
            <div className="sos-sending-label">Sending SOS in {countdown}s...</div>
            <div className="sos-loc-text">{locationText}</div>
          </div>
          <button className="sos-cancel-btn white" onClick={cancel}>CANCEL</button>
        </div>
      )}

      {state === 'sent' && (
        <div className="sos-sent-wrap">
          <span className="sos-sent-check">✅</span>
          <div className="sos-sent-text">
            <div className="sos-sent-title">SOS Alert Sent!</div>
            <div className="sos-sent-sub">Emergency services notified · Call 112 for immediate help · {locationText}</div>
          </div>
          <button className="sos-cancel-btn white" onClick={cancel}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
