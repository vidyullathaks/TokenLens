# TokenLens Roadmap

> This document tracks where TokenLens has been, where it's going, and the reasoning behind sequencing decisions.

**Last updated**: March 2026

---

## Guiding Principle

Each version should deliver a complete, self-contained value loop — not just a list of shipped features. A user on V1 should never feel like they're using a beta. A user on V3 should not have to relearn V1.

---

## V1 — Attribution (Shipped ✅)

**Theme**: Answer the first question every team asks: *"Where is my money going?"*

**What shipped:**
- Transparent proxy for OpenAI and Anthropic — one URL, three headers, zero SDK changes
- Per-feature cost attribution (`X-TL-Feature` header)
- Per-user cost attribution (`X-TL-User` header)
- 30-day spend dashboard: summary cards, cost-by-feature bar chart, daily spend line chart
- Top users by cost leaderboard
- Real-time call feed (last 20 calls with model, tokens, cost, latency)
- Spend threshold and spike alerts (daily, hourly, per-feature)
- Multi-provider key management with encrypted storage (Anthropic, OpenAI, Google, Cohere, Mistral)
- Demo mode — explore the dashboard with realistic seeded data before connecting a provider

**Why this first**: Attribution is table stakes. Without it, every downstream feature (alerts, budgets, recommendations) lacks the data to be useful.

---

## V2 — Control (Q2–Q3 2026)

**Theme**: Move from *observability* to *action*. Give teams the knobs to prevent the problems they can now see.

### 2.1 — Complete Provider Coverage
- [ ] Proxy endpoints for Google Gemini, Cohere, and Mistral (currently key management only)
- [ ] Streaming support (SSE) for OpenAI and Anthropic — required for any chat UI that uses `stream=True`

> **Why**: Proxy coverage gaps mean teams using Gemini or streaming must bypass TokenLens entirely, creating blind spots in their cost data.

### 2.2 — Team Management
- [ ] Invite team members by email with role-based access (Owner, Admin, Viewer)
- [ ] Shared dashboard — one account, one billing view, multiple engineers with login
- [ ] Per-member activity log: who proxied what, when
- [ ] SSO support (Google Workspace, Okta)

> **Why**: The moment a team has more than one person touching AI code, a single-user dashboard becomes a limitation. Team management is the unlock for B2B sales.

### 2.3 — Automatic Rate Limiting & Budget Enforcement
- [ ] Hard budget caps per feature — requests rejected (with a clear error) once daily/monthly limit is hit
- [ ] Soft limits — allow burst but send immediate Slack/email alert
- [ ] Per-user rate limiting — cap a single end-user's API consumption without touching the application code
- [ ] Emergency kill switch — disable a feature's AI access from the dashboard without a deploy

> **Why**: Alerts tell you after the fact. Limits prevent the fact. This is the difference between a monitoring tool and a control plane.

### 2.4 — Notification Delivery
- [ ] Slack integration (OAuth app, choose channel)
- [ ] Email alerts (configurable recipients, HTML digest)
- [ ] PagerDuty / OpsGenie webhook for critical spend spikes
- [ ] Weekly cost digest — automated Monday morning email with spend summary

> **Why**: An alert that only lives inside a dashboard requires someone to check the dashboard. Slack and email push the alert to where the team already lives.

### 2.5 — Data Access & Export
- [ ] CSV and JSON export for any date range
- [ ] Date range picker on all dashboard views
- [ ] REST API for programmatic access to cost data (for teams that want to pipe data into their own BI stack)

---

## V3 — Intelligence (Q4 2026 – Q1 2027)

**Theme**: Move from *reporting* to *recommendations*. TokenLens should surface insights, not just numbers.

### 3.1 — Model Optimizer
- [ ] Side-by-side model cost comparison: "This feature costs $X/month on GPT-4. On GPT-4o-mini it would cost $Y."
- [ ] Automated downgrade suggestions — if a feature's average response quality (via sampling) doesn't require GPT-4, surface that
- [ ] Prompt efficiency scoring — flag features with high token-to-value ratios (e.g., sending large context windows when smaller would suffice)

> **Why**: The biggest cost lever isn't usage volume — it's model choice. Most teams default to the most capable model because they have no data to justify a cheaper one.

### 3.2 — Anomaly Detection
- [ ] ML-based spend anomaly detection — learn normal patterns per feature and alert on deviations, not just thresholds
- [ ] Automatic incident correlation — if 3 features spike simultaneously, surface that as a single incident, not 3 separate alerts
- [ ] Root cause hints — "This spike matches a deploy by @marcus at 3:42pm"

### 3.3 — Budget Forecasting
- [ ] End-of-month projection based on current burn rate and historical seasonality
- [ ] Feature-level projections: "At current growth, `/chat` will cost $2,400/month by June"
- [ ] Scenario modeling: what happens to cost if DAU grows 2×?

### 3.4 — Self-Hosted Proxy (Enterprise)
- [ ] Docker image for running the TokenLens proxy inside a customer's VPC
- [ ] Data stays on-premise — only aggregate metrics are sent to TokenLens cloud
- [ ] Required for enterprise deals in regulated industries (healthcare, finance, gov)

### 3.5 — Prompt & Context Management (Experimental)
- [ ] Cache layer for identical prompts — avoid redundant API calls at the proxy level
- [ ] Context compression — automatically summarize long conversation histories to reduce token count before forwarding
- [ ] A/B testing for prompts — route a % of traffic to a variant and compare cost + quality

---

## What We're Deliberately Not Doing

_This is a solo side project. Saying no isn't just good product thinking — it's survival._

| Idea | Why I'm Passing |
|---|---|
| Building our own LLM | TokenLens is infrastructure, not a model provider. Scope creep that would take years and a team. |
| Content moderation / safety filters | A different problem requiring different expertise. Dedicated tools (Guardrails, Lakera) exist and I can't out-resource them solo. |
| General APM / error tracking | Datadog and Sentry already own this space. I'd be building a worse version of something that already exists rather than a better version of something that doesn't. |
| Usage-based billing for end-users | That's a full product in itself. My users are developers managing their own AI costs — billing their end-users is their problem to solve. |
| Mobile app | The people who need this are engineers at a desk. A mobile dashboard would cost weeks and get used twice. |

---

## How We Prioritize

Features move up the roadmap when they satisfy at least two of:

1. **Unblocks a paying customer** — someone is willing to pay more, or won't pay at all without it
2. **Expands the addressable market** — team management, SSO, self-hosted proxy each open a new customer segment
3. **Deepens the moat** — anomaly detection and model optimizer are hard to replicate without the data we accumulate

Features stay on the backlog when they're only "nice to have" for existing users.

---

## Contributing

This is an open-source project. If a roadmap item matches a real problem you have, open an issue with your use case — it helps us prioritize. PRs welcome for V2 items with a clear spec.
