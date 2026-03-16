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

## Core Requirements (Static)
1. Dashboard with real-time cost breakdown
2. Summary cards: Total Spend, API Calls, Avg Cost/Call, Active Features
3. Cost by Feature bar chart
4. Daily Spend line chart (30 days)
5. Top Users by Cost table
6. Recent API Calls table
7. API Keys management with code snippets (Python/Node.js)
8. Anomaly Alerts configuration

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Recharts
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (Motor async driver)
- **Auth**: Emergent Google OAuth

## What's Been Implemented (March 2026)
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

## Prioritized Backlog

### P0 (Critical - Not Implemented)
- [ ] Actual API proxy to track real OpenAI/Anthropic calls

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
1. Implement actual API proxy for OpenAI/Anthropic
2. Add email notification service integration
3. Add date range picker for filtering dashboard data
4. Implement data export functionality
