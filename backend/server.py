from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import base64
from cryptography.fernet import Fernet
import hashlib
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'tokenlens')]

# Encryption key for API keys (generate a consistent key from a secret)
ENCRYPTION_SECRET = os.environ.get('ENCRYPTION_SECRET')
if not ENCRYPTION_SECRET:
    raise RuntimeError("ENCRYPTION_SECRET environment variable is required but not set.")
# Create a 32-byte key from the secret
key_bytes = hashlib.sha256(ENCRYPTION_SECRET.encode()).digest()
FERNET_KEY = base64.urlsafe_b64encode(key_bytes)
fernet = Fernet(FERNET_KEY)

def encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key for storage"""
    return fernet.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt an API key for use"""
    return fernet.decrypt(encrypted_key.encode()).decode()

def mask_api_key(api_key: str) -> str:
    """Create a masked version of the API key for display"""
    if len(api_key) <= 12:
        return api_key[:4] + '••••' + api_key[-4:]
    return api_key[:8] + '••••••••' + api_key[-4:]

# Provider pricing (cost per 1K tokens)
PROVIDER_PRICING = {
    'anthropic': {
        'claude-3-opus-20240229': {'input': 0.015, 'output': 0.075},
        'claude-3-sonnet-20240229': {'input': 0.003, 'output': 0.015},
        'claude-3-haiku-20240307': {'input': 0.00025, 'output': 0.00125},
        'claude-3-5-sonnet-20241022': {'input': 0.003, 'output': 0.015},
        'default': {'input': 0.003, 'output': 0.015}
    },
    'openai': {
        'gpt-4': {'input': 0.03, 'output': 0.06},
        'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
        'gpt-4-turbo-preview': {'input': 0.01, 'output': 0.03},
        'gpt-3.5-turbo': {'input': 0.0005, 'output': 0.0015},
        'gpt-4o': {'input': 0.005, 'output': 0.015},
        'gpt-4o-mini': {'input': 0.00015, 'output': 0.0006},
        'default': {'input': 0.01, 'output': 0.03}
    },
    'google': {
        'gemini-pro': {'input': 0.00025, 'output': 0.0005},
        'gemini-1.5-pro': {'input': 0.00125, 'output': 0.005},
        'gemini-1.5-flash': {'input': 0.000075, 'output': 0.0003},
        'gemini-2.0-flash': {'input': 0.0001, 'output': 0.0004},
        'gemini-2.0-flash-lite': {'input': 0.000075, 'output': 0.0003},
        'default': {'input': 0.0001, 'output': 0.0004}
    },
    'cohere': {
        'command': {'input': 0.001, 'output': 0.002},
        'command-light': {'input': 0.0003, 'output': 0.0006},
        'default': {'input': 0.001, 'output': 0.002}
    },
    'mistral': {
        'mistral-large': {'input': 0.004, 'output': 0.012},
        'mistral-medium': {'input': 0.0027, 'output': 0.0081},
        'mistral-small': {'input': 0.001, 'output': 0.003},
        'default': {'input': 0.001, 'output': 0.003}
    }
}

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
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

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

@api_router.post("/auth/register")
async def register(body: UserRegister):
    """Register a new user with email and password"""
    email = body.email.lower().strip()

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    api_key = f"tl_live_{uuid.uuid4().hex[:24]}"

    new_user = {
        "user_id": user_id,
        "email": email,
        "name": body.name,
        "picture": None,
        "api_key": api_key,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(new_user)
    await seed_user_data(user_id)

    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"user": user_doc, "session_token": session_token}

@api_router.post("/auth/login")
async def login(body: UserLogin):
    """Login with email and password"""
    email = body.email.lower().strip()

    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc or not user_doc.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not bcrypt.checkpw(body.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })

    safe_user = {k: v for k, v in user_doc.items() if k != "password_hash"}
    return {"user": safe_user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current authenticated user"""
    user = await get_current_user(request)
    data = user.model_dump()
    data.pop("password_hash", None)
    return data

@api_router.post("/auth/logout")
async def logout(request: Request):
    """Logout and invalidate session"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
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

@api_router.get("/settings/profile")
async def get_user_profile(request: Request):
    """Get current user's profile"""
    user = await get_current_user(request)
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": getattr(user, "name", None),
        "created_at": getattr(user, "created_at", None),
    }

