// TrustAid OpenEnv Core
export const SERVICES = {
  police:   { id:'police',   label:'Police',      icon:'police',   color:'#1a3a6c', desc:'Crime reporting, FIR, law enforcement support', helpline:'100' },
  fire:     { id:'fire',     label:'Fire',        icon:'fire',     color:'#c0392b', desc:'Fire emergencies, gas leaks, rescue operations', helpline:'101' },
  medical:  { id:'medical',  label:'Medical',     icon:'medical',  color:'#c0392b', desc:'Ambulance dispatch, first aid, medical emergencies', helpline:'108' },
  disaster: { id:'disaster', label:'Disaster',    icon:'disaster', color:'#8B6914', desc:'Flood, earthquake, natural disaster relief', helpline:'1078' },
  woman:    { id:'woman',    label:'Woman',       icon:'woman',    color:'#8e44ad', desc:'Women safety, helpline, harassment and abuse', helpline:'1091' },
  child:    { id:'child',    label:'Child',       icon:'child',    color:'#2980b9', desc:'Child safety, missing child, abuse reporting', helpline:'1098' },
  elderly:  { id:'elderly',  label:'Elderly',     icon:'elderly',  color:'#16a085', desc:'Senior citizen welfare, health and safety', helpline:'14567' },
  railway:  { id:'railway',  label:'Railway',     icon:'railway',  color:'#1a5276', desc:'Railway emergencies, accidents, helpline', helpline:'139' },
  animal:   { id:'animal',   label:'Animal',      icon:'animal',   color:'#27ae60', desc:'Animal rescue, cruelty reporting, stray help', helpline:'1962' },
  cyber:    { id:'cyber',    label:'Cyber Crime', icon:'cyber',    color:'#2c3e50', desc:'Online fraud, cybercrime, digital safety', helpline:'1930' },
  food:     { id:'food',     label:'Food',        icon:'food',     color:'#e67e22', desc:'Food delivery issues, FSSAI complaints', helpline:'14417' },
  other:    { id:'other',    label:'Other',       icon:'other',    color:'#7f8c8d', desc:'General queries and miscellaneous support', helpline:'112' },
};

