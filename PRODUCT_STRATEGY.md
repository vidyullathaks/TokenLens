# TokenLens — Product Strategy

> **Mission**: Give every team building with AI APIs the same cost visibility that Fortune 500 FinOps teams pay six figures to get.

---

## The Problem in One Sentence

OpenAI and Anthropic tell you what you spent. They don't tell you *why*.

---

## Who We're Building For

### Persona 1 — "The CFO Who Hates Surprises"
**Sarah, VP of Engineering at a 30-person SaaS startup**

Sarah's team shipped an AI-powered feature in Q3. In Q4, the cloud bill arrived with an extra $4,800 in OpenAI charges. Nobody knows if it came from the new `/summarize` endpoint, a single enterprise customer hammering the API, or a bug that caused retry loops.

Sarah doesn't want a root-cause post-mortem next quarter. She wants a dashboard she can check every Monday morning and an alert that fires before the problem becomes a budget conversation with the board.

**What she needs**: At-a-glance spend by feature, spend-by-user leaderboard, and threshold alerts that fire via Slack before the month closes.

**What she fears**: Committing to an AI feature roadmap without knowing its cost structure.

---

### Persona 2 — "The Lead Engineer Under Budget"
**Marcus, Senior Backend Engineer at a Series A startup**

Marcus is the one who actually writes the `openai.ChatCompletion.create()` calls. He picked GPT-4 because it was the right tool — but the team is now 60% over its AI budget for the sprint. He has a hunch that the `/code-review` feature is the culprit (it sends the whole file as context every time), but he has no data to prove it.

He needs attribution at the call level so he can profile, optimize, and justify the model downgrade to GPT-3.5 for lower-value features — without it feeling like guesswork.

**What he needs**: Per-feature and per-model cost breakdown, a quick way to compare cost before and after a model swap, and integration that takes under 5 minutes.

**What he fears**: Spending days on instrumentation that should already exist as a product.

---

### Persona 3 — "The Solo Builder Who Can't Afford to Guess"
**Priya, Indie Developer and solo founder**

Priya is building an AI writing tool on nights and weekends. She has a $50/month AI budget. She's not worried about organizational reporting — she's worried about waking up to an email saying she's hit her OpenAI limit at 2am because her caching layer had a bug.

She wants a single number: how much did I spend today, and am I on track for the month?

**What she needs**: A simple daily spend view, an alert she can set and forget, and pricing that doesn't eat her margins.

**What she fears**: The product becoming a complex enterprise tool she has to configure for 3 hours before it's useful.

---

## Why Now

Three forces are converging:

1. **AI API spend is now a real line item.** Companies that moved to "AI-first" features in 2023–2024 are now in cost-optimization mode. FinOps for AI is not a future problem — it's Q1 2026's problem.

2. **Providers don't solve this.** OpenAI and Anthropic have a structural conflict of interest: they benefit from opacity. They will never build first-party attribution tooling that surfaces your most expensive features and suggests cheaper alternatives.

3. **The integration surface is tiny.** One URL swap and three headers is the entire integration cost. There is no SDK to install, no schema migration, no dedicated infrastructure. This removes the biggest objection enterprise tools face: deployment friction.

---

## Our Wedge & Moat

**Wedge**: The proxy model means we can get to production in one line of code. Every other cost-tracking approach requires custom logging, a separate SDK, or changes to every call site.

**Moat** (building toward):
- **Data network effects**: As more teams use TokenLens, our pricing tables and model cost benchmarks become more accurate than any manually-maintained spreadsheet.
- **Switching cost**: Once teams tag their features and users in their codebase, those tags are muscle memory. Switching means re-instrumenting.
- **Alert history**: Our triggered-alert log becomes the team's audit trail for AI cost incidents. That's a compliance artifact, not just a dashboard.

---

## What We Are Not Building

- **A general-purpose observability platform.** We are not Datadog. We will not add APM, error tracking, or log aggregation.
- **A model marketplace.** We surface cost data to inform model choice; we do not host models or negotiate reseller pricing.
- **An AI safety or content moderation tool.** Request content passes through but is never stored.

---

## Success Metrics (V1)

| Metric | Target (90 days post-launch) |
|---|---|
| Activated accounts (≥1 proxied call) | 200 |
| Weekly Active Users | 60% of activated accounts |
| Alert config rate | >50% of activated accounts set ≥1 alert |
| Integration time (p50) | < 5 minutes from signup to first proxied call |
| Churn (monthly) | < 10% |

---

## Pricing Philosophy

TokenLens should be **free where trust is built and paid where value is clear**.

- **Free tier**: 1 API key, up to 10k proxied calls/month, 30-day data retention, 3 alerts.
- **Pro ($29/month)**: Unlimited calls, 90-day retention, Slack/email alerts, CSV export.
- **Team ($99/month)**: Multi-user dashboard, role-based access, SSO, 1-year retention.
- **Enterprise**: Custom retention, dedicated support, self-hosted proxy option, SLA.

The free tier is generous enough that a solo developer never needs to upgrade. The Team tier is priced so that a 3-person startup finds it cheaper than one hour of engineering time spent debugging a surprise bill.
