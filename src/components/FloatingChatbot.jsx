import React, { useState, useRef, useEffect } from 'react';
import './FloatingChatbot.css';

// ── API CONFIG ──
// Option A: Use Groq (replace with real key from console.groq.com)
const GROQ_API_KEY =  import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL   = "llama-3.3-70b-versatile";
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

// Option B: Use Anthropic Claude (set key from console.anthropic.com)
const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY';

const SYSTEM_PROMPT = `You are TrustAid AI — a concise emergency and customer support assistant for India.
Help with: police, fire brigade, ambulance, women safety, food delivery, cyber crime, disaster relief, and general queries.
For ANY life-threatening situation: immediately give emergency numbers (112, 108, 100, 101, 1091) FIRST.
Be empathetic, clear, and action-oriented. Keep responses under 200 words unless critical detail is needed.
Respond in the same language the user writes in (Hindi, Bengali, Tamil, etc. are all supported).`;

const DEMO_RESPONSES = {
  emergency: "🚨 **Immediate Emergency Numbers:**\n• National: **112**\n• Police: **100**\n• Fire: **101**\n• Ambulance: **108**\n• Women Safety: **1091**\n\nI'm in demo mode. Add a Groq API key at console.groq.com for full AI.",
  food: "🍔 **Food Delivery Help:**\n1. Open your delivery app → My Orders → Track\n2. If late: Contact delivery partner via app\n3. Wrong item: App → Report Issue → Refund in 24h\n\nDemo mode active — add Groq API key for full AI.",
  police: "🚔 **Police Support:**\n• Emergency: **100** | National: **112**\n• File FIR online at your state police portal\n• Cyber crime: **1930** | cybercrime.gov.in\n\nDemo mode — add Groq API key for live AI.",
  default: "👋 I'm **TrustAid AI** running in demo mode.\n\nTo enable full AI responses, add your **Groq API key** from console.groq.com into `FloatingChatbot.jsx` → `GROQ_API_KEY`.\n\nFor emergencies, call **112** (National Emergency).",
};

function getDemoResponse(q) {
  const ql = q.toLowerCase();
  if (/emergency|urgent|help|danger|attack|accident|fire|ambulan/i.test(ql)) return DEMO_RESPONSES.emergency;
  if (/food|order|deliver|swiggy|zomato|refund/i.test(ql)) return DEMO_RESPONSES.food;
  if (/police|fir|crime|theft|robbery|complaint/i.test(ql)) return DEMO_RESPONSES.police;
  return DEMO_RESPONSES.default;
}

async function callGroq(messages) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 512,
      temperature: 0.65,
      stream: false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error ${res.status}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || 'No response.';
}

async function callAnthropic(messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Anthropic API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || 'No response.';
}

export default function FloatingChatbot({ theme }) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [apiMode]             = useState(() => {
    if (GROQ_API_KEY && GROQ_API_KEY.length > 10) return 'groq';
    if (ANTHROPIC_API_KEY !== 'YOUR_ANTHROPIC_API_KEY') return 'anthropic';
    return 'demo';
  });
  const [unread, setUnread]   = useState(0);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      if (!msgs.length) {
        setMsgs([{
          role: 'assistant',
          text: `Hello! I'm **TrustAid AI** 🤖\n\nI can help with emergencies, support queries, and safety guidance.\n\n🆘 Emergency? Type your situation or call **112** immediately.\n\n_Mode: ${apiMode === 'demo' ? 'Demo (add API key for full AI)' : apiMode.toUpperCase() + ' AI Active'}_`,
          ts: new Date(),
        }]);
      }
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', text, ts: new Date() };
    setMsgs(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      let reply;
      if (apiMode === 'demo') {
        await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
        reply = getDemoResponse(text);
      } else {
        // Build history for API
        const history = [...msgs.slice(-8), userMsg]
          .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

        if (apiMode === 'groq') reply = await callGroq(history);
        else reply = await callAnthropic(history);
      }
      setMsgs(prev => [...prev, { role: 'assistant', text: reply, ts: new Date() }]);
      if (!open) setUnread(u => u + 1);
    } catch (err) {
      setMsgs(prev => [...prev, {
        role: 'assistant',
        text: `⚠️ AI service unavailable.\n\n${err.message}\n\nFor emergencies please call **112** directly.`,
        ts: new Date(),
        isError: true,
      }]);
    }
    setLoading(false);
  };

  const fmt = (text) => text.split('\n').map((line, i, arr) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    const el = parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p.replace(/^_(.*)_$/,'$1'));
    return <React.Fragment key={i}>{el}{i < arr.length-1 && <br/>}</React.Fragment>;
  });

  const modeLabel = apiMode === 'demo' ? 'Demo Mode' : apiMode === 'groq' ? 'Groq AI' : 'Claude AI';
  const modeDotClass = apiMode === 'demo' ? 'demo' : 'live';

  return (
    <div className={`fcb-wrap ${theme === 'dark' ? 'dark' : ''}`}>
      {open && (
        <div className="fcb-window" role="dialog" aria-label="TrustAid AI Chat">
          <div className="fcb-head">
            <div className="fcb-head-info">
              <div className="fcb-avatar">🤖</div>
              <div>
                <div className="fcb-title">TrustAid AI</div>
                <div className="fcb-subtitle">
                  <span className={`fcb-dot ${modeDotClass}`}/>
                  {modeLabel}
                </div>
              </div>
            </div>
            <div className="fcb-head-actions">
              <button className="fcb-clear-btn" onClick={() => setMsgs([])} title="Clear chat">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
                </svg>
              </button>
              <button className="fcb-close-btn" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="fcb-msgs">
            {msgs.map((msg, i) => (
              <div key={i} className={`fcb-msg ${msg.role} ${msg.isError ? 'error' : ''}`}>
                {msg.role === 'assistant' && <div className="fcb-msg-av">🤖</div>}
                <div className="fcb-bubble">
                  <div className="fcb-text">{fmt(msg.text)}</div>
                  <div className="fcb-ts">{msg.ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="fcb-msg assistant">
                <div className="fcb-msg-av">🤖</div>
                <div className="fcb-bubble">
                  <div className="fcb-typing"><span/><span/><span/></div>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Quick suggestions */}
          {msgs.length <= 1 && (
            <div className="fcb-suggestions">
              {['🚨 I need emergency help','🍔 Track my food order','🚔 How to file FIR'].map(s => (
                <button key={s} className="fcb-sug-chip" onClick={() => { setInput(s.replace(/^[^\s]+ /,'')); inputRef.current?.focus(); }}>{s}</button>
              ))}
            </div>
          )}

          <div className="fcb-input-area">
            <input
              ref={inputRef}
              className="fcb-input"
              placeholder="Ask TrustAid AI..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              disabled={loading}
              maxLength={500}
            />
            <button className="fcb-send" onClick={send} disabled={!input.trim() || loading} aria-label="Send">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        className={`fcb-fab ${open ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Open TrustAid AI"
        aria-expanded={open}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            <circle cx="9"  cy="11" r="1" fill="currentColor"/>
            <circle cx="13" cy="11" r="1" fill="currentColor"/>
            <circle cx="17" cy="11" r="1" fill="currentColor"/>
          </svg>
        )}
        {!open && unread > 0 && <span className="fcb-unread">{unread}</span>}
        {!open && <span className="fcb-badge">AI</span>}
      </button>
    </div>
  );
}