# ==================== Settings/Provider Endpoints ====================

@api_router.get("/settings/providers")
async def get_connected_providers(request: Request):
    """Get user's connected AI providers"""
    user = await get_current_user(request)
    
    providers = await db.user_providers.find(
        {"user_id": user.user_id},
        {"_id": 0, "encrypted_key": 0}  # Don't return the actual encrypted key
    ).to_list(100)
    
    return providers

@api_router.post("/settings/providers")
async def add_provider(request: Request):
    """Add or update an AI provider connection"""
    user = await get_current_user(request)
    body = await request.json()
    
    provider_id = body.get("provider_id")
    api_key = body.get("api_key")
    
    if not provider_id or not api_key:
        raise HTTPException(status_code=400, detail="provider_id and api_key are required")
    
    # Validate provider_id
    valid_providers = ['anthropic', 'openai', 'google', 'cohere', 'mistral']
    if provider_id not in valid_providers:
        raise HTTPException(status_code=400, detail=f"Invalid provider. Must be one of: {valid_providers}")
    
    # Validate API key format (basic check)
    if len(api_key) < 10:
        raise HTTPException(status_code=400, detail="Invalid API key format")
    
    # Validate API key by making a test request to the provider
    validation_error = await validate_provider_api_key(provider_id, api_key)
    if validation_error:
        raise HTTPException(status_code=400, detail=validation_error)
    
    # Encrypt the API key
    encrypted_key = encrypt_api_key(api_key)
    masked_key = mask_api_key(api_key)
    
    # Check if provider already exists for user
    existing = await db.user_providers.find_one(
        {"user_id": user.user_id, "provider_id": provider_id}
    )
    
    if existing:
        # Update existing provider
        await db.user_providers.update_one(
            {"user_id": user.user_id, "provider_id": provider_id},
            {"$set": {
                "encrypted_key": encrypted_key,
                "masked_key": masked_key,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        # Add new provider
        await db.user_providers.insert_one({
            "user_id": user.user_id,
            "provider_id": provider_id,
            "encrypted_key": encrypted_key,
            "masked_key": masked_key,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"status": "connected", "provider_id": provider_id}

async def validate_provider_api_key(provider_id: str, api_key: str) -> Optional[str]:
    """Validate API key by making a minimal test request to the provider.
    Returns error message if invalid, None if valid."""
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if provider_id == "anthropic":
                # Test Anthropic key with a minimal request
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "Hi"}]
                    }
                )
                if response.status_code == 401:
                    return "Invalid Anthropic API key. Please check your key and try again."
                elif response.status_code == 403:
                    return "Anthropic API key doesn't have permission. Please check your account."
                # 400 with credit balance error means the key IS valid, just no credits
                elif response.status_code == 400:
                    error_data = response.json()
                    error_msg = error_data.get('error', {}).get('message', '')
                    if 'credit balance' in error_msg.lower():
                        # Key is valid but low on credits - allow it
                        return None
                    return f"Anthropic API error: {error_msg}"
                elif response.status_code >= 400 and response.status_code != 429:
                    error_data = response.json()
                    return f"Anthropic API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
                    
            elif provider_id == "openai":
                # Test OpenAI key with models endpoint (doesn't cost anything)
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                if response.status_code == 401:
                    return "Invalid OpenAI API key. Please check your key and try again."
                elif response.status_code == 403:
                    return "OpenAI API key doesn't have permission. Please check your account."
                elif response.status_code >= 400:
                    error_data = response.json()
                    return f"OpenAI API error: {error_data.get('error', {}).get('message', 'Unknown error')}"
                    
            elif provider_id == "google":
                # Validate key by listing models — no generation quota consumed
                response = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                )
                if response.status_code == 400:
                    error_data = response.json()
                    if "API_KEY_INVALID" in str(error_data):
                        return "Invalid Google AI API key. Please check your key and try again."
                    return f"Google AI API error: {error_data.get('error', {}).get('message', 'Bad request')}"
                elif response.status_code == 403:
                    return "Google AI API key doesn't have permission. Please enable the Generative Language API in your Google Cloud project."
                elif response.status_code >= 400:
                    return f"Google AI API error: {response.status_code}"
                    
            elif provider_id == "cohere":
                # Test Cohere key
                response = await client.get(
                    "https://api.cohere.ai/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                if response.status_code == 401:
                    return "Invalid Cohere API key. Please check your key and try again."
                elif response.status_code >= 400:
                    return f"Cohere API error: {response.status_code}"
                    
            elif provider_id == "mistral":
                # Test Mistral key
                response = await client.get(
                    "https://api.mistral.ai/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                if response.status_code == 401:
                    return "Invalid Mistral API key. Please check your key and try again."
                elif response.status_code >= 400:
                    return f"Mistral API error: {response.status_code}"
            
            return None  # Key is valid
            
        except httpx.TimeoutException:
            return "Connection timeout while validating API key. Please try again."
        except httpx.HTTPError as e:
            logger.error(f"HTTP error validating {provider_id} key: {e}")
            return f"Network error while validating API key: {str(e)}"
        except Exception as e:
            logger.error(f"Error validating {provider_id} key: {e}")
            return f"Error validating API key: {str(e)}"

@api_router.delete("/settings/providers/{provider_id}")
async def remove_provider(request: Request, provider_id: str):
    """Remove an AI provider connection"""
    user = await get_current_user(request)
    
    result = await db.user_providers.delete_one({
        "user_id": user.user_id,
        "provider_id": provider_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    return {"status": "disconnected", "provider_id": provider_id}

@api_router.post("/settings/providers/{provider_id}/test")
async def test_provider_connection(request: Request, provider_id: str):
    """Test a provider connection by making a minimal API call"""
    user = await get_current_user(request)
    
    # Get user's API key for this provider
    provider = await db.user_providers.find_one(
        {"user_id": user.user_id, "provider_id": provider_id},
        {"_id": 0}
    )
    
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not connected")
    
    api_key = decrypt_api_key(provider["encrypted_key"])
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if provider_id == "anthropic":
                response = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "Say 'TokenLens test successful' in 5 words or less"}]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    usage = data.get("usage", {})
                    input_tokens = usage.get("input_tokens", 0)
                    output_tokens = usage.get("output_tokens", 0)
                    cost = calculate_cost("anthropic", "claude-3-haiku-20240307", input_tokens, output_tokens)
                    
                    # Log this test call
                    await log_api_call(
                        user_id=user.user_id,
                        provider_id="anthropic",
                        model="claude-3-haiku-20240307",
                        feature="connection-test",
                        end_user="system",
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        cost=cost
                    )
                    
                    content = data.get("content", [{}])[0].get("text", "")
                    return {
                        "success": True,
                        "message": content,
                        "tokens": input_tokens + output_tokens,
                        "cost": cost
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    if "credit balance" in error_msg.lower():
                        return {
                            "success": True,
                            "message": "API key is valid and connected! Note: your Anthropic API account has no prepaid credits yet — add some at console.anthropic.com/billing to start making calls. (Claude.ai Pro subscriptions don't include API credits.)",
                            "tokens": 0,
                            "cost": 0
                        }
                    return {"success": False, "error": error_msg}
                    
            elif provider_id == "openai":
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "gpt-3.5-turbo",
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "Say 'TokenLens test successful' in 5 words or less"}]
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    usage = data.get("usage", {})
                    input_tokens = usage.get("prompt_tokens", 0)
                    output_tokens = usage.get("completion_tokens", 0)
                    cost = calculate_cost("openai", "gpt-3.5-turbo", input_tokens, output_tokens)
                    
                    await log_api_call(
                        user_id=user.user_id,
                        provider_id="openai",
                        model="gpt-3.5-turbo",
                        feature="connection-test",
                        end_user="system",
                        input_tokens=input_tokens,
                        output_tokens=output_tokens,
                        cost=cost
                    )
                    
                    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    return {
                        "success": True,
                        "message": content,
                        "tokens": input_tokens + output_tokens,
                        "cost": cost
                    }
                else:
                    error_data = response.json()
                    error_msg = error_data.get("error", {}).get("message", "Unknown error")
                    if "quota" in error_msg.lower() or "exceeded" in error_msg.lower() or "billing" in error_msg.lower():
                        return {
                            "success": True,
                            "message": "API key is valid and connected! Note: your OpenAI API account has no prepaid credits. ChatGPT Plus subscriptions don't include API credits — add credits at platform.openai.com/settings/billing.",
                            "tokens": 0,
                            "cost": 0
                        }
                    return {"success": False, "error": error_msg}

            elif provider_id == "google":
                response = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={api_key}",
                    json={
                        "contents": [{"parts": [{"text": "Say 'TokenLens test successful' in 5 words or less"}]}],
                        "generationConfig": {"maxOutputTokens": 10}
                    }
                )

                if response.status_code == 200:
                    data = response.json()
                    content = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    estimated_tokens = len(content.split()) * 2
                    cost = calculate_cost("google", "gemini-2.0-flash", 10, estimated_tokens)

                    await log_api_call(
                        user_id=user.user_id,
                        provider_id="google",
                        model="gemini-2.0-flash",
                        feature="connection-test",
                        end_user="system",
                        input_tokens=10,
                        output_tokens=estimated_tokens,
                        cost=cost
                    )

                    return {
                        "success": True,
                        "message": content,
                        "tokens": estimated_tokens,
                        "cost": cost
                    }
                else:
                    try:
                        error_data = response.json()
                        error_msg = error_data.get("error", {}).get("message", f"Google AI error: {response.status_code}")
                    except Exception:
                        error_msg = f"Google AI error: {response.status_code}"

                    # Quota errors mean the key is valid but billing isn't set up
                    if response.status_code == 429 or "quota" in error_msg.lower() or "RESOURCE_EXHAUSTED" in str(error_data):
                        return {
                            "success": True,
                            "message": "API key is valid and connected! Note: your Google AI account has no billing set up — add billing at console.cloud.google.com to make live calls.",
                            "tokens": 0,
                            "cost": 0
                        }
                    return {"success": False, "error": error_msg}
            
            else:
                return {"success": False, "error": f"Test not implemented for {provider_id}"}
                
        except httpx.TimeoutException:
            return {"success": False, "error": "Request timed out"}
        except Exception as e:
            logger.error(f"Test connection error: {e}")
            return {"success": False, "error": str(e)}

