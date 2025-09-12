import re,os
import json
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
