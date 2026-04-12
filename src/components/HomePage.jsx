import React, { useState } from 'react';
import { SERVICES } from '../openenv.js';
import './HomePage.css';

const SERVICE_LIST = Object.values(SERVICES);

// Professional SVG icons (no emojis)
const SVC_ICONS = {
  police:   <svg viewBox="0 0 40 40" fill="none"><rect x="6" y="16" width="28" height="17" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M13 16V11a7 7 0 0 1 14 0v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="25" r="2.5" fill="currentColor"/><path d="M10 7h20M16 4h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  fire:     <svg viewBox="0 0 40 40" fill="none"><path d="M20 4C20 4 17 13 22 18C18 16 14 10 14 10S12 20 18 27C12 24 10 15 10 15S7 24 13 31C15 35 20 37 20 37S25 35 27 31C33 24 31 15 31 15S29 24 22 27C28 20 26 10 26 10S22 16 18 18C23 13 20 4 20 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  medical:  <svg viewBox="0 0 40 40" fill="none"><rect x="6" y="6" width="28" height="28" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M20 13v14M13 20h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>,
  disaster: <svg viewBox="0 0 40 40" fill="none"><path d="M20 5L4 32h32L20 5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M20 17v8M20 29v1.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="M5 30c4-5 10-3 14-1s11 4 17-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  woman:    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="10" r="5.5" stroke="currentColor" strokeWidth="2"/><path d="M10 27c0-5.523 4.477-10 10-10s10 4.477 10 10v4H10v-4z" stroke="currentColor" strokeWidth="2"/><path d="M20 31v6M16 37h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M13 22l-4 4M27 22l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  child:    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="11" r="6" stroke="currentColor" strokeWidth="2"/><path d="M11 36V25c0-4.971 4.029-9 9-9s9 4.029 9 9v11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M11 30h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 36h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  elderly:  <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="9" r="5" stroke="currentColor" strokeWidth="2"/><path d="M15 36V24l-3-5a7 7 0 0 1 16 0l-3 5v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 30l3 6M29 25l3 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  railway:  <svg viewBox="0 0 40 40" fill="none"><rect x="8" y="6" width="24" height="22" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M8 19h24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="14" cy="25" r="2" fill="currentColor"/><circle cx="26" cy="25" r="2" fill="currentColor"/><path d="M5 31l5-4h20l5 4M16 36h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M15 13h10M15 16h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  animal:   <svg viewBox="0 0 40 40" fill="none"><ellipse cx="20" cy="24" rx="10" ry="8" stroke="currentColor" strokeWidth="2"/><circle cx="11" cy="11" r="3.5" stroke="currentColor" strokeWidth="2"/><circle cx="29" cy="11" r="3.5" stroke="currentColor" strokeWidth="2"/><circle cx="5" cy="20" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="35" cy="20" r="3" stroke="currentColor" strokeWidth="2"/><circle cx="20" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M16 30l-3 7M24 30l3 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  cyber:    <svg viewBox="0 0 40 40" fill="none"><rect x="6" y="7" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="2"/><path d="M14 34h12M20 27v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M13 17l4 4-4 4M22 21h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  food:     <svg viewBox="0 0 40 40" fill="none"><path d="M7 18c0-7 4.5-12 13-12s13 5 13 12H7z" stroke="currentColor" strokeWidth="2"/><rect x="5" y="18" width="30" height="4" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M12 22v13M28 22v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><path d="M8 35h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
  other:    <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2"/><path d="M20 19v-2a4 4 0 1 0-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="20" cy="26" r="1.5" fill="currentColor"/></svg>,
};

export default function HomePage({ profile, onSelectService, sidebarOpen, onToggleSidebar, location, locStatus }) {
  const [searchQ, setSearchQ] = useState('');

  const filtered = SERVICE_LIST.filter(s =>
    !searchQ || s.label.toLowerCase().includes(searchQ.toLowerCase())
  );

  return (
    <div className="hp-root">
      {/* Top nav bar */}
      <nav className="hp-nav">
        <button className="hp-menu-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <div className="hp-nav-title">
          <span className="hp-nav-logo">TrustAid</span>
          <span className="hp-nav-sub">Emergency Platform</span>
        </div>
        <div className="hp-nav-right">
          <div className="status-live">
            <div className="status-dot"/>
            <span>Live</span>
          </div>
          <div className={`loc-pill ${locStatus || 'idle'}`}>
            📍 {locStatus === 'granted' && location
              ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
              : locStatus === 'requesting' ? 'Locating...'
              : locStatus === 'denied' ? 'GPS denied'
              : 'GPS off'}
          </div>
          {profile.photo && (
            <img src={profile.photo} alt={profile.fullName} className="hp-nav-avatar"/>
          )}
        </div>
      </nav>

      {/* India flag stripe */}
      <div className="flag-stripe"/>

      <div className="hp-scroll">
        {/* Hero banner */}
        <div className="hp-banner">
          <div className="hp-banner-content">
            <div className="hp-banner-greeting">
              Namaste, {profile.fullName.split(' ')[0]}
            </div>
            <div className="hp-banner-title">How can we help you today?</div>
            <div className="hp-banner-sub">Select an emergency service below for immediate assistance</div>
          </div>
          <div className="hp-banner-sos">
            <div className="hp-sos-label">EMERGENCY</div>
            <div className="hp-sos-num">112</div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="hp-quick-row">
          {[
            { label:'Dial 112', num:'112', color:'var(--crimson)' },
            { label:'SOS', sub:'Alert Contacts', color:'var(--crimson-d)' },
            { label:'TrackMe', sub:'Share Location', color:'var(--ashoka)' },
            { label:'SOS History', sub:'Past Requests', color:'var(--t2)' },
          ].map(item => (
            <div key={item.label} className="hp-quick-item">
              <div className="hp-quick-icon" style={{ background: `${item.color}18`, border: `1.5px solid ${item.color}30` }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2">
                  {item.label === 'Dial 112' && <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.43A2 2 0 0 1 3.6 1.25h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.4a16 16 0 0 0 5.68 5.68l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></>}
                  {item.label === 'SOS' && <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>}
                  {item.label === 'TrackMe' && <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></>}
                  {item.label === 'SOS History' && <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>}
                </svg>
              </div>
              <div className="hp-quick-label">{item.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="hp-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="hp-search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            className="hp-search"
            placeholder="Search emergency services..."
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </div>

        {/* Contact Emergency Services label */}
        <div className="hp-services-label">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Contact Emergency Services
        </div>

        {/* Services grid - 4 column like 112 India app */}
        <div className="hp-grid">
          {filtered.map((svc, i) => (
            <button
              key={svc.id}
              className="hp-svc-card"
              style={{ '--c': svc.color, animationDelay: `${i*0.04}s` }}
              onClick={() => onSelectService(svc)}
            >
              <div className="hp-svc-icon-wrap">
                <div className="hp-svc-icon">{SVC_ICONS[svc.id]}</div>
              </div>
              <div className="hp-svc-label">{svc.label}</div>
              <div className="hp-svc-helpline">{svc.helpline}</div>
            </button>
          ))}
        </div>

        {/* Info strip */}
        <div className="hp-info-strip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>All calls and chats are logged for quality assurance. In life-threatening situations, always call <strong>112</strong> first.</span>
        </div>

        <div className="hp-footer">
          <span>TrustAid · OpenEnv · Meta × Scaler Hackathon 2026</span>
          <span>v2.0.0</span>
        </div>
      </div>
    </div>
  );
}
