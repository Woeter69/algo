"""
Database Connection Module

This module handles PostgreSQL database connections using environment variables.
Previously used normal SQL, now upgraded to PostgreSQL for better performance and features.
"""

# psycopg2: PostgreSQL adapter for Python - allows Python to connect to PostgreSQL databases
import psycopg2
# os: Access environment variables for database credentials
import os
# dotenv: Loads environment variables from .env file for secure credential storage
from dotenv import load_dotenv

# Load database credentials from .env file
load_dotenv()

def get_db_connection():
    """
    Creates a connection to PostgreSQL database using environment variables.
    
    Returns a database connection object that can be used to execute SQL queries.
    Uses .env file for secure credential storage instead of hardcoding passwords.
    """
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        port=5432
    )