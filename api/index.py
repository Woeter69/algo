import sys, os
# add the folder containing app.py to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app', 'src'))

from app import app  # import Flask app instance from app.py

from vercel_python_wsgi import serverless_wsgi

def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