# ==================== Proxy Endpoints ====================

async def get_user_provider_key(user_id: str, provider_id: str) -> Optional[str]:
    """Get decrypted API key for a user's provider"""
    provider = await db.user_providers.find_one(
        {"user_id": user_id, "provider_id": provider_id},
        {"_id": 0}
    )
    
    if not provider:
        return None
    
    return decrypt_api_key(provider["encrypted_key"])

def calculate_cost(provider_id: str, model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost based on provider pricing"""
    pricing = PROVIDER_PRICING.get(provider_id, {})
    model_pricing = pricing.get(model, pricing.get('default', {'input': 0.001, 'output': 0.002}))
    
    input_cost = (input_tokens / 1000) * model_pricing['input']
    output_cost = (output_tokens / 1000) * model_pricing['output']
    
    return round(input_cost + output_cost, 6)

async def log_api_call(user_id: str, provider_id: str, model: str, feature: str, 
                       end_user: str, input_tokens: int, output_tokens: int, cost: float):
    """Log an API call for tracking"""
    call_record = {
        "call_id": f"call_{uuid.uuid4().hex[:12]}",
        "owner_id": user_id,
        "provider_id": provider_id,
        "model": model,
        "feature": feature or "default",
        "end_user": end_user or "anonymous",
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost": cost,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.api_calls.insert_one(call_record)
    
    # Update aggregated stats
    await update_user_stats(user_id, provider_id, model, feature, cost, input_tokens + output_tokens)

async def update_user_stats(user_id: str, provider_id: str, model: str, feature: str, cost: float, tokens: int):
    """Update user's aggregated statistics"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Update or create daily stats
    await db.daily_stats.update_one(
        {"user_id": user_id, "date": today},
        {
            "$inc": {"total_cost": cost, "total_calls": 1, "total_tokens": tokens},
            "$setOnInsert": {"user_id": user_id, "date": today}
        },
        upsert=True
    )
    
    # Update feature stats
    await db.feature_stats.update_one(
        {"user_id": user_id, "feature": feature},
        {
            "$inc": {"total_cost": cost, "total_calls": 1},
            "$setOnInsert": {"user_id": user_id, "feature": feature}
        },
        upsert=True
    )
    
    # Update provider stats
    await db.provider_stats.update_one(
        {"user_id": user_id, "provider_id": provider_id},
        {
            "$inc": {"total_cost": cost, "total_calls": 1},
            "$setOnInsert": {"user_id": user_id, "provider_id": provider_id}
        },
        upsert=True
    )

@api_router.post("/proxy/anthropic/v1/messages")
async def proxy_anthropic(request: Request):
    """Proxy requests to Anthropic API and track usage"""
    # Get TokenLens headers
    tl_key = request.headers.get("X-TL-Key")
    tl_feature = request.headers.get("X-TL-Feature", "default")
    tl_user = request.headers.get("X-TL-User", "anonymous")
    
    # Authenticate via TL key or session
    user = None
    if tl_key:
        # Find user by API key
        user_doc = await db.users.find_one({"api_key": tl_key}, {"_id": 0})
        if user_doc:
            user = User(**user_doc)
    
    if not user:
        # Try session auth
        try:
            user = await get_current_user(request)
        except HTTPException:
            raise HTTPException(status_code=401, detail="Invalid TokenLens API key or session")
    
    # Get user's Anthropic API key
    anthropic_key = await get_user_provider_key(user.user_id, "anthropic")
    if not anthropic_key:
        raise HTTPException(status_code=400, detail="Anthropic provider not connected. Add your API key in Settings.")
    
    # Get request body
    body = await request.json()
    model = body.get("model", "claude-3-sonnet-20240229")
    
    # Forward to Anthropic
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": anthropic_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json=body,
                timeout=120.0
            )
            
            response_data = response.json()
            
            # Extract token usage
            usage = response_data.get("usage", {})
            input_tokens = usage.get("input_tokens", 0)
            output_tokens = usage.get("output_tokens", 0)
            
            # Calculate cost
            cost = calculate_cost("anthropic", model, input_tokens, output_tokens)
            
            # Log the call
            await log_api_call(
                user_id=user.user_id,
                provider_id="anthropic",
                model=model,
                feature=tl_feature,
                end_user=tl_user,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost
            )
            
            # Add cost info to response
            response_data["_tokenlens"] = {
                "cost": cost,
                "feature": tl_feature,
                "user": tl_user
            }
            
            return JSONResponse(content=response_data, status_code=response.status_code)
            
        except httpx.HTTPError as e:
            logger.error(f"Anthropic API error: {e}")
            raise HTTPException(status_code=502, detail=f"Anthropic API error: {str(e)}")

