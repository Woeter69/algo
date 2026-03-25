"""
Centralized Database Connection Management
"""
import os
import psycopg2.pool
from flask import g
from dotenv import load_dotenv

load_dotenv()

pool = None

def init_db_pool():
    """
    Initializes the database connection pool.
    This should be called once when the application starts.
    """
    global pool
    pool = psycopg2.pool.SimpleConnectionPool(
        1,  # minconn
        20, # maxconn
        host=os.getenv("DB_HOST"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=os.getenv("DB_PORT", 5432),
    )

def get_db():
    """
    Opens a new database connection if there is none yet for the
    current application context.
    """
    if 'db' not in g:
        if not pool:
            init_db_pool()
        g.db = pool.getconn()
    return g.db

def close_db(e=None):
    """
    Closes the database connection. This function is called automatically
    at the end of each request.
    """
    db = g.pop('db', None)
    if db is not None and pool is not None:
        pool.putconn(db)

def init_app(app):
    """Register database functions with the Flask app."""
    app.teardown_appcontext(close_db)
    with app.app_context():
        init_db_pool()
