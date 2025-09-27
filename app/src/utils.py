import re,os,base64
import json,requests
import pytz
import urllib.parse
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()
TEST_EMAILS = set(os.getenv("TEST_EMAILS","").split(","))

def is_student_email(email):
    if email in TEST_EMAILS:
        return True 
    
    pattern = r".+@.+\.(edu|ac\.in|ac\.uk|edu\.au|ac\.ca|ac\.nz|ac\.jp|ac\.kr|ac\.us|college\.edu|uni\.edu)$"
    return re.match(pattern,email) is not None

def load_cities():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    DATA_PATH = os.path.join(BASE_DIR, "..", "static", "data", "cities-name-list.json")
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)

def upload_to_imgbb(file, api_key):
    payload = {
        "key": api_key,
        "image": base64.b64encode(file.read()).decode('utf-8')
    }
    response = requests.post("https://api.imgbb.com/1/upload", data=payload)
    if response.status_code == 200:
        return response.json()['data']['url']
    else:
        return None

IST = pytz.timezone('Asia/Kolkata')

def to_ist(utc_datetime):
    if utc_datetime is None:
        return None
    if utc_datetime.tzinfo is None:
        utc_datetime = pytz.utc.localize(utc_datetime)
    return utc_datetime.astimezone(IST)

def format_ist_time(utc_datetime, format_str='%I:%M %p'):
    if utc_datetime is None:
        return 'now'
    ist_time = to_ist(utc_datetime)
    return ist_time.strftime(format_str)

def format_utc_timestamp(utc_datetime):
    if utc_datetime is None:
        return None
    if utc_datetime.tzinfo is None:
        utc_datetime = pytz.utc.localize(utc_datetime)
    return int(utc_datetime.timestamp() * 1000)

def get_room_id(user1, user2):
    return f"room_{min(user1,user2)}_{max(user1,user2)}"

def generate_default_avatar(name):
    """Generate a default avatar URL for users without profile pictures"""
    if not name:
        return 'https://i.ibb.co/QDy827D/default-avatar.png'
    
    # Clean the name and get initials
    clean_name = name.strip()
    words = clean_name.split()
    initials = ''.join([word[0].upper() for word in words if word])[:2]
    
    # Generate a consistent color based on name
    colors = [
        '6D28D9', '3B82F6', '10B981', 'F59E0B', 'EF4444',
        '8B5CF6', '06B6D4', 'F97316', 'EC4899', '84CC16'
    ]
    
    # Simple hash function to get consistent color for same name
    hash_value = sum(ord(char) for char in clean_name)
    color_index = hash_value % len(colors)
    background_color = colors[color_index]
    
    # Return UI Avatars URL with custom styling
    return f"https://ui-avatars.com/api/?name={urllib.parse.quote(initials)}&background={background_color}&color=fff&size=80&font-size=0.6&bold=true"

# Configure logging for email functions
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_password_reset_email_content(reset_token: str, user_name: str = None, to_email: str = None):
    """Create password reset email content without HTML in Python"""
    base_url = os.getenv('BASE_URL', 'http://localhost:5000')
    reset_url = f"{base_url}/reset-password/{reset_token}"
    
    # Simple text-based email content
    subject = "Reset Your ALGO Password"
    
    greeting = f"Hi {user_name}," if user_name else "Hi there,"
    
    text_body = f"""
{greeting}

We received a request to reset your password for your ALGO account.

To reset your password, visit this link:
{reset_url}

Or use this reset token: {reset_token}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email.

Best regards,
The ALGO Team

© 2025 ALGO - Alumni Go. All rights reserved.
    """
    
    return subject, text_body

def create_password_changed_email_content(user_name: str = None, to_email: str = None):
    """Create password changed notification email content"""
    subject = "Your ALGO Password Has Been Changed"
    
    greeting = f"Hi {user_name}," if user_name else "Hi there,"
    
    text_body = f"""
{greeting}

Your ALGO account password has been successfully changed.

If you didn't make this change, please contact our support team immediately.

For your security:
- Keep your password secure and don't share it with anyone
- Use a unique password that you don't use elsewhere
- Consider enabling two-factor authentication if available

Best regards,
The ALGO Team

© 2025 ALGO - Alumni Go. All rights reserved.
    """
    
    return subject, text_body

def send_password_reset_email(to_email: str, reset_token: str, user_name: str = None) -> bool:
    """Send password reset email with reset link"""
    try:
        # Email configuration from environment variables
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        from_email = os.getenv('FROM_EMAIL', smtp_username)
        
        if not smtp_username or not smtp_password:
            logger.error("SMTP credentials not configured")
            return False
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        
        # Get email content
        subject, text_body = create_password_reset_email_content(reset_token, user_name, to_email)
        msg['Subject'] = subject
        
        # Attach text content
        msg.attach(MIMEText(text_body, 'plain'))
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"Password reset email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset email to {to_email}: {str(e)}")
        return False

def send_password_changed_notification(to_email: str, user_name: str = None) -> bool:
    """Send notification email when password is successfully changed"""
    try:
        # Email configuration
        smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_username = os.getenv('SMTP_USERNAME')
        smtp_password = os.getenv('SMTP_PASSWORD')
        from_email = os.getenv('FROM_EMAIL', smtp_username)
        
        if not smtp_username or not smtp_password:
            logger.error("SMTP credentials not configured")
            return False
        
        # Create message
        msg = MIMEMultipart()
        msg['From'] = from_email
        msg['To'] = to_email
        
        # Get email content
        subject, text_body = create_password_changed_email_content(user_name, to_email)
        msg['Subject'] = subject
        
        # Attach text content
        msg.attach(MIMEText(text_body, 'plain'))
        
        # Send email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)
        
        logger.info(f"Password changed notification sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password changed notification to {to_email}: {str(e)}")
        return False
