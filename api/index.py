import sys
import os

# server.py is co-located in this api/ directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from server import app
