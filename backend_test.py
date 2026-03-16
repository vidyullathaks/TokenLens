import requests
import sys
import json
from datetime import datetime

class TokenLensAPITester:
    def __init__(self, base_url="https://ai-billing-hub-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = "test_session_1773632793480"
        self.user_id = "test-user-1773632793480"
        self.api_key = "tl_live_yycdht8rq69"
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api{endpoint}"
        
        # Default headers with auth
        default_headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.session_token}'
        }
        if headers:
            default_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=default_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if isinstance(response_data, list):
                        print(f"   Response: {len(response_data)} items")
                    elif isinstance(response_data, dict):
                        print(f"   Response keys: {list(response_data.keys())[:5]}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")

            return success, response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_endpoints(self):
        """Test health check endpoints"""
        print("\n" + "="*50)
        print("TESTING HEALTH ENDPOINTS")
        print("="*50)
        
        self.run_test("Root endpoint", "GET", "/", 200)
        self.run_test("Health check", "GET", "/health", 200)

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        print("\n" + "="*50)
        print("TESTING AUTH ENDPOINTS")
        print("="*50)
        
        self.run_test("Get current user", "GET", "/auth/me", 200)

    def test_dashboard_endpoints(self):
        """Test dashboard data endpoints"""
        print("\n" + "="*50)
        print("TESTING DASHBOARD ENDPOINTS")
        print("="*50)
        
        self.run_test("Dashboard stats", "GET", "/dashboard/stats", 200)
        self.run_test("Cost by feature", "GET", "/dashboard/cost-by-feature", 200)
        self.run_test("Daily spend", "GET", "/dashboard/daily-spend", 200)
        self.run_test("Top users", "GET", "/dashboard/top-users", 200)
        self.run_test("Recent calls", "GET", "/dashboard/recent-calls", 200)

    def test_api_keys_endpoints(self):
        """Test API keys endpoints"""
        print("\n" + "="*50)
        print("TESTING API KEYS ENDPOINTS")
        print("="*50)
        
        self.run_test("Get API key", "GET", "/api-keys", 200)
        self.run_test("Regenerate API key", "POST", "/api-keys/regenerate", 200)

    def test_alerts_endpoints(self):
        """Test alerts configuration endpoints"""
        print("\n" + "="*50)
        print("TESTING ALERTS ENDPOINTS")
        print("="*50)
        
        self.run_test("Get alert configs", "GET", "/alerts/config", 200)
        self.run_test("Get alert history", "GET", "/alerts/history", 200)
        
        # Test creating/updating alert config
        alert_config = {
            "alert_type": "daily_spend",
            "threshold": 75.0,
            "notification_method": "email",
            "enabled": True
        }
        self.run_test("Update alert config", "POST", "/alerts/config", 200, alert_config)

    def test_settings_providers_endpoints(self):
        """Test Settings/Providers CRUD operations"""
        print("\n" + "="*50)
        print("TESTING SETTINGS/PROVIDERS ENDPOINTS")
        print("="*50)
        
        # Test getting connected providers (should be empty for new user)
        success, providers = self.run_test("Get connected providers", "GET", "/settings/providers", 200)
        
        if success:
            print(f"   Initial providers count: {len(providers) if isinstance(providers, list) else 0}")
        
        # Test adding a provider (using dummy API key as suggested)
        provider_data = {
            "provider_id": "anthropic",
            "api_key": "sk-ant-api03-test12345678901234567890"
        }
        add_success, add_response = self.run_test("Add Anthropic provider", "POST", "/settings/providers", 200, provider_data)
        
        # Test getting providers after adding one
        success, providers_after = self.run_test("Get providers after adding", "GET", "/settings/providers", 200)
        if success and isinstance(providers_after, list):
            print(f"   Providers count after add: {len(providers_after)}")
            if len(providers_after) > 0:
                print(f"   Added provider ID: {providers_after[0].get('provider_id', 'unknown')}")
        
        # Test adding another provider (OpenAI)
        openai_data = {
            "provider_id": "openai", 
            "api_key": "sk-test12345678901234567890"
        }
        self.run_test("Add OpenAI provider", "POST", "/settings/providers", 200, openai_data)
        
        # Test invalid provider
        invalid_data = {
            "provider_id": "invalid_provider",
            "api_key": "test-key"
        }
        self.run_test("Add invalid provider", "POST", "/settings/providers", 400, invalid_data)
        
        # Test missing API key
        missing_key_data = {
            "provider_id": "google"
        }
        self.run_test("Add provider without API key", "POST", "/settings/providers", 400, missing_key_data)
        
        # Test removing a provider
        self.run_test("Remove Anthropic provider", "DELETE", "/settings/providers/anthropic", 200)
        
        # Test removing non-existent provider
        self.run_test("Remove non-existent provider", "DELETE", "/settings/providers/nonexistent", 404)
        
    def test_unauthenticated_access(self):
        """Test that endpoints require authentication"""
        print("\n" + "="*50)
        print("TESTING UNAUTHENTICATED ACCESS")
        print("="*50)
        
        # Temporarily remove auth header
        original_token = self.session_token
        self.session_token = None
        
        self.run_test("Dashboard without auth", "GET", "/dashboard/stats", 401)
        self.run_test("API keys without auth", "GET", "/api-keys", 401)
        self.run_test("Settings providers without auth", "GET", "/settings/providers", 401)
        
        # Restore auth
        self.session_token = original_token

    def run_all_tests(self):
        """Run complete test suite"""
        print(f"🚀 Starting TokenLens API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"🔑 Session Token: {self.session_token[:20]}...")
        print(f"👤 User ID: {self.user_id}")
        
        self.test_health_endpoints()
        self.test_auth_endpoints()
        self.test_dashboard_endpoints()
        self.test_api_keys_endpoints()
        self.test_alerts_endpoints()
        self.test_settings_providers_endpoints()  # Add the new test
        self.test_unauthenticated_access()
        
        # Print summary
        print("\n" + "="*50)
        print("TEST SUMMARY")
        print("="*50)
        print(f"📊 Tests passed: {self.tests_passed}/{self.tests_run}")
        success_rate = (self.tests_passed / self.tests_run) * 100 if self.tests_run > 0 else 0
        print(f"📈 Success rate: {success_rate:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed!")
            return 1

def main():
    tester = TokenLensAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())