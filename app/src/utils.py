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
    with open("../static/data/cities-name-list.json", encoding="utf-8") as f:
        return json.load(f)
