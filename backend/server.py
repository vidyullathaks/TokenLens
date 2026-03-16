from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create router with /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Models ====================

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    api_key: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlertConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    alert_id: str = Field(default_factory=lambda: f"alert_{uuid.uuid4().hex[:12]}")
    user_id: str
    alert_type: str  # daily_spend, hourly_spike, single_feature
    threshold: float
    notification_method: str  # email, slack
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AlertConfigCreate(BaseModel):
    alert_type: str
    threshold: float
    notification_method: str
    enabled: bool = True

class AlertHistory(BaseModel):
    model_config = ConfigDict(extra="ignore")
    history_id: str = Field(default_factory=lambda: f"hist_{uuid.uuid4().hex[:12]}")
    user_id: str
    alert_type: str
    message: str
    value: Optional[float] = None
    status: str = "triggered"
    triggered_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== Auth Helpers ====================

async def get_current_user(request: Request) -> User:
    """Extract and validate user from session token"""
    # Check cookie first, then Authorization header
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session_doc = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Get user
    user_doc = await db.users.find_one(
        {"user_id": session_doc["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ==================== Auth Endpoints ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange Emergent session_id for our session"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Exchange with Emergent Auth
    async with httpx.AsyncClient() as client:
        emergent_response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
    
    if emergent_response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    
    auth_data = emergent_response.json()
    email = auth_data.get("email")
    name = auth_data.get("name")
    picture = auth_data.get("picture")
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        # Create new user with API key
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        api_key = f"tl_live_{uuid.uuid4().hex[:24]}"
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "api_key": api_key,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        
        # Seed mock data for new user
        await seed_user_data(user_id)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Get full user data
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {"user": user_doc, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    return {"message": "Logged out"}

# ==================== Dashboard Endpoints ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    """Get dashboard summary statistics"""
    user = await get_current_user(request)
    
    stats = await db.dashboard_stats.find_one(
        {"user_id": user.user_id},
        {"_id": 0}
    )
    
    if not stats:
        # Return default stats
        stats = {
            "total_spend": 284.17,
            "spend_change": 12,
            "api_calls": 14382,
            "calls_change": 8,
            "avg_cost_per_call": 0.0197,
            "active_features": 7
        }
    
    return stats

@api_router.get("/dashboard/cost-by-feature")
async def get_cost_by_feature(request: Request):
    """Get cost breakdown by feature"""
    user = await get_current_user(request)
    
    features = await db.cost_by_feature.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    if not features:
        features = [
            {"feature": "chat-assistant", "cost": 98},
            {"feature": "doc-summarizer", "cost": 74},
            {"feature": "search-enhance", "cost": 51},
            {"feature": "email-draft", "cost": 38},
            {"feature": "code-review", "cost": 23}
        ]
    
    return features

@api_router.get("/dashboard/daily-spend")
async def get_daily_spend(request: Request):
    """Get daily spend for last 30 days"""
    user = await get_current_user(request)
    
    daily_data = await db.daily_spend.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("day", 1).to_list(30)
    
    if not daily_data:
        # Generate realistic mock data
        daily_data = generate_daily_spend_data()
    
    return daily_data

@api_router.get("/dashboard/top-users")
async def get_top_users(request: Request):
    """Get top users by cost"""
    user = await get_current_user(request)
    
    top_users = await db.top_users.find(
        {"owner_id": user.user_id},
        {"_id": 0}
    ).sort("total_cost", -1).to_list(5)
    
    if not top_users:
        top_users = [
            {"user_id": "user_7291", "calls": 1847, "total_cost": 41.20, "avg_cost": 0.0223},
            {"user_id": "user_3842", "calls": 1623, "total_cost": 38.54, "avg_cost": 0.0237},
            {"user_id": "user_9156", "calls": 1402, "total_cost": 31.89, "avg_cost": 0.0227},
            {"user_id": "user_4521", "calls": 1256, "total_cost": 28.47, "avg_cost": 0.0227},
            {"user_id": "user_6834", "calls": 1089, "total_cost": 24.12, "avg_cost": 0.0222}
        ]
    
    return top_users

@api_router.get("/dashboard/recent-calls")
async def get_recent_calls(request: Request):
    """Get recent API calls"""
    user = await get_current_user(request)
    
    recent_calls = await db.api_calls.find(
        {"owner_id": user.user_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(8)
    
    if not recent_calls:
        recent_calls = generate_recent_calls()
    
    return recent_calls

# ==================== API Keys Endpoints ====================

@api_router.get("/api-keys")
async def get_api_key(request: Request):
    """Get user's API key"""
    user = await get_current_user(request)
    
    if not user.api_key:
        # Generate new key
        api_key = f"tl_live_{uuid.uuid4().hex[:24]}"
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"api_key": api_key}}
        )
        return {"api_key": api_key}
    
    return {"api_key": user.api_key}

@api_router.post("/api-keys/regenerate")
async def regenerate_api_key(request: Request):
    """Regenerate user's API key"""
    user = await get_current_user(request)
    
    api_key = f"tl_live_{uuid.uuid4().hex[:24]}"
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"api_key": api_key}}
    )
    
    return {"api_key": api_key}