@api_router.post("/proxy/openai/v1/chat/completions")
async def proxy_openai(request: Request):
    """Proxy requests to OpenAI API and track usage"""
    # Get TokenLens headers
    tl_key = request.headers.get("X-TL-Key")
    tl_feature = request.headers.get("X-TL-Feature", "default")
    tl_user = request.headers.get("X-TL-User", "anonymous")
    
    # Authenticate via TL key or session
    user = None
    if tl_key:
        user_doc = await db.users.find_one({"api_key": tl_key}, {"_id": 0})
        if user_doc:
            user = User(**user_doc)
    
    if not user:
        try:
            user = await get_current_user(request)
        except HTTPException:
            raise HTTPException(status_code=401, detail="Invalid TokenLens API key or session")
    
    # Get user's OpenAI API key
    openai_key = await get_user_provider_key(user.user_id, "openai")
    if not openai_key:
        raise HTTPException(status_code=400, detail="OpenAI provider not connected. Add your API key in Settings.")
    
    body = await request.json()
    model = body.get("model", "gpt-4")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json"
                },
                json=body,
                timeout=120.0
            )
            
            response_data = response.json()
            
            usage = response_data.get("usage", {})
            input_tokens = usage.get("prompt_tokens", 0)
            output_tokens = usage.get("completion_tokens", 0)
            
            cost = calculate_cost("openai", model, input_tokens, output_tokens)
            
            await log_api_call(
                user_id=user.user_id,
                provider_id="openai",
                model=model,
                feature=tl_feature,
                end_user=tl_user,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                cost=cost
            )
            
            response_data["_tokenlens"] = {
                "cost": cost,
                "feature": tl_feature,
                "user": tl_user
            }
            
            return JSONResponse(content=response_data, status_code=response.status_code)
            
        except httpx.HTTPError as e:
            logger.error(f"OpenAI API error: {e}")
            raise HTTPException(status_code=502, detail=f"OpenAI API error: {str(e)}")

