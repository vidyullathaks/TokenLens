# TokenLens - AI API Cost Intelligence Dashboard

## Original Problem Statement
Build a web app called TokenLens — an AI API cost intelligence dashboard for small dev teams. The core problem it solves: developers using OpenAI or Anthropic APIs get surprise bills with no visibility into *which feature* or *which user* is spending the most. TokenLens is the missing attribution layer.

## User Personas
- **Primary**: Small dev teams (2-10 developers) using AI APIs
- **Secondary**: DevOps/FinOps engineers tracking cloud costs
- **Tertiary**: Solo developers monitoring personal AI projects

## User Choices Made
- Authentication: Google social login (Emergent OAuth)
- Data Storage: MongoDB
- Design: Top navigation bar with dark navy header
- Charts: Recharts library
- Provider Management: Users bring their own API keys

## Core Requirements (Static)
1. Dashboard with real-time cost breakdown
2. Summary cards: Total Spend, API Calls, Avg Cost/Call, Active Features
3. Cost by Feature bar chart
4. Daily Spend line chart (30 days)
5. Top Users by Cost table
6. Recent API Calls table
7. API Keys management with code snippets (Python/Node.js)
8. Anomaly Alerts configuration
9. Settings page for managing AI provider connections

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth
- **Encryption**: Fernet for API key storage

## What's Been Implemented (March 2026)
### Phase 1 - MVP
- [x] Google OAuth authentication flow
- [x] Dashboard with 4 summary stat cards
- [x] Cost by Feature horizontal bar chart
- [x] Daily Spend line chart (30 days)
- [x] Top Users by Cost table (5 users)
- [x] Recent API Calls table (8 calls)
- [x] API Keys page with masked key + reveal/copy
- [x] Integration code snippets (Python/Node.js tabs)
- [x] Alerts configuration page (3 alert types)
- [x] Alert History table with mock data
- [x] Responsive top navigation
- [x] User dropdown menu
- [x] Mock data seeding for new users

### Phase 2 - Provider Management
- [x] Settings page with provider management
- [x] Support for 5 AI providers (Anthropic, OpenAI, Google, Cohere, Mistral)
- [x] Step-by-step instructions for getting API keys
- [x] Encrypted API key storage (Fernet)
- [x] API proxy endpoints for Anthropic and OpenAI
- [x] Real-time cost tracking through proxy
- [x] Dashboard shows real vs demo data based on provider status
- [x] Setup prompt when no providers connected

## API Proxy Endpoints
- POST /api/proxy/anthropic/v1/messages - Proxy to Anthropic with cost tracking
- POST /api/proxy/openai/v1/chat/completions - Proxy to OpenAI with cost tracking

## Prioritized Backlog

### P0 (Critical - Not Implemented)
- [ ] Add more proxy endpoints (Google, Cohere, Mistral)
- [ ] Streaming support for proxy endpoints

### P1 (High Priority)
- [ ] Email/Slack notification delivery for alerts
- [ ] Data export (CSV/JSON)
- [ ] Date range filters for dashboard

### P2 (Medium Priority)
- [ ] Team management (invite members)
- [ ] Model-level cost breakdown
- [ ] Custom feature tags management
- [ ] Historical data retention settings

### P3 (Nice to Have)
- [ ] Dark mode toggle
- [ ] Budget forecasting
- [ ] Cost anomaly ML detection
- [ ] API usage recommendations

## Next Tasks
1. Add proxy endpoints for Google Gemini, Cohere, and Mistral
2. Implement streaming support for chat completions
3. Add email notification service integration
4. Add date range picker for filtering dashboard data