const KB = {
  police:{ patterns:[{match:['fir','complaint','report','file'],response:"**Filing an FIR:**\n\n1. Visit nearest police station — they CANNOT refuse\n2. Online: state police portal\n3. Emergency: Dial **100**\n\nRequired: Date/time/location, incident description, suspect details."},{match:['theft','stolen','robbery'],response:"**Theft/Robbery:**\n\n1. Call **100** if recent\n2. Do NOT disturb crime scene\n3. File FIR within 24 hours\n4. Block bank cards immediately\n5. Request CCTV preservation\n\nCyber fraud: **1930**"},{match:['missing','lost','kidnap'],response:"**Missing Person — URGENT:**\n\n1. Call **100** immediately\n2. trackthemissingchild.gov.in\n3. Child missing: **1098** (Childline)\n\nProvide recent photo, last seen time, clothing description."}],default:"**Police Support** — Emergency: **100**\n\nI can help with FIR filing, crime reporting, missing persons, and legal guidance.\n\nWhat do you need?" },
  fire:{ patterns:[{match:['fire','flame','burn','smoke'],response:"**FIRE EMERGENCY — CALL 101 NOW**\n\n1. Alert everyone, activate alarm\n2. Use stairs ONLY, not elevators\n3. Crawl low under smoke\n4. Feel doors — hot means blocked\n\nIf trapped: Close door, signal from window, call **101** with exact location."},{match:['gas','leak','lpg'],response:"**GAS LEAK — CRITICAL:**\n\n1. Do NOT touch any electrical switches\n2. Close gas valve safely\n3. Open all windows and doors\n4. Evacuate immediately\n5. Call **101** from OUTSIDE"}],default:"**Fire Brigade** — Emergency: **101**\n\nDescribe your situation and I will guide you immediately." },
  medical:{ patterns:[{match:['heart','cardiac','chest pain'],response:"**HEART ATTACK — CALL 108 NOW**\n\n1. Patient must sit or lie still\n2. Loosen all tight clothing\n3. Aspirin 325mg if conscious and available\n4. If unconscious: CPR — 30 compressions + 2 breaths\n5. Unlock door for paramedics\n6. Note exact time symptoms started"},{match:['unconscious','collapse','unresponsive'],response:"**UNCONSCIOUS — CALL 112 + 108 NOW**\n\n1. Tap shoulders, shout name\n2. Check breathing 10 seconds\n3. Not breathing: Start CPR\n   - 30 hard chest compressions\n   - 2 rescue breaths\n   - Repeat until help arrives\n4. Recovery position if breathing"},{match:['bleed','wound','cut'],response:"**Severe Bleeding:**\n\n1. Apply firm direct pressure\n2. Do NOT remove soaked cloth, add more\n3. Elevate above heart level\n4. Tourniquet on limb only if life-threatening\n5. Call **108**"},{match:['stroke','facial','droop','slurred'],response:"**STROKE — FAST Test:**\n\n**F** — Face drooping?\n**A** — Arm weakness?\n**S** — Speech slurred?\n**T** — Time: Call **108 NOW**\n\nNote symptom time. No food or water."}],default:"**Medical Emergency** — Ambulance: **108** | Emergency: **112**\n\nDescribe the situation and I will guide you through first aid." },
  disaster:{ patterns:[{match:['flood','water','rain'],response:"**Flood Safety:**\n\n1. Move to higher ground immediately\n2. Avoid moving water\n3. Stay away from electrical equipment\n4. NDMA: **1078**\n5. Signal from rooftop with bright cloth"},{match:['earthquake','tremor'],response:"**Earthquake — Drop Cover Hold:**\n\n1. DROP to hands and knees\n2. COVER under sturdy table\n3. HOLD until shaking stops\n\nAfter: Check gas leaks, move to open ground. NDMA: **1078**"}],default:"**Disaster Management** — NDMA: **1078** | Emergency: **112**\n\nDescribe what has happened:" },
  woman:{ patterns:[{match:['unsafe','danger','threat','follow','stalk'],response:"**You are not alone. Act now:**\n\n1. Call **112** (Emergency) or **1091** (Women's Helpline)\n2. Share live location with trusted contact\n3. Move to crowded, lit area\n4. Enter nearest shop, hospital, or police post\n\n**One Stop Centre: 181** — free shelter, legal aid, medical"},{match:['abuse','domestic','violence','husband'],response:"**Domestic Violence Support:**\n\n- National Women Helpline: **181** (24/7)\n- NCW complaint: ncwapps.nic.in\n- PWDVA 2005 — Protection Order available\n- Shelter available immediately\n\nYou have rights. Would you like guidance on protection orders?"},{match:['harass','workplace','sexual'],response:"**Workplace Harassment — POSH Act:**\n\n1. File with Internal Complaints Committee\n2. No ICC: District Collector's Local Committee\n3. NCW: **7217735372**\n\nDocument all incidents with dates and witnesses."}],default:"**Women Safety** — Helpline: **1091** | One Stop: **181** | Emergency: **112**\n\nThis is a safe, confidential space. How can I help?" },
  child:{ patterns:[{match:['missing','lost','abduct'],response:"**Missing Child — URGENT:**\n\n1. Call **1098** (Childline) + **100** immediately\n2. trackthemissingchild.gov.in\n3. Provide photo, description, last location\n4. Alert schools and transport hubs"},{match:['abuse','hurt','harm'],response:"**Child Abuse Reporting:**\n\n1. Call **1098** (Childline — 24/7)\n2. POCSO complaint at police station\n3. Child Welfare Committee referral\n\nIs the child currently safe?"}],default:"**Child Safety** — Childline: **1098** | Police: **100**\n\nHow can I assist?" },
  elderly:{ patterns:[{match:['fall','fracture','pain'],response:"**Elder Medical Emergency — Call 108**\n\n1. Do NOT move if back/neck injury suspected\n2. Keep warm\n3. Note all medications for paramedics\n\nSenior Citizen Helpline: **14567**"},{match:['abuse','neglect','alone'],response:"**Elder Abuse / Neglect:**\n\n- Senior Citizen Helpline: **14567**\n- Police complaint under Parents Welfare Act\n- District Collector maintenance tribunal\n\nIs the person currently safe?"}],default:"**Senior Citizen Support** — Helpline: **14567** | Emergency: **112**\n\nHow can I assist?" },
  railway:{ patterns:[{match:['accident','derail','collision'],response:"**Railway Accident — Emergency:**\n\n1. Call **139** immediately\n2. Move away from tracks\n3. Do NOT touch electrical lines\n4. Provide train number and location\n\nRPF will be dispatched immediately."}],default:"**Railway Support** — Helpline: **139** | Emergency: **112**\n\nWhat do you need?" },
  animal:{ patterns:[{match:['bite','snake','dog','attack'],response:"**Animal Bite — Medical Priority:**\n\n1. Call **108** if severe\n2. Wash wound 15 minutes with soap and water\n3. Anti-rabies vaccine required — go to hospital\n4. Animal rescue: municipal corporation helpline\n\nAWBI: **1800-425-0982**"},{match:['stray','rescue','injured'],response:"**Animal Rescue:**\n\n- AWBI: **1800-425-0982**\n- Wildlife SOS: **9871963535**\n- Local SPCA/Blue Cross\n\nDo NOT handle wild animals. Keep distance."}],default:"**Animal Welfare** — AWBI: **1800-425-0982**\n\nDescribe the situation:" },
  cyber:{ patterns:[{match:['fraud','scam','hack','money','otp'],response:"**Cyber Fraud — Act in FIRST HOUR:**\n\n1. Call **1930** (24/7 Cyber Helpline)\n2. cybercrime.gov.in — online report\n3. Freeze bank account immediately\n4. FIR with screenshots as evidence\n\nDo NOT pay more or share OTP."}],default:"**Cyber Crime** — Helpline: **1930** | cybercrime.gov.in\n\nDescribe what happened:" },
  food:{ patterns:[{match:['track','where','location'],response:"**Track Order:**\n\nApp → My Orders → Track Order (live GPS)\n\nIf failing: Help → Chat Support → Order Status\n\nShare order ID for specific help."},{match:['late','delay','waiting'],response:"**Delayed Order:**\n\n1. Check updated ETA in app\n2. Call delivery partner in-app\n3. Help → Order is Late\n\nOver 30 min delay qualifies for compensation.\n\nFSSAI Complaint: **1800-112-100**"},{match:['refund','cancel','money'],response:"**Refund:**\n\nApp → My Orders → Report Issue → Photos\n\nTimeline: Wallet instant, Card 5-7 days\n\nConsumer Forum: consumerhelpline.gov.in"}],default:"**Food Support** — FSSAI: **1800-112-100**\n\nWhat is your concern?" },
  other:{ patterns:[{match:['electricity','power','outage'],response:"**Electricity:** Report to DISCOM\n- National: **1912**\n- Bill dispute: Visit local office"},{match:['bank','atm','fraud'],response:"**Banking:**\n- Block card: Bank helpline\n- Cyber fraud: **1930**\n- RBI Ombudsman: **14448**"}],default:"**General Support** — National Emergency: **112**\n\nWhat do you need assistance with?" }
};

