import React, { useState, useRef, useEffect } from 'react';
import { SERVICES, INDIAN_LANGUAGES, INDIAN_STATES } from '../openenv.js';
import './Sidebar.css';

const SVC_LIST = Object.values(SERVICES);

export default function Sidebar({
  open, profile, onProfileUpdate, activePage, activeService,
  onNavigate, onToggle, theme, onToggleTheme, location, locStatus,
  onLogout, session
}) {
  const [tab, setTab]         = useState('nav');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editData, setEditData] = useState({...profile});
  const [langOpen, setLangOpen] = useState(false);
  const [stateOpen, setStateOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [saved, setSaved]     = useState('');
  const [settingsOpen, setSettingsOpen] = useState({ notifications:true, accessibility:false, about:false });
  const [settings, setSettings] = useState({
    notifications: profile?.notifications !== false,
    vibration: true, voiceEnabled: true, highContrast: false,
  });
  // Emergency contacts
  const [ecContacts, setEcContacts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ta_ec') || '[]'); } catch { return []; }
  });
  const [ecForm, setEcForm]   = useState({ name:'', phone:'', relation:'' });
  const [addingEc, setAddingEc] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const langRef  = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    setEditData({...profile});
  }, [profile]);

  // Outside-click close dropdowns
  useEffect(() => {
    const h = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false);
      if (stateRef.current && !stateRef.current.contains(e.target)) setStateOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const filteredLangs   = INDIAN_LANGUAGES.filter(l => l.toLowerCase().includes(langSearch.toLowerCase()));
  const filteredStates  = INDIAN_STATES.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase()));

  const saveProfile = () => {
    onProfileUpdate({ ...profile, ...editData });
    setEditingProfile(false);
    flash('Profile updated!');
  };

  const flash = (msg) => { setSaved(msg); setTimeout(() => setSaved(''), 2500); };

  const selectLang = (lang) => {
    onProfileUpdate({ ...profile, language: lang });
    try { localStorage.setItem('ta_language', lang); } catch {}
    setLangOpen(false); setLangSearch('');
    flash('Language updated!');
  };

  const selectState = (state) => {
    setEditData(d => ({ ...d, state }));
    setStateOpen(false); setStateSearch('');
  };

  const toggleSetting = (key) => {
    setSettings(s => {
      const u = { ...s, [key]: !s[key] };
      onProfileUpdate({ ...profile, settings: u });
      return u;
    });
  };

  const addEmergencyContact = () => {
    if (!ecForm.name.trim() || !/^[6-9]\d{9}$/.test(ecForm.phone)) {
      alert('Enter valid name and 10-digit Indian mobile number');
      return;
    }
    const updated = [...ecContacts, { ...ecForm, id: Date.now() }];
    setEcContacts(updated);
    try { localStorage.setItem('ta_ec', JSON.stringify(updated)); } catch {}
    setEcForm({ name:'', phone:'', relation:'' });
    setAddingEc(false);
    flash('Emergency contact added!');
  };

  const removeEc = (id) => {
    const updated = ecContacts.filter(c => c.id !== id);
    setEcContacts(updated);
    try { localStorage.setItem('ta_ec', JSON.stringify(updated)); } catch {}
  };

  const isDark = theme === 'dark';
  const locLabel = locStatus === 'granted' && location
    ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
    : locStatus === 'requesting' ? 'Locating...'
    : locStatus === 'denied' ? 'GPS denied'
    : 'GPS inactive';

  return (
    <aside className={`sidebar ${open ? 'open' : 'closed'}`}>
      {/* Brand */}
      <div className="sb-head">
        <div className="sb-brand">
          <div className="sb-shield">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div>
            <div className="sb-name">TrustAid</div>
            <div className="sb-tagline">Emergency Platform</div>
          </div>
        </div>
        <button className="sb-close" onClick={onToggle} aria-label="Close sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="sb-flag"/>

      {/* GPS bar */}
      <div className="sb-loc-bar">
        <span className={`loc-pill ${locStatus || 'idle'}`}>📍 {locLabel}</span>
        {location && (
          <a href={location.mapsUrl} target="_blank" rel="noreferrer" className="sb-loc-link">Map ↗</a>
        )}
      </div>

      {/* Tabs */}
      <div className="sb-tabs">
        {[{id:'nav',label:'Services'},{id:'profile',label:'Profile'},{id:'settings',label:'Settings'}].map(t => (
          <button key={t.id} className={`sb-tab ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="sb-body">

        {/* ─── SERVICES TAB ─── */}
        {tab === 'nav' && (<>
          <div className="sb-status"><div className="status-dot"/><span>All Emergency Services Active</span></div>
          <div className="sb-section-title">Emergency Services</div>
          <div className="sb-service-list">
            {SVC_LIST.slice(0,8).map(svc => (
              <button key={svc.id} className={`sb-svc-item ${activeService===svc.id?'active':''}`}
                style={{'--c':svc.color}} onClick={() => onNavigate('chat', svc)}>
                <span className="sb-svc-helpline">{svc.helpline}</span>
                <span className="sb-svc-name">{svc.label}</span>
                <svg className="sb-svc-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>
          <div className="sb-section-title" style={{marginTop:'10px'}}>Other Services</div>
          <div className="sb-service-list">
            {SVC_LIST.slice(8).map(svc => (
              <button key={svc.id} className={`sb-svc-item ${activeService===svc.id?'active':''}`}
                style={{'--c':svc.color}} onClick={() => onNavigate('chat', svc)}>
                <span className="sb-svc-helpline">{svc.helpline}</span>
                <span className="sb-svc-name">{svc.label}</span>
                <svg className="sb-svc-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            ))}
          </div>
          <div className="sb-sos-box">
            <div className="sb-sos-label">National Emergency</div>
            <div className="sb-sos-number">112</div>
            <div className="sb-sos-sub">Dial from any phone, anytime</div>
          </div>
        </>)}

        {/* ─── PROFILE TAB ─── */}
        {tab === 'profile' && (<>
          <div className="sb-profile-card">
            {profile.photo && <img src={profile.photo} alt={profile.fullName} className="sb-profile-photo"/>}
            <div className="sb-profile-info">
              <div className="sb-profile-name">{profile.fullName}</div>
              <div className="sb-profile-detail">{profile.gender} · Age {profile.age}</div>
              <div className="sb-profile-detail">+91 {profile.phone}</div>
              <div className="sb-profile-lang">🌐 {profile.language || 'English'}</div>
            </div>
          </div>

          {session && (
            <div className="sb-session-info">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Logged in via {session.loginMethod === 'phone' ? `📞 +91 ${session.identifier}` : `✉️ ${session.identifier}`}
            </div>
          )}

          {saved && <div className="sb-saved">✓ {saved}</div>}

          {!editingProfile ? (<>
            <div className="sb-info-list">
              {[
                ['State/UT', profile.state || '—'],
                ['Aadhaar', profile.aadhaarLast4 ? `XXXX-XXXX-${profile.aadhaarLast4}` : '—'],
                ['Since', new Date(profile.registeredAt).toLocaleDateString('en-IN',{year:'numeric',month:'short'})],
              ].map(([k,v]) => (
                <div key={k} className="sb-info-row">
                  <span className="sb-info-key">{k}</span>
                  <span className="sb-info-val">{v}</span>
                </div>
              ))}
            </div>

            {/* Language dropdown */}
            <div className="sb-section-title" style={{marginTop:'10px'}}>Language</div>
            <div className="sb-lang-wrap" ref={langRef}>
              <button className="sb-lang-cur" onClick={() => { setLangOpen(o=>!o); setLangSearch(''); }}>
                🌐 <span className="sb-lang-selected">{profile.language || 'English'}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{marginLeft:'auto',transition:'transform .2s',transform:langOpen?'rotate(180deg)':'none'}}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {langOpen && (
                <div className="sb-lang-dropdown">
                  <div className="sb-lang-search-wrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,color:'var(--t3)'}}>
                      <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                    </svg>
                    <input className="sb-lang-search" placeholder="Search language..." value={langSearch}
                      onChange={e => setLangSearch(e.target.value)} autoFocus onClick={e=>e.stopPropagation()}/>
                    {langSearch && <button className="sb-lang-clear" onClick={() => setLangSearch('')}>×</button>}
                  </div>
                  <div className="sb-lang-opts">
                    {filteredLangs.length === 0 && <div className="sb-lang-empty">No results</div>}
                    {filteredLangs.map(l => (
                      <button key={l} className={`sb-lang-opt ${profile.language===l?'active':''}`} onClick={() => selectLang(l)}>
                        <span>{l}</span>
                        {profile.language===l && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Emergency Contacts */}
            <div className="sb-section-title" style={{marginTop:'12px'}}>
              Emergency Contacts
              <button className="sb-ec-add-btn" onClick={() => setAddingEc(o=>!o)}>
                {addingEc ? '✕ Cancel' : '+ Add'}
              </button>
            </div>

            {addingEc && (
              <div className="sb-ec-form">
                {[['Name','text','name'],['Phone (10 digits)','tel','phone'],['Relation','text','relation']].map(([ph,type,key]) => (
                  <input key={key} className="sb-ec-input" type={type} placeholder={ph}
                    value={ecForm[key]} onChange={e => setEcForm(f=>({...f,[key]:e.target.value}))}
                    maxLength={key==='phone'?10:40}/>
                ))}
                <button className="sb-ec-save-btn" onClick={addEmergencyContact}>Save Contact</button>
              </div>
            )}

            {ecContacts.length === 0 && !addingEc && (
              <div className="sb-ec-empty">No emergency contacts added yet.<br/>Add contacts to alert them during SOS.</div>
            )}
            <div className="sb-ec-list">
              {ecContacts.map(c => (
                <div key={c.id} className="sb-ec-item">
                  <div className="sb-ec-avatar">{c.name[0]?.toUpperCase()}</div>
                  <div className="sb-ec-info">
                    <div className="sb-ec-name">{c.name}</div>
                    <div className="sb-ec-meta">+91 {c.phone} {c.relation && `· ${c.relation}`}</div>
                  </div>
                  <button className="sb-ec-remove" onClick={() => removeEc(c.id)} aria-label="Remove contact">✕</button>
                </div>
              ))}
            </div>

            <button className="sb-edit-btn" onClick={() => { setEditData({...profile}); setEditingProfile(true); }}>
              Edit Profile
            </button>

            {/* Logout */}
            <div className="sb-logout-section">
              {confirmLogout ? (
                <div className="sb-logout-confirm">
                  <span>Confirm logout?</span>
                  <button className="sb-logout-yes" onClick={onLogout}>Yes, Logout</button>
                  <button className="sb-logout-no" onClick={() => setConfirmLogout(false)}>Cancel</button>
                </div>
              ) : (
                <button className="sb-logout-btn" onClick={() => setConfirmLogout(true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                  Logout
                </button>
              )}
            </div>
          </>) : (
            <div className="sb-edit-form">
              <div className="sb-section-title">Edit Profile</div>
              {[['fullName','Full Name','text'],['phone','Mobile','tel'],['aadhaarLast4','Aadhaar Last 4','text']].map(([key,lbl,type]) => (
                <div key={key} className="sb-field">
                  <label className="sb-field-label">{lbl}</label>
                  <input type={type} className="sb-field-input" value={editData[key]||''}
                    onChange={e => setEditData(d=>({...d,[key]:e.target.value}))}/>
                </div>
              ))}

              {/* State collapsible dropdown */}
              <div className="sb-field">
                <label className="sb-field-label">State / UT</label>
                <div className="sb-lang-wrap" ref={stateRef} style={{marginBottom:0}}>
                  <button className="sb-lang-cur" onClick={() => { setStateOpen(o=>!o); setStateSearch(''); }}>
                    <span className="sb-lang-selected">{editData.state || 'Select State/UT'}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{marginLeft:'auto',transition:'transform .2s',transform:stateOpen?'rotate(180deg)':'none'}}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {stateOpen && (
                    <div className="sb-lang-dropdown">
                      <div className="sb-lang-search-wrap">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{flexShrink:0,color:'var(--t3)'}}>
                          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                        </svg>
                        <input className="sb-lang-search" placeholder="Search state..." value={stateSearch}
                          onChange={e => setStateSearch(e.target.value)} autoFocus onClick={e=>e.stopPropagation()}/>
                        {stateSearch && <button className="sb-lang-clear" onClick={() => setStateSearch('')}>×</button>}
                      </div>
                      <div className="sb-lang-opts">
                        {filteredStates.length === 0 && <div className="sb-lang-empty">No results</div>}
                        {filteredStates.map(s => (
                          <button key={s} className={`sb-lang-opt ${editData.state===s?'active':''}`} onClick={() => selectState(s)}>
                            <span>{s}</span>
                            {editData.state===s && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="sb-form-btns">
                <button className="btn btn-primary" style={{flex:1,justifyContent:'center',fontSize:'12px',padding:'9px'}} onClick={saveProfile}>Save</button>
                <button className="btn btn-ghost" style={{flex:1,justifyContent:'center',fontSize:'12px',padding:'9px'}} onClick={()=>setEditingProfile(false)}>Cancel</button>
              </div>
            </div>
          )}
        </>)}

        {/* ─── SETTINGS TAB ─── */}
        {tab === 'settings' && (<>
          {/* Dark/Light toggle */}
          <div className="sb-theme-toggle-row">
            <div className="sb-theme-label">
              <span className="sb-theme-icon">{isDark ? '🌙' : '☀️'}</span>
              <div>
                <div className="sb-toggle-label">{isDark ? 'Dark Mode' : 'Light Mode'}</div>
                <div className="sb-toggle-desc">Switch appearance theme</div>
              </div>
            </div>
            <button className={`sb-theme-btn ${isDark?'dark':'light'}`} onClick={onToggleTheme} aria-label="Toggle theme">
              <span className="sb-theme-thumb"/>
              <span className="sb-theme-track-label">{isDark?'🌙':'☀️'}</span>
            </button>
          </div>

          {/* Collapsible sections */}
          {[
            { key:'notifications', title:'Notifications & Alerts', items:[
              ['notifications','Push Notifications','Emergency alerts'],
              ['vibration','Vibration','Haptic feedback'],
            ]},
            { key:'accessibility', title:'Accessibility', items:[
              ['voiceEnabled','Voice Assistance','Speech recognition'],
              ['highContrast','High Contrast','Enhanced visibility'],
            ]},
          ].map(sec => (
            <div key={sec.key} className="sb-collapsible">
              <button className="sb-collapse-head" onClick={() => setSettingsOpen(e=>({...e,[sec.key]:!e[sec.key]}))}>
                <span>{sec.title}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  style={{transition:'transform .2s',transform:settingsOpen[sec.key]?'rotate(180deg)':'none'}}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {settingsOpen[sec.key] && (
                <div className="sb-collapse-body">
                  {sec.items.map(([k,lbl,desc]) => (
                    <div key={k} className="sb-toggle-row">
                      <div><div className="sb-toggle-label">{lbl}</div><div className="sb-toggle-desc">{desc}</div></div>
                      <button className={`sb-toggle ${settings[k]?'on':'off'}`} onClick={()=>toggleSetting(k)}>
                        <span className="sb-thumb"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="sb-collapsible">
            <button className="sb-collapse-head" onClick={() => setSettingsOpen(e=>({...e,about:!e.about}))}>
              <span>About TrustAid</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{transition:'transform .2s',transform:settingsOpen.about?'rotate(180deg)':'none'}}>
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {settingsOpen.about && (
              <div className="sb-collapse-body">
                <div className="sb-about">
                  {[['Version','2.1.0'],['Build','OpenEnv · Meta × Scaler'],['Data','Stored locally'],['License','Government Use']].map(([k,v])=>(
                    <div key={k} className="sb-about-row"><span>{k}</span><strong>{v}</strong></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="sb-emergency-numbers">
            <div className="sb-section-title">Emergency Helplines</div>
            {[['National','112'],['Police','100'],['Fire','101'],['Ambulance','108'],['Women','1091'],['Child','1098'],['Cyber','1930']].map(([n,num])=>(
              <div key={num} className="sb-helpline-row">
                <span className="sb-helpline-name">{n}</span>
                <strong className="sb-helpline-num">{num}</strong>
              </div>
            ))}
          </div>
        </>)}
      </div>
    </aside>
  );
}