# ==================== Real Dashboard Data ====================

@api_router.get("/dashboard/real-stats")
async def get_real_dashboard_stats(request: Request):
    """Get real dashboard statistics from tracked API calls"""
    user = await get_current_user(request)
    
    # Get connected providers (informational only — does not gate data)
    providers = await db.user_providers.find(
        {"user_id": user.user_id},
        {"_id": 0, "provider_id": 1}
    ).to_list(100)

    # Get this month's stats
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Aggregate stats from api_calls (works with demo data too, no provider gate)
    pipeline = [
        {
            "$match": {
                "owner_id": user.user_id,
                "timestamp": {"$gte": start_of_month.isoformat()}
            }
        },
        {
            "$group": {
                "_id": None,
                "total_spend": {"$sum": "$cost"},
                "api_calls": {"$sum": 1},
                "total_tokens": {"$sum": "$total_tokens"}
            }
        }
    ]
    
    result = await db.api_calls.aggregate(pipeline).to_list(1)
    
    # Check demo data regardless of month filter (covers all-time demo calls)
    demo_count = await db.api_calls.count_documents(demo_call_filter(user.user_id))

    if not result:
        return {
            "has_data": demo_count > 0,
            "total_spend": 0,
            "spend_change": 0,
            "api_calls": 0,
            "calls_change": 0,
            "avg_cost_per_call": 0,
            "active_features": 0,
            "connected_providers": [p["provider_id"] for p in providers],
            "has_demo_data": demo_count > 0,
        }

    stats = result[0]
    total_spend = stats.get("total_spend", 0)
    api_calls = stats.get("api_calls", 0)

    # Get unique features count
    features = await db.api_calls.distinct("feature", {"owner_id": user.user_id})

    return {
        "has_data": True,
        "total_spend": round(total_spend, 2),
        "spend_change": 0,  # Would need last month data to calculate
        "api_calls": api_calls,
        "calls_change": 0,
        "avg_cost_per_call": round(total_spend / api_calls, 4) if api_calls > 0 else 0,
        "active_features": len(features),
        "connected_providers": [p["provider_id"] for p in providers],
        "has_demo_data": demo_count > 0,
    }

