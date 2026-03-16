import sys
import os

# Add backend directory to path so server.py imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from server import app
