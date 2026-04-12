import React, { useState, useEffect, useCallback } from 'react';
import OTPLogin from './components/OTPLogin.jsx';
import Onboarding from './components/Onboarding.jsx';
import Sidebar from './components/Sidebar.jsx';
import HomePage from './components/HomePage.jsx';
import ChatPage from './components/ChatPage.jsx';
import FloatingChatbot from './components/FloatingChatbot.jsx';
import SOSButton from './components/SOSButton.jsx';
import PermissionGate from './components/PermissionGate.jsx';
import { useTheme } from './hooks/useTheme.js';
import { useLocation } from './hooks/useLocation.js';
import './styles/global.css';

export default function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { location, status: locStatus, startTracking } = useLocation();

  const [session, setSession]         = useState(null);
  const [profile, setProfile]         = useState(null);
  const [page, setPage]               = useState('home');
  const [selectedService, setSelectedService] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 900);
  const [permissionsDone, setPermissionsDone] = useState(false);

  // Responsive sidebar
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 900) setSidebarOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Load session + profile
  useEffect(() => {
    try {
      const s = localStorage.getItem('ta_session');
      if (s) setSession(JSON.parse(s));
      const p = localStorage.getItem('trustaid_profile');
      if (p) setProfile(JSON.parse(p));
      const perms = localStorage.getItem('ta_permissions');
      if (perms) setPermissionsDone(true);
    } catch {}
  }, []);

  // Auto-start GPS after permissions
  useEffect(() => {
    if (permissionsDone && locStatus === 'idle') startTracking();
  }, [permissionsDone]);

  const saveProfile = useCallback((p) => {
    setProfile(p);
    try { localStorage.setItem('trustaid_profile', JSON.stringify(p)); } catch {}
  }, []);

  const handleLogin = useCallback((sess) => {
    setSession(sess);
    try { localStorage.setItem('ta_session', JSON.stringify(sess)); } catch {}
  }, []);

  const handleLogout = useCallback(() => {
    try {
      localStorage.removeItem('ta_session');
      localStorage.removeItem('trustaid_profile');
      localStorage.removeItem('ta_permissions');
    } catch {}
    setSession(null);
    setProfile(null);
    setPermissionsDone(false);
    setPage('home');
  }, []);

  const openChat = useCallback((svc) => {
    setSelectedService(svc);
    setPage('chat');
    if (window.innerWidth < 900) setSidebarOpen(false);
  }, []);

  const goHome = useCallback(() => {
    setPage('home');
    setSelectedService(null);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen(o => !o), []);

  const checkPerms = () => {
    try { return !!localStorage.getItem('ta_permissions'); } catch { return false; }
  };

  // ── Auth gate ──
  if (!session) return <OTPLogin onLogin={handleLogin} />;

  // ── Onboarding (first time after login) ──
  if (!profile) return <Onboarding onComplete={saveProfile} />;

  // ── Permission gate ──
  if (!permissionsDone && !checkPerms()) {
    return (
      <PermissionGate onComplete={(perms) => {
        setPermissionsDone(true);
        try { localStorage.setItem('ta_permissions', JSON.stringify(perms)); } catch {}
      }} />
    );
  }

  return (
    <div className="app-shell" data-theme={theme}>
      {sidebarOpen && window.innerWidth < 900 && (
        <div className="sidebar-overlay" onClick={toggleSidebar} />
      )}

      <Sidebar
        open={sidebarOpen}
        profile={profile}
        onProfileUpdate={saveProfile}
        activePage={page}
        activeService={selectedService?.id}
        onNavigate={(p, svc) => {
          if (p === 'home') goHome();
          else if (p === 'chat' && svc) openChat(svc);
          if (window.innerWidth < 900) setSidebarOpen(false);
        }}
        onToggle={toggleSidebar}
        theme={theme}
        onToggleTheme={toggleTheme}
        location={location}
        locStatus={locStatus}
        onLogout={handleLogout}
        session={session}
      />

      <main className="main-content" style={{ paddingBottom: '56px' }}>
        {page === 'home' && (
          <HomePage
            profile={profile}
            onSelectService={openChat}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
            location={location}
            locStatus={locStatus}
          />
        )}
        {page === 'chat' && selectedService && (
          <ChatPage
            service={selectedService}
            profile={profile}
            onBack={goHome}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={toggleSidebar}
            location={location}
          />
        )}
      </main>

      <SOSButton location={location} />
      {/* TrustAid AI chatbot — home page only */}
      {page === 'home' && <FloatingChatbot theme={theme} />}
    </div>
  );
}
