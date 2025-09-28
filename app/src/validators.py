import os
import smtplib 
from email.mime.text import MIMEText #WTF is MIME?
from dotenv import load_dotenv
from flask import session, redirect, url_for, flash
from functools import wraps


# import os
# Allows you to interact with the operating system (e.g., reading environment variables, file paths).

# import smtplib
# Python’s built-in library for sending emails using the SMTP protocol.

# from email.mime.text import MIMEText
# MIMEText helps create properly formatted plain text email messages.
#WTF is MIME?
# Multipurpose Internet Mail Extensions is a standard that extends the format of email messages to support text in character sets other than ASCII, as well as attachments of audio, video, images, and application programs.
# Which means we can send more than just text over the mail. Ayeee! fellas. $εnd !_Δε$

# from dotenv import load_dotenv
# Loads sensitive configuration values (like passwords, API keys) from a .env file into your environment. 
# So that our dear Aditya's info is not shared publically. Also notice that we had put the .env file in gitignore as well.
# Safer than hardcoding secrets in your code.

# from flask import session, redirect, url_for, flash
# session: Stores data for a logged-in user between requests
# redirect: Redirects a user to a different route.
# url_for: Dynamically builds URLs for Flask routes.

# flash: Stores short messages that can be shown to the user.

# from functools import wraps
# Used to create decorators in Python while preserving metadata like function name and docstring. -> Whole chapter written below don't worry, you'll understand it. Or that's what i hope


load_dotenv() # This reads key-value pairs from a .env file and sets them as environment variables.
                # We have created the environment variables from .env that can now be read and used.

EMAIL_USER = os.getenv("EMAIL_USER") #fetching/setting/using/getting environment variable values.
EMAIL_PASS = os.getenv("EMAIL_PASS")

def send_verification_email(to_email,link):
    msg = MIMEText(f"Click this link to verify your account:\n\n{link}") # Here we are making what message to send. And related metadata like subject, from, to etc.
    msg["Subject"] = "Verify your Alumni Platform account"
    msg["From"] = EMAIL_USER
    msg["To"] = to_email


    with smtplib.SMTP("smtp.gmail.com",587) as server: # Starting the server at 587(standard) and actually sending the message
        server.starttls()       # Ever heard of TLS(Transport layer security) handshake. Yep that's what's happening here.
        server.login(EMAIL_USER,EMAIL_PASS) # using credentials to login in and then send the message
        server.send_message(msg)   # using with is good because we don't have to manually close the connectoin.


ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif"} # defining what extensions are allowed.

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# what this does is that it checks if the given file has the right extention. It gives a Boolean Value.
# it ensure that file has an extention. '.' in it.
# then if the extention exists it must be in  ALLOWED_EXTENSIONS
# Example: "photo.png".rsplit('.', 1) → ['photo', 'png']
# Then ['photo', 'png'][1].lower() = png   which is then checked if it is in  ALLOWED_EXTENSIONS

def login_required(f):
    @wraps(f)                                   #Standard Shit we use to let flask know that login_required can be used as a decorator for other function. & Keeps the original function's (f) name, docstring, and metadata intact.
    def decorated_function(*args, **kwargs):    #*args	Collects all positional arguments into a tuple.
                                                 #**kwargs	Collects all keyword arguments into a dictionary.
                                                  # decorator login_required can now control any function 'f' under it when we initialize it. f is called the 'decorated function'.
        if 'user_id' not in session:               # If the user is not logged in
            # Save the intended URL for redirect after login
            session['next_url'] = request.url
            flash("Please log in to access this page.") # say that they need to login
            return redirect(url_for('login'))            # redirect then to the login page.
        return f(*args, **kwargs)                       # else if they are indeed logged in call the function 'f'
    return decorated_function                       #returns if the need to be redirected and redirects them or the function 'f' is called
                                                    # the function 'f' here could be doing anything like redirecting to another page.
                                                     # or accessing user setting, enabling chatting, anything that requires the user to be logged in.
                                                     # formatting could have been better with proper else clause paired with if, using try and catch statements is more sutable according to me.

