# TokenLens — AI API Cost Intelligence Dashboard

> **Know exactly which feature and which user is driving your OpenAI and Anthropic costs.**
> One line of code. Full attribution. No surprise bills.

🔗 **Live Demo**: [tokenlens-three.vercel.app](https://tokenlens-three.vercel.app) | **GitHub**: [github.com/vidyullathaks/TokenLens](https://github.com/vidyullathaks/TokenLens)

---

## The Problem

When you build with AI APIs, your monthly bill grows fast — but the dashboard from OpenAI or Anthropic only tells you the total. It doesn't tell you:

- Which feature (`/chat`, `/summarize`, `/code-review`) is the expensive one?
- Which end-user is making 10× more calls than everyone else?
- Which model swap would cut your costs by 40%?

TokenLens is the missing attribution layer between your code and your AI provider bill.

---

## Quick Start — 60 seconds to your first tracked call

**1. Create an account and get your API key**

Sign up at [tokenlens-three.vercel.app](https://tokenlens-three.vercel.app). Your `tl_live_` key is auto-generated on the API Keys page. Copy it.

**2. Connect your AI provider**

Go to **Settings → Providers**, paste your OpenAI or Anthropic key, and click Connect.

**3. Change one line in your code**

**Python (OpenAI)**
```python
import openai

client = openai.OpenAI(
    base_url="https://tokenlens-three.vercel.app/api/proxy/openai",
    default_headers={
        "X-TL-Key": "tl_live_your_key_here",   # from Step 1
        "X-TL-Feature": "chat",                  # name this feature anything
        "X-TL-User": "user_123",                 # your end-user's ID
    }
)

# Everything else stays the same
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

**Node.js (OpenAI)**
```javascript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://tokenlens-three.vercel.app/api/proxy/openai",
  defaultHeaders: {
    "X-TL-Key": "tl_live_your_key_here",
    "X-TL-Feature": "chat",
    "X-TL-User": "user_123",
  },
});

// Everything else stays the same
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

**Python (Anthropic)**
```python
import anthropic

client = anthropic.Anthropic(
    base_url="https://tokenlens-three.vercel.app/api/proxy/anthropic",
    default_headers={
        "X-TL-Key": "tl_live_your_key_here",
        "X-TL-Feature": "summarize",
        "X-TL-User": "user_123",
    }
)
```

**4. Open the dashboard**

Refresh the TokenLens dashboard. Your call appears in the **Recent API Calls** feed within seconds, with cost, model, and feature tag. Done.

> **Tip**: Use `X-TL-Feature` to tag different features (`"chat"`, `"summarize"`, `"code-review"`) and `X-TL-User` to pass your end-user's ID. These two headers are what power the cost-by-feature and top-users breakdowns on the dashboard.

---

## How It Works

TokenLens acts as a transparent proxy between your app and your AI provider. You change one line of code:

**Before:**
```python
client = openai.OpenAI(api_key="sk-...")
```

**After:**
```python
client = openai.OpenAI(
    base_url="https://tokenlens-three.vercel.app/api/proxy/openai",
    default_headers={
        "X-TL-Key": "tl_live_your_key",
        "X-TL-Feature": "chat-assistant",   # tag which feature
        "X-TL-User": user_id,               # tag which end-user
    }
)
```

Every API call flows through TokenLens, which:
1. Forwards the request to OpenAI/Anthropic
2. Records token counts, model, feature tag, and user tag
3. Calculates exact cost using live pricing tables
4. Returns the original response — zero latency impact

---

## Features

### Dashboard
- **Total Spend** — rolling 30-day spend with trend indicator
- **API Calls** — total calls with change vs. prior period
- **Avg Cost / Call** — quickly spot expensive features
- **Active Features** — how many tagged features are tracked
- **Cost by Feature** — horizontal bar chart; see your top spenders instantly
- **Daily Spend (30 days)** — line chart to spot spikes before the invoice arrives
- **Top Users by Cost** — table of your 5 highest-spending end-users
- **Recent API Calls** — live feed of the last 20 calls with model, tokens, cost, and status
- **Demo mode** — one-click seed of realistic data so you can explore before connecting a provider

### API Keys
- Auto-generated `tl_live_` key on signup
- Masked display with reveal/copy toggle
- Python and Node.js integration snippets ready to copy

### Alerts
- **Daily spend threshold** — alert when 24-hour spend exceeds $X
- **Hourly spike** — alert when spend jumps above a % threshold
- **Single-feature limit** — alert when one feature exceeds $X/day
- Per-alert enable/disable toggles
- Alert history table with triggered values

