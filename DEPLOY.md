# TokenLens — Free Deployment Guide

Stack: React (Vercel) + FastAPI (Render) + MongoDB (Atlas)
All tiers are free. No credit card required for basic usage.

---

## Step 1 — MongoDB Atlas (database)

1. Go to https://cloud.mongodb.com → Create a free account
2. Create a **Free (M0)** cluster (512MB, plenty for this app)
3. Under **Database Access**: create a user with a password → note it down
4. Under **Network Access**: Add IP `0.0.0.0/0` (allow all — needed for Render)
5. Click **Connect** → **Compass / Drivers** → copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
   ```

---

## Step 2 — Render (backend API)

1. Go to https://render.com → sign up with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub repo (push this code first)
4. Set:
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free
5. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `MONGO_URL` | your Atlas connection string |
   | `DB_NAME` | `tokenlens` |
   | `ENCRYPTION_SECRET` | any random string (e.g. generate with `openssl rand -hex 32`) |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` (fill in after step 3) |

6. Deploy → copy your Render URL: `https://tokenlens-api.onrender.com`

> **Note**: Free Render instances sleep after 15 min of inactivity. First request after sleep takes ~30s.

---

## Step 3 — Vercel (frontend)

1. Go to https://vercel.com → sign up with GitHub
2. Click **Add New** → **Project** → import your repo
3. Set:
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `build` (auto-detected)
4. Add **Environment Variable**:
   | Key | Value |
   |-----|-------|
   | `REACT_APP_BACKEND_URL` | your Render URL from step 2 |
5. Deploy → your app is live at `https://your-app.vercel.app`

---

## Step 4 — Update CORS on Render

After Vercel gives you a URL:
1. Go to Render → your service → Environment
2. Update `CORS_ORIGINS` to your Vercel URL
3. Redeploy

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env   # fill in your values
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
# Set REACT_APP_BACKEND_URL=http://localhost:8000
npm install
npm start
```
