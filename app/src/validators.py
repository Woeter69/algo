import os
import smtplib 
from email.mime.text import MIMEText
from dotenv import load_dotenv
from flask import session, redirect, url_for, flash
from functools import wraps

load_dotenv()

EMAIL_USER = os.getenv("EMAIL_USER")
EMAIL_PASS = os.getenv("EMAIL_PASS")
def send_verification_email(to_email,link):
    msg = MIMEText(f"Click this link to verify your account:\n\n{link}")
    msg["Subject"] = "Verify your Alumni Platform account"
    msg["From"] = EMAIL_USER
    msg["To"] = to_email


    with smtplib.SMTP("smtp.gmail.com",587) as server:
        server.starttls()
        server.login(EMAIL_USER,EMAIL_PASS)
        server.send_message(msg)


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"}

def allowed_file(filename):
    """
    Returns True if the uploaded file has an allowed image extension.
    """
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS



def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash("Please log in to access this page.")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function