def validate_username(username):
    if not username or len(username) < 3: #checks if the username is empty or less than 3 characters long
        return False, "Username must be at least 3 characters long"
    if len(username) > 20:
        return False, "Username must be less than 20 characters" # self explanatory
    if not username.replace('_', '').replace('-', '').isalnum(): # checks if the username is alphanumerical when _ and - are removed from it.
        return False, "Username can only contain letters, numbers, hyphens, and underscores"
    return True, "Valid username"

def validate_email(email): # using regular expressions (regex) for for checking proper email format
    import re               # this is just python inbuilt regular expressions library
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' # we define this to be the pattern of the string passed in the function. i.e nothing but the user's email duh!.
    if not re.match(pattern, email): # if the email doensn't match our pattern return False and Invalid email format
        return False, "Invalid email format" # if it does match our pattern, then Hoorayy!!. return True and say that the email format is valid
    return True, "Valid email"
                                    # Here's a breakdown of the regular expression(pattern) used by us
                                    # The r before the string → raw string in Python.
                                    #It tells Python not to treat backslashes \ as escape characters. although we still can use escape character in a different way
                                    # ^ means start of string and $ means end of string, ok babu!
                                    # [a-zA-Z0-9._%+-]+ this means all lowercase, uppercase, digits and some specials character like . _ % + - are allowed
                                    # ofcourse some of these character are not allowed in gmail. but we have to also see that users using yahoo, microsoft mail , or organizations with custom emails can still register using those emails
                                    # The plus at the end of [a-zA-Z0-9._%+-]+ shows that more than one character is allowed
                                    # @ in the expressions just say that there must be an @.
                                    # \. is used to put a dot. because In regex, a plain . means "any character"
                                    # Btw this regular expession makes it possible to match .co.in .edu.in etc TLDs(Top Level Domain) too 
                                    # also note that we've also used regular expressions in gitignore or .env etc files too i guess. but we can use this often so learn the basics of it.

def validate_password(password):
    if not password or len(password) < 8: # simple, again checking if the password sting is empty or less than 8 characters long
        return False, "Password must be at least 8 characters long"
    if len(password) > 128:
        return False, "Password must be less than 128 characters"
    
    has_upper = any(c.isupper() for c in password) # these check if atleast 1 character exist that is uppercase, lower, and digit in password
    has_lower = any(c.islower() for c in password) # returns a boolean value off course 
    has_digit = any(c.isdigit() for c in password) # note that we could have also used regex - regular expressions for this as well.
    
    if not (has_upper and has_lower and has_digit): # throws error if requirements of password not met
        return False, "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    
    return True, "Valid password"

def validate_file_size(file, max_size_mb=5):
    if file: # if a non empty file is uploaded then this statement doensn't run
        file.seek(0, 2) # move pointer to end of file.
        size = file.tell() # get current position = file size in bytes. super smart way.
        file.seek(0) # reset pointer back to start (important so file isn't "consumed"). i.e it can be read normally later by other functions. 
        
        max_size_bytes = max_size_mb * 1024 * 1024 # converting 5mb to it's byte equivalent. love that we've used 1024 instead of 1000.
        if size > max_size_bytes:
            return False, f"File size must be less than {max_size_mb}MB" # if file size is bigger than 5 mb throw an error.
    
    return True, "Valid file size"   # Also note that for using the file we learn't in python that we have to open and close it manually. here we have used the seek and tell functions without opening the file first.
                                    # This is made possible thanks to OVESH?? NO!!, thanks to flask which converts the files(text, binary, images, videos etc) to a FileStorage Object which can be accessed like a normal binary file
                                    # Flask uses Werkzeug internally to process this request. of file uploads handling. ultimately converting it to byte stream. i.e a BytesIO object as a temporary file on disk that we can work normally with.
                                    #  flask handles the storage of these temporary files and their locations automatically so that we can rest easy yayyyy!!

