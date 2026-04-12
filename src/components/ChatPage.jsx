import React, { useState, useRef, useEffect, useCallback } from 'react';
import { env, LANG_CODES } from '../openenv.js';
import './ChatPage.css';

const GROQ_API_KEY = 'gsk_placeholder_replace_with_your_key'; // Replace with your Groq API key

const QUICK = {
  police:  ['File an FIR','Report a theft','Missing person report','Legal rights help'],
  fire:    ['Active fire emergency','Gas leak at home','Fire safety checklist','Electrical fire'],
  medical: ['Heart attack first aid','Unconscious patient','Severe bleeding','Stroke symptoms'],
  disaster:['Flood evacuation','Earthquake safety','NDMA helpline','Disaster relief'],
  woman:   ['I feel unsafe now','Domestic violence help','Workplace harassment','Safety planning'],
  child:   ['Missing child report','Child abuse complaint','Childline services','School safety'],
  elderly: ['Senior fell/injured','Elder abuse help','Welfare schemes','Senior helplines'],
  railway: ['Railway accident','Lost article','Emergency on train','Station helpline'],
  animal:  ['Animal bite first aid','Stray animal rescue','Wildlife emergency','Cruelty report'],
  cyber:   ['Online fraud help','Cyberbullying report','OTP fraud','Social media hack'],
  food:    ['Track my order','Order too late','Wrong item delivered','Refund request'],
  other:   ['Government schemes','Utility complaint','Banking fraud','Document help'],
};

const VS = { IDLE:'idle', LISTENING:'listening', ERROR:'error' };

// Use Groq API for AI-powered responses
async function callGroq(messages, serviceContext) {
  try {
    const systemPrompt = `You are TrustAid, India's official government emergency support AI assistant for the ${serviceContext.label} service (helpline: ${serviceContext.helpline}).

Provide concise, accurate, actionable guidance. Always:
- Lead with the most critical helpline number for genuine emergencies
- Give numbered step-by-step instructions
- Use simple language accessible to all Indian citizens
- Reference relevant Indian laws/schemes where applicable
- Be empathetic but professional

Format responses with **bold** for critical info. Keep responses under 200 words.`;

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 300,
        temperature: 0.4,
      }),
    });

    if (!resp.ok) throw new Error(`Groq API error: ${resp.status}`);
    const data = await resp.json();
    return { text: data.choices[0].message.content, source: 'groq' };
  } catch (err) {
    return null; // Fall back to local KB
  }
}

