import React, { useState, useRef } from 'react';
import { INDIAN_LANGUAGES, INDIAN_STATES } from '../openenv.js';
import './Onboarding.css';

const GENDERS = ['Male', 'Female', 'Transgender', 'Prefer not to say'];

export default function Onboarding({ onComplete }) {
  const [slide, setSlide] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [form, setForm] = useState({
    fullName: '', gender: '', age: '', language: 'English',
    phone: '', state: '', aadhaarLast4: '',
  });
  const [langOpen, setLangOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [errors, setErrors] = useState({});
  const fileRef = useRef();

  const SLIDES = [
    { id: 'welcome' },
    { id: 'photo' },
    { id: 'identity' },
    { id: 'language' },
    { id: 'review' },
  ];

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Please upload a valid image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError('Photo must be under 5 MB.'); return; }
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhoto(ev.target.result);
    reader.readAsDataURL(file);
  };

  const validate = (s) => {
    const e = {};
    if (s === 1 && !photo) e.photo = 'Official photo is mandatory for government identification.';
    if (s === 2) {
      if (!form.fullName.trim() || form.fullName.trim().split(' ').length < 2) e.fullName = 'Enter full name as in government document (First and Last name required).';
      if (!form.gender) e.gender = 'Please select gender.';
      if (!form.age || isNaN(form.age) || +form.age < 1 || +form.age > 120) e.age = 'Enter a valid age.';
      if (!form.phone || !/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit Indian mobile number.';
    }
    if (s === 3 && !form.language) e.language = 'Please select preferred language.';
    return e;
  };

  const next = () => {
    const e = validate(slide);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    if (slide < SLIDES.length - 1) setSlide(s => s + 1);
  };

  const prev = () => { setErrors({}); setSlide(s => s - 1); };

  const submit = () => {
    onComplete({ photo, ...form, registeredAt: new Date().toISOString() });
  };

  const filteredLangs = INDIAN_LANGUAGES.filter(l =>
    l.toLowerCase().includes(langSearch.toLowerCase())
  );

  const progress = (slide / (SLIDES.length - 1)) * 100;

  return (
    <div className="ob-root">
      {/* Header */}
      <div className="ob-header">
        <div className="ob-logo">
          <img src="/trustaid-logo.svg" alt="" className="ob-logo-img" onError={e=>e.target.style.display='none'}/>
          <div className="ob-logo-text">
            <span className="ob-logo-name">TrustAid</span>
            <span className="ob-logo-sub">Government Emergency Platform</span>
          </div>
        </div>
        <div className="ob-emblem">🇮🇳</div>
      </div>

      {/* Flag stripe */}
      <div className="ob-flag-stripe"/>

      {/* Progress */}
      <div className="ob-progress-wrap">
        <div className="ob-progress-bar" style={{ width: `${progress}%` }}/>
      </div>
      <div className="ob-step-info">
        Step {slide + 1} of {SLIDES.length}
      </div>

      {/* Slides */}
      <div className="ob-slides-viewport">
        <div className="ob-slide" style={{ animationName: 'slideIn', animationDuration: '0.4s' }}>

          {/* SLIDE 0: Welcome */}
          {slide === 0 && (
            <div className="ob-slide-content">
              <div className="ob-welcome-icon">🛡️</div>
              <h1 className="ob-welcome-title">Welcome to TrustAid</h1>
              <p className="ob-welcome-sub">
                India's unified emergency and citizen support platform.<br/>
                Connecting citizens to government services instantly.
              </p>
              <div className="ob-welcome-features">
                {[
                  ['12+', 'Emergency Services'],
                  ['24/7', 'Always Available'],
                  ['AI', 'Powered Support'],
                  ['🔒', 'Secure & Private'],
                ].map(([v, l]) => (
                  <div key={l} className="ob-feat">
                    <div className="ob-feat-val">{v}</div>
                    <div className="ob-feat-label">{l}</div>
                  </div>
                ))}
              </div>
              <div className="ob-notice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
                A profile with official identification is required to use TrustAid. Your data is stored securely on your device only.
              </div>
            </div>
          )}

          {/* SLIDE 1: Photo */}
          {slide === 1 && (
            <div className="ob-slide-content">
              <div className="ob-slide-title">Official Profile Photo</div>
              <p className="ob-slide-desc">
                A clear, recent photograph is mandatory for government emergency services. Use your official ID photo or a passport-style photo.
              </p>
              <div className="ob-photo-area" onClick={() => fileRef.current.click()}>
                {photo ? (
                  <img src={photo} alt="Profile" className="ob-photo-preview"/>
                ) : (
                  <div className="ob-photo-placeholder">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>Tap to upload photo</span>
                    <span className="ob-photo-hint">JPG, PNG up to 5MB</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} style={{ display:'none' }}/>
              {photo && (
                <button className="ob-retake" onClick={() => fileRef.current.click()}>
                  Retake Photo
                </button>
              )}
              {(photoError || errors.photo) && (
                <div className="ob-error">{photoError || errors.photo}</div>
              )}
              <div className="ob-photo-rules">
                <div className="ob-rule"><span className="ob-rule-ok">✓</span> Face clearly visible, front-facing</div>
                <div className="ob-rule"><span className="ob-rule-ok">✓</span> Plain light background preferred</div>
                <div className="ob-rule"><span className="ob-rule-no">✗</span> No sunglasses, hats, or filters</div>
                <div className="ob-rule"><span className="ob-rule-no">✗</span> No group photos or avatars</div>
              </div>
            </div>
          )}

          {/* SLIDE 2: Identity */}
          {slide === 2 && (
            <div className="ob-slide-content">
              <div className="ob-slide-title">Identity Details</div>
              <p className="ob-slide-desc">Enter details exactly as they appear in your government-issued ID (Aadhaar / Voter ID / Passport).</p>
              <div className="ob-form">
                <div className="ob-field">
                  <label className="ob-label">Full Name <span className="ob-req">*</span></label>
                  <input
                    className={`ob-input ${errors.fullName ? 'error' : ''}`}
                    placeholder="As in Aadhaar / Voter ID / Passport"
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  />
                  {errors.fullName && <span className="ob-err-msg">{errors.fullName}</span>}
                </div>

                <div className="ob-row">
                  <div className="ob-field flex-1">
                    <label className="ob-label">Gender <span className="ob-req">*</span></label>
                    <select
                      className={`ob-input ${errors.gender ? 'error' : ''}`}
                      value={form.gender}
                      onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                    >
                      <option value="">Select gender</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {errors.gender && <span className="ob-err-msg">{errors.gender}</span>}
                  </div>
                  <div className="ob-field" style={{ width: '100px' }}>
                    <label className="ob-label">Age <span className="ob-req">*</span></label>
                    <input
                      className={`ob-input ${errors.age ? 'error' : ''}`}
                      type="number" min="1" max="120" placeholder="Age"
                      value={form.age}
                      onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                    />
                    {errors.age && <span className="ob-err-msg">{errors.age}</span>}
                  </div>
                </div>

                <div className="ob-field">
                  <label className="ob-label">Mobile Number <span className="ob-req">*</span></label>
                  <div className="ob-phone-wrap">
                    <span className="ob-phone-code">+91</span>
                    <input
                      className={`ob-input ob-phone-input ${errors.phone ? 'error' : ''}`}
                      type="tel" maxLength="10" placeholder="10-digit mobile number"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g,'') }))}
                    />
                  </div>
                  {errors.phone && <span className="ob-err-msg">{errors.phone}</span>}
                </div>

                <div className="ob-row">
                  <div className="ob-field flex-1">
                    <label className="ob-label">State / UT</label>
                    <div className="ob-state-dropdown">
                      <button type="button" className="ob-state-cur"
                        onClick={()=>{setStateOpen(o=>!o);setStateSearch('');}}>
                        <span style={{color:form.state?'inherit':'#aab7c4'}}>{form.state||'Select State / UT'}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          style={{transition:'transform .2s',transform:stateOpen?'rotate(180deg)':'none'}}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                      {stateOpen && (
                        <div className="ob-state-list">
                          <input className="ob-state-search" placeholder="Search state..."
                            value={stateSearch} onChange={e=>setStateSearch(e.target.value)} autoFocus/>
                          <div className="ob-state-opts">
                            {INDIAN_STATES.filter(s=>s.toLowerCase().includes(stateSearch.toLowerCase())).map(s=>(
                              <button key={s} type="button" className={"ob-state-opt"+(form.state===s?" active":"")}
                                onClick={()=>{setForm(f=>({...f,state:s}));setStateOpen(false);}}>
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ob-field" style={{ width: '140px' }}>
                    <label className="ob-label">Aadhaar Last 4</label>
                    <input
                      className="ob-input"
                      type="text" maxLength="4" placeholder="XXXX"
                      value={form.aadhaarLast4}
                      onChange={e => setForm(f => ({ ...f, aadhaarLast4: e.target.value.replace(/\D/g,'') }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 3: Language */}
          {slide === 3 && (
            <div className="ob-slide-content">
              <div className="ob-slide-title">Language Preference</div>
              <p className="ob-slide-desc">
                Select your preferred language for communication. TrustAid supports all 22 scheduled Indian languages.
              </p>

              <div className="ob-lang-selected">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>Selected: <strong>{form.language}</strong></span>
              </div>

              <div className="ob-lang-search-wrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ob-search-icon"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  className="ob-lang-search"
                  placeholder="Search language..."
                  value={langSearch}
                  onChange={e => setLangSearch(e.target.value)}
                />
              </div>

              <div className="ob-lang-list">
                {filteredLangs.map(lang => (
                  <button
                    key={lang}
                    className={`ob-lang-item ${form.language === lang ? 'selected' : ''}`}
                    onClick={() => setForm(f => ({ ...f, language: lang }))}
                  >
                    <span>{lang}</span>
                    {form.language === lang && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
                {filteredLangs.length === 0 && (
                  <div className="ob-lang-empty">No languages found</div>
                )}
              </div>

              {errors.language && <div className="ob-error">{errors.language}</div>}
            </div>
          )}

          {/* SLIDE 4: Review */}
          {slide === 4 && (
            <div className="ob-slide-content">
              <div className="ob-slide-title">Review & Confirm</div>
              <p className="ob-slide-desc">Please verify your details before activating your TrustAid account.</p>

              <div className="ob-review-card">
                <div className="ob-review-photo-row">
                  <img src={photo} alt="Profile" className="ob-review-photo"/>
                  <div>
                    <div className="ob-review-name">{form.fullName}</div>
                    <div className="ob-review-sub">{form.gender} · Age {form.age}</div>
                    <div className="ob-review-sub">+91 {form.phone}</div>
                  </div>
                </div>
                <div className="ob-review-divider"/>
                <div className="ob-review-rows">
                  {[
                    ['State / UT', form.state || '—'],
                    ['Language', form.language],
                    ['Aadhaar Last 4', form.aadhaarLast4 ? `XXXX-XXXX-${form.aadhaarLast4}` : '—'],
                  ].map(([k,v]) => (
                    <div key={k} className="ob-review-row">
                      <span className="ob-review-key">{k}</span>
                      <span className="ob-review-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ob-consent">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <span>
                  By activating, I confirm this information is accurate and matches my government-issued identity documents. TrustAid stores data locally on this device only.
                </span>
              </div>

              <button className="btn btn-primary ob-submit-btn" onClick={submit}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Activate TrustAid Account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="ob-nav">
        {slide > 0 && slide < SLIDES.length - 1 && (
          <button className="btn btn-ghost ob-nav-back" onClick={prev}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
            Back
          </button>
        )}
        {slide === 0 && <div/>}
        {slide < SLIDES.length - 1 && (
          <button className="btn btn-primary ob-nav-next" onClick={next}>
            {slide === SLIDES.length - 2 ? 'Review Details' : 'Continue'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        )}
      </div>
    </div>
  );
}
