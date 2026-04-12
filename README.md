<<<<<<< HEAD
# 🚨 SafeCall — Universal Customer Support System (OpenEnv)

> **Meta × Scaler Hackathon** | OpenEnv Compatible | Real-World Task Simulation

A production-grade, AI-powered customer support platform that serves as a real-world **OpenEnv environment** where agents can learn from multi-domain support interactions.

[![HuggingFace](https://img.shields.io/badge/🤗_Hugging_Face-Spaces-blue)](https://huggingface.co/spaces)
[![OpenEnv](https://img.shields.io/badge/OpenEnv-Compatible-green)](https://openenv.dev)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## 🎯 Overview

SafeCall provides emergency and customer support across **6 domains**:

| Domain | Emoji | Helpline |
|--------|-------|----------|
| Women Safety | 👩 | 1091 |
| Police | 🚔 | 100 |
| Fire Brigade | 🔥 | 101 |
| Ambulance | 🚑 | 108 |
| Food Delivery | 🍔 | — |
| General | ❓ | — |

Users interact via **text or voice** (Web Speech API) and receive structured, actionable responses from the AI support system.

---

## 🧠 OpenEnv Specification

### Environment Architecture

```
CustomerSupportEnv
├── Observation Space
│   ├── user_query: string
│   ├── category: enum[6 domains]
│   ├── conversation_length: int
│   └── session_id: string
│
├── Action Space
│   ├── user_message: string
│   └── category: enum (optional override)
│
└── Reward Function
    ├── Response quality (confidence-based): 0.4 weight
    ├── Emergency number provision: 0.3 weight (for critical services)
    ├── Actionable step count: 0.2 weight
    └── Base meaningful response: 0.1 weight
```

### Core API

```javascript
import { CustomerSupportEnv } from './src/openenv.js';

const env = new CustomerSupportEnv();

// Reset environment
const { observation, info } = env.reset('police');

// Take a step
const result = env.step({
  user_message: "I want to report a theft",
  category: "police"
});

console.log(result.observation);   // Current observation
console.log(result.reward);        // 0.0 – 1.0
console.log(result.done);          // Episode finished?
console.log(result.info);          // Step count, total reward, response

// Get full state
const state = env.state();
```

---

## 📊 Tasks & Grading

### Task 1 — Easy: Food Order Tracking
```
ID: task_easy_food_track
Category: food
Scenario: "Where is my order? I ordered 45 minutes ago."
Criteria: [mentions tracking, mentions app, provides actionable steps]
Expected Score: 0.7 – 1.0
```

### Task 2 — Medium: Women Safety
```
ID: task_medium_women_safety
Category: women_safety
Scenario: "I feel like someone is following me home right now. I'm scared."
Criteria: [provides emergency number, immediate steps, share location, empathy]
Expected Score: 0.6 – 1.0
```

### Task 3 — Hard: Complex Medical Emergency
```
ID: task_hard_medical_emergency
Category: ambulance
Scenario: "My father (68) collapsed, not responding, lips turning blue.
          Has diabetes and heart condition."
Criteria: [calls 108/112, CPR instructions, heart protocol, checks breathing, step-by-step]
Expected Score: 0.5 – 1.0
```

---

## 🎖️ Reward Function

```
R(response, category) = 
  0.20 × is_meaningful(response)          # len > 50 chars
+ 0.40 × confidence_score(response)       # pattern match quality
+ 0.30 × provides_emergency_number(response, category)  # for critical services
+ 0.10 × has_actionable_steps(response)   # numbered steps or checkmarks
```

Reward is clipped to **[0.0, 1.0]**.

---

## 🔊 Voice Input

Voice input uses the **Web Speech API** (no additional dependencies):

```javascript
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SR();
recognition.lang = 'en-IN';  // Indian English
recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  sendMessage(transcript);
};
recognition.start();
```

**Supported browsers**: Chrome, Edge, Safari (not Firefox)

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- npm 9+

### Local Development

```bash
# Clone the repository
git clone https://github.com/your-username/safecall-openenv
cd safecall-openenv

# Install dependencies
npm install

# Start development server
npm run dev

# Open: http://localhost:5173
```

### Baseline Inference

```bash
# Install Python dependencies
pip install openai

# Run baseline evaluation
export OPENAI_API_KEY=your_key_here
python baseline_inference.py

# Output: baseline_results.json with reproducible scores
```

### Docker / Hugging Face Spaces

```bash
# Build Docker image
docker build -t safecall-openenv .

# Run container (HF Spaces uses port 7860)
docker run -p 7860:7860 safecall-openenv

# Open: http://localhost:7860
```

---

## 📁 Project Structure

```
safecall-openenv/
├── src/
│   ├── openenv.js          # Core OpenEnv environment (step/reset/state)
│   ├── App.jsx             # Root component + routing
│   ├── main.jsx            # React entry point
│   ├── styles/
│   │   └── global.css      # Global design system
│   └── components/
│       ├── HomePage.jsx    # Service selection grid
│       ├── HomePage.css
│       ├── ChatPage.jsx    # Chat interface with voice
│       ├── ChatPage.css
│       ├── AgentPanel.jsx  # OpenEnv task runner & grader
│       └── AgentPanel.css
├── openenv.yaml            # OpenEnv metadata specification
├── baseline_inference.py   # Baseline agent evaluation script
├── Dockerfile              # Container for HF Spaces deployment
├── index.html              # HTML entry point
├── vite.config.js          # Vite build config
├── package.json
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Custom CSS (no UI library) |
| Fonts | Syne (display) + DM Sans (body) |
| Voice | Web Speech API |
| Environment | Pure JS OpenEnv implementation |
| Baseline | Python + OpenAI API |
| Deploy | Docker + Hugging Face Spaces |

---

## 📝 License

MIT License — Built for Meta × Scaler OpenEnv Hackathon 2026
=======
# TrustAid
>>>>>>> fix-branch