export default function ChatPage({ service, profile, onBack, sidebarOpen, onToggleSidebar }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [typing, setTyping]       = useState(false);
  const [voiceState, setVoiceState] = useState(VS.IDLE);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [stats, setStats]         = useState({ steps:0, reward:0 });
  const [groqEnabled, setGroqEnabled] = useState(GROQ_API_KEY !== 'gsk_placeholder_replace_with_your_key');

  const [attachments, setAttachments] = useState([]); // {name,size,type,url,kind}
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingTimer, setRecordingTimer] = useState(0);
  const fileInputRef    = useRef(null);
  const cameraInputRef  = useRef(null);
  const audioInputRef   = useRef(null);
  const mediaRecRef     = useRef(null);
  const recordTimerRef  = useRef(null);
  const audioChunksRef  = useRef([]);

  const endRef     = useRef(null);
  const inputRef   = useRef(null);
  const recRef     = useRef(null);
  const finalRef   = useRef('');
  const abortRef   = useRef(false);
  const historyRef = useRef([]); // for Groq conversation context

  // Init
  useEffect(() => {
    env.reset(service.id);
    abortRef.current = false;
    finalRef.current = '';

    const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    const safe  = ['localhost','127.0.0.1'].includes(location.hostname) || location.protocol === 'https:';
    setVoiceSupported(hasSR && safe);

    const welcome = `Welcome. You are connected to **TrustAid ${service.label} Support**.\n\nHelpline: **${service.helpline}**\n\n${service.desc}\n\nHow can I assist you today?`;

    const welcomeMsg = { id:'w', role:'assistant', content:welcome, ts:new Date() };
    setMessages([welcomeMsg]);
    historyRef.current = [];
    inputRef.current?.focus();

    return () => { abortRef.current = true; stopRec(); };
  }, [service.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, typing]);

  // Stop recognition cleanly
  const stopRec = useCallback(() => {
    if (recRef.current) {
      try { recRef.current.abort(); } catch(e) {}
      recRef.current = null;
    }
    setVoiceState(VS.IDLE);
    setTranscript('');
  }, []);

  // Send message
  // ── Attachment handlers ──
  const handleFileAttach = (e, kind) => {
    const files = Array.from(e.target.files);
    const newAtts = files.map(f => ({
      id: Date.now() + Math.random(),
      name: f.name,
      size: f.size,
      type: f.type,
      kind,
      url: URL.createObjectURL(f),
      file: f,
    }));
    setAttachments(prev => [...prev, ...newAtts]);
    setAttachMenuOpen(false);
    e.target.value = '';
  };

  const removeAttachment = (id) => {
    setAttachments(prev => { const att = prev.find(a=>a.id===id); if(att) URL.revokeObjectURL(att.url); return prev.filter(a=>a.id!==id); });
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes+'B';
    if (bytes < 1048576) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/1048576).toFixed(1)+'MB';
  };

  // Voice note recording via MediaRecorder
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg' });
      audioChunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: rec.mimeType });
        const url = URL.createObjectURL(blob);
        const ext = rec.mimeType.includes('webm') ? 'webm' : 'ogg';
        const voiceAtt = {
          id: Date.now() + Math.random(),
          name: `voice_note_${Date.now()}.${ext}`,
          size: blob.size,
          type: blob.type,
          kind: 'voice',
          url,
          file: blob,
        };
        setAttachments(prev => [...prev, voiceAtt]);
        stream.getTracks().forEach(t => t.stop());
        clearInterval(recordTimerRef.current);
        setRecordingTimer(0);
      };
      rec.start();
      mediaRecRef.current = rec;
      setIsRecordingVoice(true);
      let elapsed = 0;
      recordTimerRef.current = setInterval(() => {
        elapsed += 1;
        setRecordingTimer(elapsed);
        if (elapsed >= 60) stopVoiceRecording(); // max 60s
      }, 1000);
    } catch(e) {
      setVoiceError('Microphone access denied. Please allow microphone permission.');
      setTimeout(() => setVoiceError(''), 4000);
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
      mediaRecRef.current.stop();
      mediaRecRef.current = null;
    }
    setIsRecordingVoice(false);
    clearInterval(recordTimerRef.current);
    setAttachMenuOpen(false);
  };

  const fmtRecTime = (s) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const doSend = useCallback(async (text) => {
    const t = text?.trim();
    const hasAttachments = attachments.length > 0;
    if (!t && !hasAttachments || typing || abortRef.current) return;

    const msgAttachments = [...attachments];
    const userMsg = { id: Date.now(), role:'user', content: t || '📎 Sent attachment(s)', ts:new Date(), attachments: msgAttachments };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setAttachMenuOpen(false);
    setTyping(true);

    // Add to history for Groq
    historyRef.current = [...historyRef.current, { role:'user', content:t }];

    await new Promise(r => setTimeout(r, 400 + Math.random()*600));
    if (abortRef.current) return;

    let responseText = null;

    // Try Groq first
    if (groqEnabled) {
      const groqResp = await callGroq(historyRef.current.slice(-10), service);
      if (groqResp) {
        responseText = groqResp.text;
        historyRef.current = [...historyRef.current, { role:'assistant', content:responseText }];
      }
    }

    // Fallback to local KB
    if (!responseText) {
      const result = env.step({ user_message:t, category:service.id });
      responseText = result.info.response_text;
      setStats({ steps:result.info.step, reward: Math.round(result.info.total_reward*100)/100 });
      historyRef.current = [...historyRef.current, { role:'assistant', content:responseText }];
    }

    if (!abortRef.current) {
      setMessages(prev => [...prev, { id:Date.now()+1, role:'assistant', content:responseText, ts:new Date() }]);
    }
    setTyping(false);
  }, [typing, service, groqEnabled]);

  // Voice start
  const startVoice = useCallback(() => {
    if (!voiceSupported) {
      setVoiceError('Voice recognition requires Chrome or Edge browser.');
      setTimeout(() => setVoiceError(''), 5000);
      return;
    }
    if (voiceState !== VS.IDLE) { stopRec(); return; }

    setVoiceError('');
    setTranscript('');
    finalRef.current = '';

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();

    // Use profile language
    const langCode = LANG_CODES[profile?.language] || 'en-IN';
    rec.lang = langCode;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => setVoiceState(VS.LISTENING);

    rec.onresult = (ev) => {
      let interim = '', final = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) final += t;
        else interim += t;
      }
      const display = final || interim;
      setTranscript(display);
      setInput(display);
      if (final) finalRef.current = final;
    };

    rec.onspeechend = () => { try { rec.stop(); } catch(e){} };

    rec.onend = () => {
      recRef.current = null;
      setVoiceState(VS.IDLE);
      setTranscript('');
      const toSend = finalRef.current.trim();
      finalRef.current = '';
      if (toSend) {
        setInput('');
        doSend(toSend);
      }
    };

    rec.onerror = (ev) => {
      recRef.current = null;
      const ERR = {
        'not-allowed':      'Microphone access denied. Please allow microphone permission in browser settings.',
        'permission-denied':'Microphone permission denied. Click the lock icon in the address bar to allow.',
        'no-speech':        'No speech detected. Please speak clearly after the mic icon turns red.',
        'network':          'Network error for speech service. Please check your internet connection.',
        'audio-capture':    'No microphone detected. Please connect a microphone and try again.',
        'service-not-allowed': 'Speech service not allowed. This requires a secure connection (HTTPS).',
        'aborted':           null,
      };
      const msg = ERR[ev.error];
      if (msg) { setVoiceError(msg); setVoiceState(VS.ERROR); setTimeout(()=>{ setVoiceError(''); setVoiceState(VS.IDLE); }, 6000); }
      else setVoiceState(VS.IDLE);
    };

    recRef.current = rec;
    try { rec.start(); }
    catch(e) { setVoiceError('Could not start microphone: ' + e.message); setVoiceState(VS.ERROR); setTimeout(()=>{ setVoiceError(''); setVoiceState(VS.IDLE); }, 5000); }
  }, [voiceSupported, voiceState, profile?.language, stopRec, doSend]);

  const fmt = (text) => text.split('\n').map((line,i,arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <React.Fragment key={i}>
        {parts.map((p,j) => j%2===1 ? <strong key={j}>{p}</strong> : p)}
        {i < arr.length-1 && <br/>}
      </React.Fragment>
    );
  });

  const micTip = { [VS.IDLE]:'Tap to speak', [VS.LISTENING]:'Listening — tap to stop', [VS.ERROR]:'Error — tap to retry' };

  return (
    <div className="cp-root">
      {/* Header */}
      <div className="cp-header" style={{ '--c': service.color }}>
        <button className="cp-icon-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <button className="cp-icon-btn" onClick={onBack} aria-label="Go back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M5 12l7 7M5 12l7-7"/></svg>
        </button>

        <div className="cp-svc-info">
          <div className="cp-svc-name">{service.label} Support</div>
          <div className="cp-svc-sub">
            Helpline: <strong>{service.helpline}</strong>
            {groqEnabled && <span className="cp-ai-badge">AI</span>}
          </div>
        </div>

        <div className="cp-header-right">
          {profile.photo && (
            <img src={profile.photo} alt={profile.fullName} className="cp-avatar"/>
          )}
          <div className="cp-stats-pill">
            <span>Reward:</span>
            <strong style={{color:service.color}}>{stats.reward}</strong>
          </div>
        </div>
      </div>

      {/* Color bar for service */}
      <div className="cp-service-bar" style={{ background: service.color }}/>

      {/* Quick queries */}
      <div className="cp-chips-row">
        {(QUICK[service.id]||[]).map((q,i) => (
          <button key={i} className="cp-chip" onClick={() => doSend(q)}>{q}</button>
        ))}
      </div>

      {/* Voice listening bar */}
      {voiceState === VS.LISTENING && (
        <div className="cp-voice-bar">
          <div className="cp-vb-mic">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>
          </div>
          <div className="cp-vb-wave">
            {Array.from({length:16}).map((_,i)=>(
              <span key={i} className="cp-vb-bar" style={{animationDelay:`${i*0.07}s`}}/>
            ))}
          </div>
          <div className="cp-vb-text">
            {transcript ? <em>"{transcript}"</em> : 'Listening... speak now'}
          </div>
          <button className="cp-vb-stop" onClick={stopRec}>Stop</button>
        </div>
      )}

      {/* Voice error */}
      {voiceError && (
        <div className="cp-voice-err">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          {voiceError}
        </div>
      )}

      {/* Messages */}
      <div className="cp-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`cp-row ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="cp-bot-av" style={{background:`color-mix(in srgb,${service.color} 12%,white)`,border:`1.5px solid color-mix(in srgb,${service.color} 20%,transparent)`}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={service.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
            )}
            <div className={`cp-bubble ${msg.role}`} style={msg.role==='user'?{'--c':service.color}:{}}>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="cp-msg-attachments">
                  {msg.attachments.map(att => (
                    <div key={att.id} className="cp-msg-att-item">
                      {att.kind === 'camera' && att.type.startsWith('image/') ? (
                        <img src={att.url} alt={att.name} className="cp-msg-img" />
                      ) : att.kind === 'audio' || att.type.startsWith('audio/') ? (
                        <div className="cp-msg-audio">
                          <span className="cp-msg-audio-icon">🎵</span>
                          <audio controls src={att.url} className="cp-msg-audio-player"/>
                        </div>
                      ) : att.type.startsWith('image/') ? (
                        <img src={att.url} alt={att.name} className="cp-msg-img" />
                      ) : (
                        <a href={att.url} download={att.name} className="cp-msg-file">
                          <span className="cp-msg-file-icon">📎</span>
                          <div>
                            <div className="cp-msg-file-name">{att.name}</div>
                            <div className="cp-msg-file-size">{att.size < 1048576 ? (att.size/1024).toFixed(1)+'KB' : (att.size/1048576).toFixed(1)+'MB'}</div>
                          </div>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="cp-bubble-text">{fmt(msg.content)}</div>
              <div className="cp-bubble-foot">
                <span>{msg.ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                {msg.role==='assistant' && <span className="cp-helpline-hint">Helpline: {service.helpline}</span>}
              </div>
            </div>
            {msg.role === 'user' && (
              <img src={profile.photo} alt="" className="cp-user-av"/>
            )}
          </div>
        ))}

        {typing && (
          <div className="cp-row assistant">
            <div className="cp-bot-av" style={{background:`color-mix(in srgb,${service.color} 12%,white)`,border:`1.5px solid color-mix(in srgb,${service.color} 20%,transparent)`}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={service.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div className="cp-bubble assistant">
              <div className="cp-typing"><span/><span/><span/></div>
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div className="cp-input-area" style={{ '--c': service.color }}>
        <div className="cp-groq-row">
          <label className="cp-groq-toggle">
            <input type="checkbox" checked={groqEnabled} onChange={e=>setGroqEnabled(e.target.checked)}/>
            <span className="cp-groq-label">
              {groqEnabled ? 'AI (Groq)' : 'Local KB'}
            </span>
          </label>
          <span className="cp-groq-hint">
            {groqEnabled ? 'Powered by Groq Llama' : 'Using built-in knowledge base'}
          </span>
        </div>

        {/* Hidden file inputs — wrapped to prevent browser rendering "Choose File" text */}
        <div style={{position:'absolute',width:0,height:0,overflow:'hidden',opacity:0,pointerEvents:'none','aria-hidden':true}}>
          <input ref={fileInputRef}   type="file" multiple accept="image/*,video/*,application/pdf,.doc,.docx,.txt" tabIndex={-1} onChange={e=>handleFileAttach(e,'file')}/>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" tabIndex={-1} onChange={e=>handleFileAttach(e,'camera')}/>
          <input ref={audioInputRef}  type="file" accept="audio/*" tabIndex={-1} onChange={e=>handleFileAttach(e,'audio')}/>
        </div>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="cp-attachments-preview">
            {attachments.map(att => (
              <div key={att.id} className="cp-att-chip">
                <span className="cp-att-icon">
                  {att.kind==='camera'?'📷':att.kind==='audio'?'🎵':'📎'}
                </span>
                <span className="cp-att-name">{att.name.length>20?att.name.slice(0,18)+'…':att.name}</span>
                <span className="cp-att-size">{formatFileSize(att.size)}</span>
                <button className="cp-att-remove" onClick={()=>removeAttachment(att.id)}>✕</button>
              </div>
            ))}
          </div>
        )}

        {isRecordingVoice && (
          <div className="cp-recording-bar">
            <span className="cp-rec-dot"/>
            <span className="cp-rec-label">Recording voice note... {fmtRecTime(recordingTimer)}</span>
            <button type="button" className="cp-rec-stop" onClick={stopVoiceRecording}>Stop</button>
          </div>
        )}

        <form className="cp-form" onSubmit={e=>{e.preventDefault();doSend(input);}}>
          {/* Attachment menu */}
          <div className="cp-attach-wrap">
            <button type="button" className={`cp-attach-btn ${attachMenuOpen?'open':''}`}
              onClick={()=>setAttachMenuOpen(o=>!o)} title="Attach files" aria-label="Attach files">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            {attachMenuOpen && (
              <div className="cp-attach-menu">
                <button type="button" className="cp-attach-option" onClick={()=>{cameraInputRef.current?.click();}}>
                  <span className="cp-attach-opt-icon">📷</span>
                  <div><div className="cp-attach-opt-label">Camera</div><div className="cp-attach-opt-sub">Take a photo</div></div>
                </button>
                <button type="button" className="cp-attach-option" onClick={()=>{fileInputRef.current?.click();}}>
                  <span className="cp-attach-opt-icon">📁</span>
                  <div><div className="cp-attach-opt-label">File Manager</div><div className="cp-attach-opt-sub">Any file type</div></div>
                </button>
                <button type="button" className="cp-attach-option" onClick={()=>{audioInputRef.current?.click();}}>
                  <span className="cp-attach-opt-icon">🎵</span>
                  <div><div className="cp-attach-opt-label">Audio File</div><div className="cp-attach-opt-sub">MP3, WAV, M4A</div></div>
                </button>
                <button type="button" className="cp-attach-option" onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}>
                  <span className="cp-attach-opt-icon">{isRecordingVoice ? '⏹️' : '🎙️'}</span>
                  <div>
                    <div className="cp-attach-opt-label">{isRecordingVoice ? `Stop Recording (${fmtRecTime(recordingTimer)})` : 'Record Voice Note'}</div>
                    <div className="cp-attach-opt-sub">{isRecordingVoice ? 'Tap to stop recording' : 'Record up to 60 seconds'}</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Voice button */}
          <div className="cp-mic-group">
            <button type="button" className={`cp-mic ${voiceState}`} onClick={startVoice}
              disabled={voiceState===VS.ERROR}
              title={voiceSupported ? micTip[voiceState] : 'Requires Chrome on HTTPS'}
              aria-label={micTip[voiceState]}>
              {voiceState===VS.LISTENING
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/></svg>}
            </button>
          </div>

          <input ref={inputRef} className="cp-input"
            placeholder={voiceState===VS.LISTENING ? 'Listening...' : `Message (${profile?.language||'English'})...`}
            value={input} onChange={e=>setInput(e.target.value)} disabled={voiceState===VS.LISTENING}/>

          <button type="submit" className="cp-send"
            disabled={(!input.trim() && !attachments.length) || typing}
            style={{background:(input.trim()||attachments.length)&&!typing ? service.color : undefined}}
            aria-label="Send">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </form>

        <div className="cp-footer-note">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          TrustAid · OpenEnv Active · Language: {profile?.language || 'English'}
        </div>
      </div>
    </div>
  );
}
