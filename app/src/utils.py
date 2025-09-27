"""
Utility functions for the application.

This module contains various helper functions for:
- Email validation (student email checking)
- File operations (loading cities data)
- Image uploading to external services
- Timezone conversions and datetime formatting
- User-related utilities (room ID generation, avatar creation)
"""

import re, os, base64
import json, requests
import pytz
import urllib.parse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set of test emails loaded from environment variable for development/testing purposes
TEST_EMAILS = set(os.getenv("TEST_EMAILS", "").split(","))

def is_student_email(email):
    """
    Check if an email address belongs to a student (educational institution).
    
    Args:
        email (str): The email address to validate
        
    Returns:
        bool: True if the email is a student email, False otherwise
        
    Note:
        - First checks against TEST_EMAILS for development/testing
        - Then validates against common educational domain patterns
        - Supports domains like .edu, .ac.in, .ac.uk, etc.
    """
    # Check if email is in the test emails set (for development/testing)
    if email in TEST_EMAILS:
        return True 
    
    # Regex pattern to match educational institution email domains
    pattern = r".+@.+\.(edu|ac\.in|ac\.uk|edu\.au|ac\.ca|ac\.nz|ac\.jp|ac\.kr|ac\.us|college\.edu|uni\.edu)$"
    return re.match(pattern, email) is not None

def load_cities():
    """
    Load cities data from the JSON file.
    
    Returns:
        dict/list: The cities data loaded from the JSON file
        
    Raises:
        FileNotFoundError: If the cities JSON file is not found
        json.JSONDecodeError: If the JSON file is malformed
        
    Note:
        The function looks for cities-name-list.json in the static/data directory
        relative to the current file's location.
    """
    # Get the directory of the current file
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # Construct path to cities data file
    DATA_PATH = os.path.join(BASE_DIR, "..", "static", "data", "cities-name-list.json")
    
    # Load and return the cities data
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)

def upload_to_imgbb(file, api_key):
    """
    Upload an image file to ImgBB image hosting service.
    
    Args:
        file: File object to upload (should have a read() method)
        api_key (str): ImgBB API key for authentication
        
    Returns:
        str or None: The URL of the uploaded image if successful, None if failed
        
    Note:
        - The file is base64 encoded before uploading
        - Returns None if the upload fails (non-200 status code)
        - Requires a valid ImgBB API key
    """
    # Prepare payload with API key and base64-encoded image
    payload = {
        "key": api_key,
        "image": base64.b64encode(file.read()).decode('utf-8')
    }
    
    # Send POST request to ImgBB API
    response = requests.post("https://api.imgbb.com/1/upload", data=payload)
    
    # Return image URL if successful, None otherwise
    if response.status_code == 200:
        return response.json()['data']['url']
    else:
        return None

# Indian Standard Time timezone object for datetime conversions
IST = pytz.timezone('Asia/Kolkata')

def to_ist(utc_datetime):
    """
    Convert a UTC datetime to Indian Standard Time (IST).
    
    Args:
        utc_datetime (datetime or None): UTC datetime object to convert
        
    Returns:
        datetime or None: Datetime converted to IST, or None if input is None
        
    Note:
        - If the input datetime is naive (no timezone info), it's assumed to be UTC
        - Returns None if input is None
    """
    if utc_datetime is None:
        return None
    
    # If datetime is naive (no timezone), assume it's UTC and localize it
    if utc_datetime.tzinfo is None:
        utc_datetime = pytz.utc.localize(utc_datetime)
    
    # Convert to IST
    return utc_datetime.astimezone(IST)

def format_ist_time(utc_datetime, format_str='%I:%M %p'):
    """
    Format a UTC datetime as an IST time string.
    
    Args:
        utc_datetime (datetime or None): UTC datetime to format
        format_str (str): Format string for strftime (default: '%I:%M %p' for 12-hour format)
        
    Returns:
        str: Formatted time string in IST, or 'now' if input is None
        
    Example:
        format_ist_time(datetime.utcnow()) -> "02:30 PM"
    """
    if utc_datetime is None:
        return 'now'
    
    # Convert to IST and format
    ist_time = to_ist(utc_datetime)
    return ist_time.strftime(format_str)

def format_utc_timestamp(utc_datetime):
    """
    Convert a UTC datetime to a Unix timestamp in milliseconds.
    
    Args:
        utc_datetime (datetime or None): UTC datetime to convert
        
    Returns:
        int or None: Unix timestamp in milliseconds, or None if input is None
        
    Note:
        - If the input datetime is naive (no timezone), it's assumed to be UTC
        - Returns timestamp in milliseconds (multiplied by 1000)
    """
    if utc_datetime is None:
        return None
    
    # If datetime is naive (no timezone), assume it's UTC and localize it
    if utc_datetime.tzinfo is None:
        utc_datetime = pytz.utc.localize(utc_datetime)
    
    # Return timestamp in milliseconds
    return int(utc_datetime.timestamp() * 1000)

def get_room_id(user1, user2):
    """
    Generate a consistent room ID for two users.
    
    Args:
        user1 (str): First user identifier
        user2 (str): Second user identifier
        
    Returns:
        str: A consistent room ID in format "room_{smaller_id}_{larger_id}"
        
    Note:
        - Uses min/max to ensure the same room ID regardless of parameter order
        - Example: get_room_id("alice", "bob") == get_room_id("bob", "alice")
    """
    return f"room_{min(user1, user2)}_{max(user1, user2)}"

def generate_default_avatar(name):
    """
    Generate a default avatar URL for users without profile pictures.
    
    Args:
        name (str): User's name to generate avatar from
        
    Returns:
        str: URL to a generated avatar image
        
    Note:
        - Returns a default avatar URL if name is empty/None
        - Creates initials-based avatar using UI Avatars service
        - Uses consistent color based on name hash for same users
        - Limits initials to maximum 2 characters
    """
    # Return default avatar if no name provided
    if not name:
        return 'https://i.ibb.co/QDy827D/default-avatar.png'
    
    # Clean the name and extract initials
    clean_name = name.strip()
    words = clean_name.split()
    # Get first letter of each word, max 2 characters
    initials = ''.join([word[0].upper() for word in words if word])[:2]
    
    # Predefined color palette for avatar backgrounds
    colors = [
        '6D28D9', '3B82F6', '10B981', 'F59E0B', 'EF4444',
        '8B5CF6', '06B6D4', 'F97316', 'EC4899', '84CC16'
    ]
    
    # Generate consistent color based on name hash
    # Sum ASCII values of all characters in the name
    hash_value = sum(ord(char) for char in clean_name)
    color_index = hash_value % len(colors)
    background_color = colors[color_index]
    
    # Generate UI Avatars URL with custom styling
    return f"https://ui-avatars.com/api/?name={urllib.parse.quote(initials)}&background={background_color}&color=fff&size=80&font-size=0.6&bold=true"
