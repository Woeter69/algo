from vercel_python_wsgi import serverless_wsgi
from app import app  # your Flask app instance in app.py

def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