@api_router.get("/dashboard/real-cost-by-feature")
async def get_real_cost_by_feature(request: Request):
    """Get real cost breakdown by feature"""
    user = await get_current_user(request)
    
    pipeline = [
        {"$match": {"owner_id": user.user_id}},
        {
            "$group": {
                "_id": "$feature",
                "cost": {"$sum": "$cost"},
                "calls": {"$sum": 1}
            }
        },
        {"$sort": {"cost": -1}},
        {"$limit": 10}
    ]
    
    results = await db.api_calls.aggregate(pipeline).to_list(10)
    
    return [{"feature": r["_id"], "cost": round(r["cost"], 2), "calls": r["calls"]} for r in results]

@api_router.get("/dashboard/real-cost-by-provider")
async def get_real_cost_by_provider(request: Request):
    """Get real cost breakdown by provider"""
    user = await get_current_user(request)
    
    pipeline = [
        {"$match": {"owner_id": user.user_id}},
        {
            "$group": {
                "_id": "$provider_id",
                "cost": {"$sum": "$cost"},
                "calls": {"$sum": 1}
            }
        },
        {"$sort": {"cost": -1}}
    ]
    
    results = await db.api_calls.aggregate(pipeline).to_list(10)
    
    return [{"provider": r["_id"], "cost": round(r["cost"], 2), "calls": r["calls"]} for r in results]

