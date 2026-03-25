"""
Validation utilities for the AlumniGo application.
"""

import re
import os
import smtplib
from functools import wraps
from email.mime.text import MIMEText
from flask import session, flash, redirect, url_for, request

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}


def allowed_file(filename):
    """Check if the file has an allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def send_verification_email(to_email, link):
    """Send a verification email with the given link."""
    msg = MIMEText(f"Click this link to verify your account:\n\n{link}")
    msg["Subject"] = "Verify your Alumni Platform account"
    msg["From"] = EMAIL_USER
    msg["To"] = to_email

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.send_message(msg)


def validate_username(username):
    """Validate a username."""
    if not username or len(username) < 3:
        return False, "Username must be at least 3 characters long"
    if len(username) > 20:
        return False, "Username must be less than 20 characters"
    if not username.replace("_", "").replace("-", "").isalnum():
        return False, "Username can only contain letters, numbers, hyphens, and underscores"
    return True, "Valid username"


def validate_email(email):
    """Validate an email address format."""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    if not re.match(pattern, email):
        return False, "Invalid email format"
    return True, "Valid email"


def validate_password(password):
    """Validate a password meets requirements."""
    if not password or len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if len(password) > 128:
        return False, "Password must be less than 128 characters"

    has_upper = any(c.isupper() for c in password)
    has_lower = any(c.islower() for c in password)
    has_digit = any(c.isdigit() for c in password)

    if not (has_upper and has_lower and has_digit):
        return False, "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    return True, "Valid password"


def validate_file_size(file, max_size_mb=5):
    """Validate that a file does not exceed the maximum size."""
    if file:
        file.seek(0, 2)
        size = file.tell()
        file.seek(0)
        max_size_bytes = max_size_mb * 1024 * 1024
        if size > max_size_bytes:
            return False, f"File size must be less than {max_size_mb}MB"
    return True, "Valid file size"
