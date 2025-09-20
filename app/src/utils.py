import re,os,base64
import json,requests
import pytz
from dotenv import load_dotenv

load_dotenv()
TEST_EMAILS = set(os.getenv("TEST_EMAILS","").split(","))

def is_student_email(email):
    if email in TEST_EMAILS:
        return True 
    
    pattern = r".+@.+\.(edu|ac\.in|ac\.uk|edu\.au|ac\.ca|ac\.nz|ac\.jp|ac\.kr|ac\.us|college\.edu|uni\.edu)$"
    return re.match(pattern,email) is not None

def load_cities():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # gives /app/src
    DATA_PATH = os.path.join(BASE_DIR, "..", "static", "data", "cities-name-list.json")
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


def upload_to_imgbb(file, api_key):
    """Uploads a file object to ImgBB and returns the image URL."""
    payload = {
        "key": api_key,
        "image": base64.b64encode(file.read()).decode('utf-8')
    }
    response = requests.post("https://api.imgbb.com/1/upload", data=payload)
    if response.status_code == 200:
        return response.json()['data']['url']
    else:
        return None

# ===== TIME UTILITY FUNCTIONS =====

# IST timezone
IST = pytz.timezone('Asia/Kolkata')

def to_ist(utc_datetime):
    """Convert UTC datetime to IST"""
    if utc_datetime is None:
        return None
    if utc_datetime.tzinfo is None:
        # Assume UTC if no timezone info
        utc_datetime = pytz.utc.localize(utc_datetime)
    return utc_datetime.astimezone(IST)

def format_ist_time(utc_datetime, format_str='%I:%M %p'):
    """Format datetime in IST"""
    if utc_datetime is None:
        return 'now'
    ist_time = to_ist(utc_datetime)
    return ist_time.strftime(format_str)

def format_utc_timestamp(utc_datetime):
    """Return UTC timestamp for client-side timezone conversion"""
    if utc_datetime is None:
        return None
    if utc_datetime.tzinfo is None:
        utc_datetime = pytz.utc.localize(utc_datetime)
    return int(utc_datetime.timestamp() * 1000)  # Return milliseconds for JavaScript

def get_room_id(user1, user2):
    """Consistent room id for two users"""
    return f"room_{min(user1,user2)}_{max(user1,user2)}"
