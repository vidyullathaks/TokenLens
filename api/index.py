import sys
import os

# server.py is co-located in the api/ directory
sys.path.insert(0, os.path.dirname(__file__))

from server import app