@api_router.get("/dashboard/real-recent-calls")
async def get_real_recent_calls(request: Request):
    """Get real recent API calls"""
    user = await get_current_user(request)

    calls = await db.api_calls.find(
        {"owner_id": user.user_id},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(20)

    return calls

@api_router.get("/dashboard/real-daily-spend")
async def get_real_daily_spend(request: Request):
    """Get daily spend for last 30 days aggregated from api_calls"""
    user = await get_current_user(request)

    now = datetime.now(timezone.utc)
    since = now - timedelta(days=30)

    pipeline = [
        {"$match": {"owner_id": user.user_id, "timestamp": {"$gte": since.isoformat()}}},
        {"$addFields": {"date_str": {"$substr": ["$timestamp", 0, 10]}}},
        {"$group": {"_id": "$date_str", "spend": {"$sum": "$cost"}}},
        {"$sort": {"_id": 1}},
    ]
    results = await db.api_calls.aggregate(pipeline).to_list(None)
    spend_by_date = {r["_id"]: r["spend"] for r in results}

    data = []
    for i in range(30):
        day = now - timedelta(days=29 - i)
        date_key = day.strftime("%Y-%m-%d")
        data.append({
            "day": i + 1,
            "date": day.strftime("%b %d"),
            "spend": round(spend_by_date.get(date_key, 0), 4),
        })
    return data

@api_router.get("/dashboard/real-top-users")
async def get_real_top_users(request: Request):
    """Get top end-users by cost aggregated from api_calls"""
    user = await get_current_user(request)

    pipeline = [
        {"$match": {"owner_id": user.user_id, "end_user": {"$exists": True, "$ne": None}}},
        {
            "$group": {
                "_id": "$end_user",
                "calls": {"$sum": 1},
                "total_cost": {"$sum": "$cost"},
            }
        },
        {"$sort": {"total_cost": -1}},
        {"$limit": 5},
    ]
    results = await db.api_calls.aggregate(pipeline).to_list(None)
    return [
        {
            "user_id": r["_id"],
            "calls": r["calls"],
            "total_cost": round(r["total_cost"], 4),
            "avg_cost": round(r["total_cost"] / r["calls"], 4) if r["calls"] > 0 else 0,
        }
        for r in results
    ]

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
    """Seed default configs for a new user (NO mock data)"""
    
    # Only seed default alert configs - no fake data
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

# ==================== Demo Data ====================

@api_router.post("/dashboard/seed-demo")
async def seed_demo_data(request: Request):
    """Populate dashboard with realistic demo data for portfolio/testing"""
    user = await get_current_user(request)

    import random

    providers = ["anthropic", "openai", "google"]
    models = {
        "anthropic": ["claude-3-haiku-20240307", "claude-3-sonnet-20240229", "claude-3-opus-20240229"],
        "openai": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"],
        "google": ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro"],
    }
    features = ["chat-assistant", "code-review", "summarization", "data-extraction", "content-generation"]
    end_users = ["user_001", "user_002", "user_003", "user_004", "user_005"]

    now = datetime.now(timezone.utc)
    calls = []
    for i in range(120):
        provider = random.choice(providers)
        model = random.choice(models[provider])
        input_tokens = random.randint(100, 2000)
        output_tokens = random.randint(50, 800)
        cost = calculate_cost(provider, model, input_tokens, output_tokens)
        days_ago = random.randint(0, 29)
        hours_ago = random.randint(0, 23)
        ts = now - timedelta(days=days_ago, hours=hours_ago, minutes=random.randint(0, 59))
        calls.append({
            "call_id": f"call_{uuid.uuid4().hex[:16]}",
            "owner_id": user.user_id,
            "provider_id": provider,
            "model": model,
            "feature": random.choice(features),
            "end_user": random.choice(end_users),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "cost": cost,
            "timestamp": ts.isoformat(),
            "status": "success",
            "is_demo": True,
        })

    await db.api_calls.insert_many(calls)

    # Insert demo alert history
    await db.alert_history.delete_many({"user_id": user.user_id})
    demo_alerts = [
        {
            "user_id": user.user_id,
            "history_id": f"hist_{uuid.uuid4().hex[:8]}",
            "alert_type": "single_feature",
            "message": "doc-summarizer exceeded $30/day limit",
            "value": 34.12,
            "status": "triggered",
            "triggered_at": (now - timedelta(days=1)).isoformat()
        },
        {
            "user_id": user.user_id,
            "history_id": f"hist_{uuid.uuid4().hex[:8]}",
            "alert_type": "hourly_spike",
            "message": "Hourly spike: 340% above average",
            "value": None,
            "status": "triggered",
            "triggered_at": (now - timedelta(days=4)).isoformat()
        },
        {
            "user_id": user.user_id,
            "history_id": f"hist_{uuid.uuid4().hex[:8]}",
            "alert_type": "daily_spend",
            "message": "Daily spend exceeded $50 threshold",
            "value": 52.34,
            "status": "triggered",
            "triggered_at": (now - timedelta(days=7)).isoformat()
        },
        {
            "user_id": user.user_id,
            "history_id": f"hist_{uuid.uuid4().hex[:8]}",
            "alert_type": "single_feature",
            "message": "chat-assistant exceeded $30/day limit",
            "value": 31.50,
            "status": "triggered",
            "triggered_at": (now - timedelta(days=11)).isoformat()
        }
    ]
    await db.alert_history.insert_many(demo_alerts)

    # Update user stats
    total_cost = sum(c["cost"] for c in calls)
    total_tokens = sum(c["total_tokens"] for c in calls)
    await db.user_stats.update_one(
        {"user_id": user.user_id},
        {"$inc": {"total_cost": total_cost, "total_calls": len(calls), "total_tokens": total_tokens}},
        upsert=True
    )

    return {"success": True, "calls_added": len(calls), "total_cost": round(total_cost, 4)}

DEMO_END_USERS = ["user_001", "user_002", "user_003", "user_004", "user_005"]

def demo_call_filter(owner_id: str) -> dict:
    """Match both newly-tagged and legacy untagged demo calls"""
    return {
        "owner_id": owner_id,
        "$or": [{"is_demo": True}, {"end_user": {"$in": DEMO_END_USERS}}],
    }

@api_router.post("/dashboard/clear-demo")
async def clear_demo_data(request: Request):
    """Remove all demo data for the current user"""
    user = await get_current_user(request)

    result = await db.api_calls.delete_many(demo_call_filter(user.user_id))
    await db.alert_history.delete_many({"user_id": user.user_id})

    # Recalculate user stats from remaining real calls
    real_calls = await db.api_calls.find({"owner_id": user.user_id}, {"cost": 1, "total_tokens": 1}).to_list(None)
    total_cost = sum(c.get("cost", 0) for c in real_calls)
    total_tokens = sum(c.get("total_tokens", 0) for c in real_calls)
    await db.user_stats.update_one(
        {"user_id": user.user_id},
        {"$set": {"total_cost": total_cost, "total_calls": len(real_calls), "total_tokens": total_tokens}},
        upsert=True
    )

    return {"success": True, "calls_removed": result.deleted_count}

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
    allow_origins=os.environ.get('CORS_ORIGINS', 'https://tokenlens-three.vercel.app').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