export class CustomerSupportEnv {
  constructor() { this._s = this._init(); }
  _init() { return { session_id:`sess_${Date.now()}`, category:null, conversation:[], step_count:0, episode_reward:0, done:false }; }
  _respond(msg, cat) {
    const db = KB[cat]; if (!db) return { text:'How can I help?', conf:0.4 };
    const lm = msg.toLowerCase();
    for (const p of db.patterns) { if (p.match.some(k=>lm.includes(k))) return { text:p.response, conf:0.9 }; }
    return { text:db.default, conf:0.5 };
  }
  _reward(resp, cat) {
    let r = 0;
    if (resp.text.length > 60) r += 0.2;
    r += resp.conf * 0.4;
    const emW = ['call 112','call 108','call 100','call 101','emergency','immediate'];
    const emC = ['woman','medical','fire','police','child'];
    if (emC.includes(cat) && emW.some(w=>resp.text.toLowerCase().includes(w))) r += 0.3;
    if (resp.text.includes('1.') || resp.text.includes('**')) r += 0.1;
    return Math.min(r,1.0);
  }
  reset(cat=null) { this._s = this._init(); this._s.category=cat; return { observation:{user_query:'',category:cat}, info:{} }; }
  step(action) {
    const cat = action.category || this._s.category;
    this._s.category = cat;
    const resp = this._respond(action.user_message, cat);
    const reward = this._reward(resp, cat);
    this._s.conversation.push({ role:'user', content:action.user_message });
    this._s.conversation.push({ role:'assistant', content:resp.text });
    this._s.step_count++;
    this._s.episode_reward += reward;
    const done = this._s.step_count >= 30;
    this._s.done = done;
    return { observation:{user_query:resp.text,category:cat}, reward, done, info:{step:this._s.step_count, total_reward:this._s.episode_reward, response_text:resp.text, confidence:resp.conf} };
  }
  state() { return { ...this._s }; }
  gradeTask(taskId, agentResponse) {
    const task = TASKS.find(t=>t.id===taskId);
    if (!task) return { score:0, feedback:'Task not found' };
    const lower = agentResponse.toLowerCase();
    const met = task.success_criteria.filter(c=>c.split(' ').some(w=>lower.includes(w)));
    const score = met.length / task.success_criteria.length;
    return { task_id:taskId, difficulty:task.difficulty, score:Math.round(score*100)/100, met_criteria:met, total_criteria:task.success_criteria.length, feedback:score>=0.8?'Excellent':score>=0.5?'Partial':'Needs improvement' };
  }
}

