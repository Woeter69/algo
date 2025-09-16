import os
import smtplib 
from email.mime.text import MIMEText
from dotenv import load_dotenv

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

