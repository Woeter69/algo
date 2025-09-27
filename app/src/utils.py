import re,os,base64
import json,requests
import pytz
import urllib.parse
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