export const env = new CustomerSupportEnv();

export const TASKS = [
  { id:'task_easy_food_track', difficulty:'easy', category:'food', scenario:'Track my food order, it has been 45 minutes.', success_criteria:['tracking','app','order'] },
  { id:'task_medium_woman_safety', difficulty:'medium', category:'woman', scenario:'I feel someone is following me home right now I am scared.', success_criteria:['emergency number','immediate steps','location','empathy'] },
  { id:'task_hard_medical', difficulty:'hard', category:'medical', scenario:'My 68-year-old father collapsed unconscious lips turning blue he has diabetes and heart condition.', success_criteria:['108 or 112','CPR','heart','breathing','step-by-step'] },
];

export const INDIAN_LANGUAGES = [
  'Assamese','Bengali','Bodo','Dogri','Gujarati','Hindi','Kashmiri','Konkani',
  'Maithili','Malayalam','Manipuri','Marathi','Nepali','Odia','Punjabi',
  'Sanskrit','Santali','Sindhi','Tamil','Telugu','Urdu','English'
];

export const LANG_CODES = {
  'Hindi':'hi-IN','Bengali':'bn-IN','Tamil':'ta-IN','Telugu':'te-IN',
  'Marathi':'mr-IN','Gujarati':'gu-IN','Kannada':'kn-IN','Malayalam':'ml-IN',
  'Punjabi':'pa-IN','Odia':'or-IN','Assamese':'as-IN','English':'en-IN',
  'Urdu':'ur-IN','Nepali':'ne-IN','Sanskrit':'sa-IN',
};

export const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
  'West Bengal',
  // UTs
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli and Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];