### Settings / Provider Management
- Connect keys for **Anthropic, OpenAI, Google Gemini, Cohere, Mistral**
- Step-by-step instructions for generating each provider's key
- Keys are encrypted at rest using Fernet (AES-128-CBC) before storage
- Connected providers show masked key + disconnect option

### Authentication
- Email + password signup/login
- Secure bcrypt password hashing
- Session-based auth with server-side token validation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS, shadcn/ui, Recharts |
| Backend | FastAPI (Python), async (Motor) |
| Database | MongoDB |
| Auth | Custom email/password with bcrypt + session tokens |
| Encryption | Fernet (cryptography library) for provider key storage |
| Deployment | Vercel (frontend + serverless API) |

---

## Architecture

```
Your App
    │
    │  POST /api/proxy/openai/v1/chat/completions
    │  Headers: X-TL-Key, X-TL-Feature, X-TL-User
    ▼
┌─────────────────────────────────────┐
│           TokenLens API             │
│                                     │
│  1. Authenticate X-TL-Key           │
│  2. Forward request to OpenAI       │
│  3. Parse response token counts     │
│  4. Calculate cost from pricing     │
│  5. Write api_call record to DB     │
│  6. Return original response        │
└─────────────────────────────────────┘
    │
    ▼
OpenAI / Anthropic
```

### Database Collections

| Collection | Purpose |
|---|---|
| `users` | User accounts, hashed passwords, session tokens, TL API key |
| `providers` | Encrypted AI provider keys per user |
| `api_calls` | Every proxied call: provider, model, feature, user, tokens, cost |
| `alerts` | Alert configurations per user |
| `alert_history` | Log of triggered alerts |

### API Endpoints

**Auth**
```
POST /api/auth/register     — create account
POST /api/auth/login        — get session token
GET  /api/auth/me           — validate session
```

**Dashboard**
```
GET  /api/dashboard/real-stats            — summary cards
GET  /api/dashboard/real-cost-by-feature  — bar chart data
GET  /api/dashboard/real-cost-by-provider — provider breakdown
GET  /api/dashboard/real-daily-spend      — 30-day line chart
GET  /api/dashboard/real-recent-calls     — last 20 calls
GET  /api/dashboard/real-top-users        — top 5 users by cost
POST /api/dashboard/seed-demo             — load demo data
POST /api/dashboard/clear-demo            — remove demo data
```

**Proxy**
```
POST /api/proxy/openai/v1/chat/completions    — OpenAI proxy
POST /api/proxy/anthropic/v1/messages        — Anthropic proxy
```

**Settings & Alerts**
```
GET  /api/settings/profile       — user profile
GET  /api/settings/providers     — connected providers
POST /api/settings/providers     — add/update provider key
DELETE /api/settings/providers/{id}
GET  /api/alerts/config          — alert rules
PUT  /api/alerts/config/{id}     — update threshold / toggle
GET  /api/alerts/history         — triggered alert log
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB (local or Atlas)

### Backend

```bash
cd api
pip install -r ../requirements.txt

# Create .env
cp ../backend/.env.example .env
# Fill in MONGO_URL, DB_NAME, ENCRYPTION_SECRET

uvicorn server:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps

# Create .env
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

npm start
```

The app will be available at `http://localhost:3000`.

---

## Deployment (Vercel)

This project deploys as a single Vercel project — the React build is served as static files and the FastAPI backend runs as a serverless function.

```bash
npm i -g vercel
vercel

# Set these environment variables in Vercel dashboard:
# MONGO_URL          — MongoDB Atlas connection string
# DB_NAME            — e.g. tokenlens
# ENCRYPTION_SECRET  — any long random string (min 32 chars)
```

The `vercel.json` routes:
- `/api/*` → FastAPI serverless function
- Everything else → React SPA (`index.html`)

---

## Roadmap

- [ ] Google Gemini, Cohere, Mistral proxy endpoints
- [ ] Streaming support (SSE) for chat completions
- [ ] Email / Slack notification delivery for alerts
- [ ] CSV / JSON data export
- [ ] Date range filter on dashboard
- [ ] Team management (invite members, shared dashboard)
- [ ] Model-level cost breakdown
- [ ] Budget forecasting with ML anomaly detection

---

## Security Notes

- Provider API keys are encrypted with Fernet (AES-128-CBC + HMAC) before being stored in MongoDB. The `ENCRYPTION_SECRET` env variable is required to decrypt them and is never stored in the database.
- Passwords are hashed with bcrypt (cost factor 12) before storage. Plain-text passwords are never persisted.
- Session tokens are server-validated on every authenticated request.
- CORS is restricted to the deployed frontend origin only.
- The `/api/debug-db` endpoint was removed before production deployment.

---

## License

MIT