# ==================== Alerts Endpoints ====================

@api_router.get("/alerts/config")
async def get_alert_configs(request: Request):
    """Get user's alert configurations"""
    user = await get_current_user(request)
    
    configs = await db.alert_configs.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).to_list(100)
    
    if not configs:
        # Return default configs
        configs = [
            {
                "alert_id": "alert_default_1",
                "user_id": user.user_id,
                "alert_type": "daily_spend",
                "threshold": 50.0,
                "notification_method": "email",
                "enabled": True
            },
            {
                "alert_id": "alert_default_2",
                "user_id": user.user_id,
                "alert_type": "hourly_spike",
                "threshold": 200.0,
                "notification_method": "email",
                "enabled": True
            },
            {
                "alert_id": "alert_default_3",
                "user_id": user.user_id,
                "alert_type": "single_feature",
                "threshold": 30.0,
                "notification_method": "slack",
                "enabled": True
            }
        ]
    
    return configs

@api_router.post("/alerts/config")
async def create_or_update_alert(request: Request):
    """Create or update alert configuration"""
    user = await get_current_user(request)
    body = await request.json()
    
    alert_type = body.get("alert_type")
    threshold = body.get("threshold")
    notification_method = body.get("notification_method")
    enabled = body.get("enabled", True)
    
    # Check if alert type exists
    existing = await db.alert_configs.find_one(
        {"user_id": user.user_id, "alert_type": alert_type},
        {"_id": 0}
    )
    
    if existing:
        await db.alert_configs.update_one(
            {"user_id": user.user_id, "alert_type": alert_type},
            {"$set": {
                "threshold": threshold,
                "notification_method": notification_method,
                "enabled": enabled
            }}
        )
        alert_id = existing["alert_id"]
    else:
        alert_id = f"alert_{uuid.uuid4().hex[:12]}"
        await db.alert_configs.insert_one({
            "alert_id": alert_id,
            "user_id": user.user_id,
            "alert_type": alert_type,
            "threshold": threshold,
            "notification_method": notification_method,
            "enabled": enabled,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"alert_id": alert_id, "status": "saved"}

@api_router.get("/alerts/history")
async def get_alert_history(request: Request):
    """Get alert history"""
    user = await get_current_user(request)
    
    history = await db.alert_history.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("triggered_at", -1).to_list(10)
    
    if not history:
        # Return mock history
        now = datetime.now(timezone.utc)
        history = [
            {
                "history_id": "hist_001",
                "alert_type": "single_feature",
                "message": "doc-summarizer exceeded $30/day limit",
                "value": 34.12,
                "status": "triggered",
                "triggered_at": (now - timedelta(days=2)).isoformat()
            },
            {
                "history_id": "hist_002",
                "alert_type": "hourly_spike",
                "message": "Hourly spike: 340% above average",
                "value": None,
                "status": "triggered",
                "triggered_at": (now - timedelta(days=5)).isoformat()
            },
            {
                "history_id": "hist_003",
                "alert_type": "daily_spend",
                "message": "Daily spend exceeded $50 threshold",
                "value": 52.34,
                "status": "triggered",
                "triggered_at": (now - timedelta(days=8)).isoformat()
            },
            {
                "history_id": "hist_004",
                "alert_type": "single_feature",
                "message": "chat-assistant exceeded $30/day limit",
                "value": 31.50,
                "status": "triggered",
                "triggered_at": (now - timedelta(days=12)).isoformat()
            }
        ]
    
    return history

# ==================== Helper Functions ====================

def generate_daily_spend_data():
    """Generate realistic daily spend data for last 30 days"""
    import random
    data = []
    now = datetime.now(timezone.utc)
    
    for i in range(30):
        day = now - timedelta(days=29-i)
        day_of_week = day.weekday()
        
        # Base spend with weekend dips
        if day_of_week in [5, 6]:  # Weekend
            base = random.uniform(5, 8)
        else:
            base = random.uniform(8, 12)
        
        # Peak around days 18-22 (counting from end)
        if 7 <= i <= 11:
            base *= random.uniform(1.3, 1.6)
        
        data.append({
            "day": i + 1,
            "date": day.strftime("%b %d"),
            "spend": round(base, 2)
        })
    
    return data

def generate_recent_calls():
    """Generate mock recent API calls"""
    import random
    
    features = ["chat-assistant", "doc-summarizer", "search-enhance", "email-draft", "code-review"]
    models = ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet"]
    
    calls = []
    now = datetime.now(timezone.utc)
    
    for i in range(8):
        feature = random.choice(features)
        model = random.choice(models)
        tokens = random.randint(500, 8000)
        
        # Calculate cost based on model
        if "gpt-4" in model:
            cost = tokens * 0.00003 + tokens * 0.00006  # Input + output estimate
        elif "claude-3-opus" in model:
            cost = tokens * 0.000015 + tokens * 0.000075
        else:
            cost = tokens * 0.000001 + tokens * 0.000002
        
        timestamp = now - timedelta(minutes=random.randint(5, 300))
        
        calls.append({
            "call_id": f"call_{uuid.uuid4().hex[:8]}",
            "timestamp": timestamp.isoformat(),
            "feature": feature,
            "model": model,
            "tokens": tokens,
            "cost": round(cost, 4)
        })
    
    # Sort by timestamp descending
    calls.sort(key=lambda x: x["timestamp"], reverse=True)
    return calls

async def seed_user_data(user_id: str):
    """Seed mock data for a new user"""
    import random
    
    # Seed dashboard stats
    await db.dashboard_stats.insert_one({
        "user_id": user_id,
        "total_spend": 284.17,
        "spend_change": 12,
        "api_calls": 14382,
        "calls_change": 8,
        "avg_cost_per_call": 0.0197,
        "active_features": 7
    })
    
    # Seed cost by feature
    features = [
        {"user_id": user_id, "feature": "chat-assistant", "cost": 98},
        {"user_id": user_id, "feature": "doc-summarizer", "cost": 74},
        {"user_id": user_id, "feature": "search-enhance", "cost": 51},
        {"user_id": user_id, "feature": "email-draft", "cost": 38},
        {"user_id": user_id, "feature": "code-review", "cost": 23}
    ]
    await db.cost_by_feature.insert_many(features)
    
    # Seed daily spend
    daily_data = generate_daily_spend_data()
    for d in daily_data:
        d["user_id"] = user_id
    await db.daily_spend.insert_many(daily_data)
    
    # Seed top users
    top_users = [
        {"owner_id": user_id, "user_id": "user_7291", "calls": 1847, "total_cost": 41.20, "avg_cost": 0.0223},
        {"owner_id": user_id, "user_id": "user_3842", "calls": 1623, "total_cost": 38.54, "avg_cost": 0.0237},
        {"owner_id": user_id, "user_id": "user_9156", "calls": 1402, "total_cost": 31.89, "avg_cost": 0.0227},
        {"owner_id": user_id, "user_id": "user_4521", "calls": 1256, "total_cost": 28.47, "avg_cost": 0.0227},
        {"owner_id": user_id, "user_id": "user_6834", "calls": 1089, "total_cost": 24.12, "avg_cost": 0.0222}
    ]
    await db.top_users.insert_many(top_users)
    
    # Seed recent API calls
    recent_calls = generate_recent_calls()
    for call in recent_calls:
        call["owner_id"] = user_id
    await db.api_calls.insert_many(recent_calls)
    
    # Seed default alert configs
    alerts = [
        {
            "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "alert_type": "daily_spend",
            "threshold": 50.0,
            "notification_method": "email",
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "alert_type": "hourly_spike",
            "threshold": 200.0,
            "notification_method": "email",
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "alert_type": "single_feature",
            "threshold": 30.0,
            "notification_method": "slack",
            "enabled": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.alert_configs.insert_many(alerts)
    
    # Seed alert history
    now = datetime.now(timezone.utc)
    history = [
        {
            "history_id": f"hist_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "alert_type": "single_feature",
            "message": "doc-summarizer exceeded $30/day limit",
            "value": 34.12,
            "status": "triggered",
            "triggered_at": (now - timedelta(days=2)).isoformat()
        },
        {
            "history_id": f"hist_{uuid.uuid4().hex[:8]}",
            "user_id": user_id,
            "alert_type": "hourly_spike",
            "message": "Hourly spike: 340% above average",
            "value": None,
            "status": "triggered",
            "triggered_at": (now - timedelta(days=5)).isoformat()
        }
    ]
    await db.alert_history.insert_many(history)

# ==================== Health Check ====================

@api_router.get("/")
async def root():
    return {"message": "TokenLens API", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
