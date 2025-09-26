import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from flask_socketio import SocketIO, join_room, leave_room, send, emit
from flask import Flask,render_template,request, session, redirect, url_for,flash
from . import connection 
import secrets, datetime
from flask_bcrypt import Bcrypt
from . import utils, validators
from .connection import get_db_connection
from . import user_roles
from .user_roles import (
    login_required, verified_user_required, admin_required,
    get_user_role_info, get_communities, submit_verification_request,
    get_pending_verification_requests, approve_verification_request,
    reject_verification_request, is_admin
)

app = Flask(__name__,template_folder="../templates",static_folder="../static")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")
bcrypt = Bcrypt(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Import generate_default_avatar from utils
from .utils import generate_default_avatar
@app.context_processor
def inject_time_functions():
    return {
        'to_ist': utils.to_ist,
        'format_ist_time': utils.format_ist_time,
        'generate_default_avatar': utils.generate_default_avatar
    }

@app.route('/')
def home():
    try:
        
        if 'user_id' in session:
            return redirect(url_for('user_dashboard'))
        return render_template("home.html")
    except Exception as e:
        app.logger.error(f"Error in home route: {str(e)}")
        flash("An error occurred while loading the page. Please try again later.")
        return render_template("home.html"), 500

@app.route("/login", methods=["GET", "POST"])
def login():
    
    if 'user_id' in session:
        return redirect(url_for('user_dashboard'))
    
    cur = None
    mydb = None

    try:
        if request.method == "POST":
            email_or_username = request.form["email"]  
            password = request.form["password"]

            mydb = get_db_connection()
            cur = mydb.cursor()

            
            cur.execute(
                "SELECT user_id, password, login_count, username, pfp_path, role FROM users WHERE email=%s OR username=%s",
                (email_or_username, email_or_username)
            )
            row = cur.fetchone()

            if row:
                user_id, hashed_password, login_count, username, pfp_path, role = row
                if bcrypt.check_password_hash(hashed_password, password):
                    session['user_id'] = user_id
                    session['username'] = username
                    session['pfp_path'] = pfp_path
                    session['role'] = role

                    
                    cur.execute(
                        "UPDATE users SET last_login=%s, login_count=login_count+1 WHERE user_id=%s",
                        (datetime.datetime.utcnow(), user_id)
                    )
                    mydb.commit()

                    if login_count == 0:
                        return redirect(url_for("complete_profile"))  
                    else:
                        return redirect(url_for("user_dashboard"))

            return render_template("login.html", error="Invalid Credentials")

        return render_template("login.html")

    except Exception as e:
        app.logger.error(f"Error during login: {str(e)}")
        flash("An unexpected error occurred. Please try again later.")
        return render_template("login.html"), 500

    finally:
        if cur is not None:
            cur.close()
        if mydb is not None:
            mydb.close()

@app.route("/register",methods=["GET","POST"])
def register():
    
    if 'user_id' in session:
        return redirect(url_for('user_dashboard'))
    
    try:
        if request.method == "POST":
            firstname = request.form["firstname"]
            lastname = request.form["lastname"]
            email = request.form["email"]
            username = request.form["username"]
            password = request.form["password"]
            
            mydb = connection.get_db_connection()
            cur = mydb.cursor()
            
            # Check if email already exists
            cur.execute("SELECT user_id, username FROM users WHERE email=%s", (email,))
            existing_user = cur.fetchone()
            
            if existing_user:
                cur.close()
                mydb.close()
                flash("This email is already registered. Please login instead.")
                return redirect(url_for("login"))
            
            # Check if username already exists
            cur.execute("SELECT user_id FROM users WHERE username=%s", (username,))
            existing_username = cur.fetchone()
            
            if existing_username:
                cur.close()
                mydb.close()
                return render_template("register.html", error="Username already taken. Please choose a different username.")
            
            hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

            session['register_data'] = {
                "firstname": firstname,
                "lastname": lastname,
                "email": email,
                "username": username,
                "password": hashed_password,
            }

            token = secrets.token_urlsafe(32)
            expiry = datetime.datetime.utcnow() + datetime.timedelta(minutes=15)

            cur.execute("INSERT INTO verification_tokens (email,token,expiry) VALUES (%s,%s,%s)",(email,token,expiry))
            mydb.commit()
            cur.close()
            mydb.close()
            
            APP_URL = os.getenv("APP_URL")
            link = f"{APP_URL}/verify/{token}"
            validators.send_verification_email(email, link)

            return redirect(url_for("check_email"))
    except Exception as e:
            app.logger.error(f"Error during register: {str(e)}")
            flash("An unexpected error occurred while registering. Please try again.")
            
            session.pop('register_data', None)
            return render_template("register.html"), 500

    return render_template("register.html")

@app.route("/confirmation",methods=["GET","POST"])
def confirmation():
    try:
        if request.method == "POST":
            return redirect(url_for("login"))
        return render_template("confirmation.html")
    except Exception as e:
        app.logger.error(f"Error in confirmation route: {str(e)}")
        flash("Something went wrong while loading the confirmation page.")
        return "<h1>Error loading confirmation page. Please try again later.</h1>", 500

@app.route('/complete_profile',methods=["GET","POST"])
@validators.login_required
def complete_profile():
    mydb = None
    cur = None
    try:
        cutoff_date = datetime.datetime.utcnow().date().replace(year=datetime.datetime.utcnow().year - 16)
        cities = utils.load_cities()
        if request.method == "POST":
            # Personal Information
            first_name = request.form.get("first_name", "")
            last_name = request.form.get("last_name", "")
            dob = request.form["dob"]
            
            # Education Information
            uni_name = request.form["uni_name"]
            clg_name = request.form.get("clg_name", "")
            degree = request.form.get("degree", "")
            major = request.form.get("major", "")
            grad_year = request.form["grad_year"]
            gpa = request.form.get("gpa", "")
            
            # Location
            city = request.form["city"]
            
            # Work Experience
            company = request.form.get("company", "")
            job_title = request.form.get("job_title", "")
            join_year = request.form.get("join_year", "")
            leave_year = request.form.get("leave_year", "")
            
            # Skills and Interests
            skills = request.form.get("skills", "")
            interests = request.form.get("interests", "")
            
            # Social Links
            linkedin = request.form.get("linkedin", "")
            github = request.form.get("github", "")
            twitter = request.form.get("twitter", "")
            website = request.form.get("website", "")
            
            # Privacy Settings
            profile_visibility = request.form.get("profile_visibility", "")
            email_notifications = request.form.get("email_notifications", "")
            job_alerts = request.form.get("job_alerts", "")

            # Handle profile picture upload
            pfp_file = request.files.get("pfp")
            pfp_url = None
            if pfp_file and validators.allowed_file(pfp_file.filename):
                pfp_url = utils.upload_to_imgbb(pfp_file, os.getenv("PFP_API"))
            
            # Validate age
            dob_date = datetime.datetime.strptime(dob, "%Y-%m-%d").date()
            today = datetime.date.today()
            age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
            
            if age < 16:
                return render_template("complete_profile.html",cities=cities,error="You must be atleast 16")

            mydb = get_db_connection()
            cur = mydb.cursor()
            user_id = session.get('user_id')

            # Update users table with basic info
            cur.execute("""
                UPDATE users SET 
                    firstname=%s, lastname=%s, dob=%s,
                    university_name=%s, college=%s, graduation_year=%s, current_city=%s, 
                    pfp_path=%s
                WHERE user_id=%s
            """, (first_name, last_name, dob, uni_name, clg_name, grad_year, city, 
                  pfp_url, user_id))

            # Insert education details if provided
            if degree or major or gpa:
                # Check if education record exists
                cur.execute("SELECT COUNT(*) FROM education_details WHERE user_id = %s", (user_id,))
                if cur.fetchone()[0] > 0:
                    # Update existing record
                    cur.execute("""
                        UPDATE education_details SET 
                            degree_type=%s, major=%s, university_name=%s, college_name=%s, 
                            graduation_year=%s, gpa=%s
                        WHERE user_id=%s
                    """, (degree, major, uni_name, clg_name, grad_year, 
                          float(gpa) if gpa else None, user_id))
                else:
                    # Insert new record
                    cur.execute("""
                        INSERT INTO education_details 
                        (user_id, degree_type, major, university_name, college_name, graduation_year, gpa)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (user_id, degree, major, uni_name, clg_name, grad_year, 
                          float(gpa) if gpa else None))

            # Insert work experience if provided (and not "None" or empty)
            if company and company.lower() not in ['none', 'n/a', ''] and job_title:
                # Check if work experience record exists
                cur.execute("SELECT COUNT(*) FROM work_experience WHERE user_id = %s", (user_id,))
                if cur.fetchone()[0] > 0:
                    # Update existing record
                    cur.execute("""
                        UPDATE work_experience SET 
                            company_name=%s, job_title=%s, join_year=%s, leave_year=%s
                        WHERE user_id=%s
                    """, (company, job_title, 
                          int(join_year) if join_year else None,
                          int(leave_year) if leave_year else None, user_id))
                else:
                    # Insert new record
                    cur.execute("""
                        INSERT INTO work_experience 
                        (user_id, company_name, job_title, join_year, leave_year)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (user_id, company, job_title, 
                          int(join_year) if join_year else None,
                          int(leave_year) if leave_year else None))

            # Update session with new profile picture and name
            if pfp_url:
                session['pfp_path'] = pfp_url
            if first_name and last_name:
                session['username'] = f"{first_name} {last_name}"

            mydb.commit()
            return redirect(url_for("interests"))
        return render_template('complete_profile.html',cities=cities,cutoff_date=cutoff_date)
    except Exception as e:
            app.logger.error(f"Error during register: {str(e)}")
            flash("An unexpected error occurred while registering. Please try again.")
            session.pop('register_data', None)
            return render_template("register.html"), 500
    finally:
        if cur is not None:
            cur.close()
        if mydb is not None:
            mydb.close()

        

@app.route("/check_email")
def check_email():
    try:
        return render_template("check_email.html")
    except Exception as e:
        app.logger.error(f"Error in check_email route: {str(e)}")
        flash("Unable to load the check email page.")
        return "<h1>Error loading page. Please try again later.</h1>", 500

@app.route("/verify/<token>")
def verify(token):
    mydb = None
    cur = None
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()

        cur.execute("SELECT * FROM verification_tokens where token=%s",(token,))
        row = cur.fetchone()
        
        if not row:
            return render_template("token_invalid.html")

        id, email, db_token, expiry = row

        if datetime.datetime.utcnow() > expiry:
            return render_template("token_expired.html")
        
        register_data = session.get("register_data")

        if not register_data:
            return redirect(url_for("register"))
        cur.execute("""
            insert into users (firstname, lastname, email, username, password,verified)
            values (%s, %s, %s, %s, %s, %s)
        """, (
            register_data['firstname'],
            register_data['lastname'],
            register_data['email'],
            register_data['username'],
            register_data['password'],
            True
        ))
        
        cur.execute("delete from verification_tokens WHERE token=%s",(token,))
        mydb.commit()
        session.pop("register_data",None)
        return redirect(url_for("confirmation"))


    except Exception as e:
        app.logger.error(f"Error verifying token: {str(e)}")
        flash("We couldn’t verify your account. Please try again.")
        return redirect(url_for("register"))
    finally:
        if cur is not None:
            cur.close()
        if mydb is not None:
            mydb.close()

    
@app.route("/interests",methods=["GET","POST"])
@validators.login_required
def interests():
    mydb = None
    cur = None
    try:
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        cur.execute("SELECT interest_id, name FROM interests ORDER BY name")
        db_interests = cur.fetchall()
        
        if request.method == "POST":
            selected_interests = request.form.getlist('interests')
            user_id = session['user_id']

            cur.execute("DELETE FROM user_interests where user_id=%s",(user_id,))

            for interest_id in selected_interests:
                cur.execute("INSERT INTO user_interests (user_id,interest_id) VALUES (%s,%s) ",(user_id,interest_id))
            mydb.commit()
           

            return redirect(url_for("dashboard"))
        return render_template("interests.html",db_interests=db_interests)
    
    except Exception as e:
        app.logger.error(f"Error updating interests: {str(e)}")
        flash("There was an error saving your interests.")
        return redirect(url_for("home"))
    finally:
        if cur is not None:
            cur.close()
        if mydb is not None:
            mydb.close()
  
@app.route('/contact', methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        full_name = request.form.get("full_name")
        email = request.form.get("email")
        phone = request.form.get("phone")
        subject = request.form.get("subject")
        message = request.form.get("message")
        mydb = None
        cur = None
        try:

            mydb = get_db_connection()
            cur = mydb.cursor()
            cur.execute("INSERT INTO contacts (full_name, email, phone, subject_, message_)VALUES (%s, %s, %s, %s, %s)", (full_name, email, phone,subject, message))
            mydb.commit()
            flash("Your message has been sent. Thank you!")
            return render_template("contact.html")
        except Exception as e:
            app.logger.error(f"Error saving contact message: {str(e)}")
            flash("Could not send your message. Please try again later.")
            return render_template("contact.html")

        finally:
            if cur is not None:
                cur.close()
            if mydb is not None:
                mydb.close()

    return render_template("contact.html")

@app.route("/thanks", methods=["GET","POST"])
@validators.login_required
def thanks():
    if request.method == "POST":
        return redirect(url_for("home"))
    return render_template("thanks.html")


@app.route("/user_dashboard", methods=["GET", "POST"])
@validators.login_required
def user_dashboard():
    user_id = session['user_id']

    mydb = get_db_connection()
    cur = mydb.cursor()
    cur.execute("SELECT username, role, pfp_path FROM users WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    cur.close()
    mydb.close()

    username, role, pfp_path = row

    return render_template("user_dashboard.html", username=username,role=role,pfp_path=pfp_path)


@app.route("/channels", methods=["GET","POST"])
@validators.login_required
def channels():
    return render_template("channels.html")


@app.route("/chat")
@app.route("/chat_list")
@validators.login_required
def chat_list():
    user_id = session['user_id']
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        
        cur.execute("""
            SELECT DISTINCT 
                CASE 
                    WHEN m.sender_id = %s THEN m.receiver_id 
                    ELSE m.sender_id 
                END as other_user_id
            FROM messages m
            WHERE m.sender_id = %s OR m.receiver_id = %s
        """, (user_id, user_id, user_id))
        
        user_ids = cur.fetchall()
        chat_history = []
        
        
        for (other_user_id,) in user_ids:
            
            cur.execute("SELECT username, pfp_path FROM users WHERE user_id = %s", (other_user_id,))
            user_data = cur.fetchone()
            
            if user_data:
                username, pfp_path = user_data
                
                
                cur.execute("""
                    SELECT content, created_at 
                    FROM messages 
                    WHERE (sender_id = %s AND receiver_id = %s) 
                       OR (sender_id = %s AND receiver_id = %s)
                    ORDER BY created_at DESC 
                    LIMIT 1
                """, (user_id, other_user_id, other_user_id, user_id))
                
                message_data = cur.fetchone()
                last_message = message_data[0] if message_data else None
                last_message_time = message_data[1] if message_data else None
                
                chat_history.append((other_user_id, username, pfp_path, last_message, last_message_time))
        
        
        chat_history.sort(key=lambda x: x[4] if x[4] else datetime.datetime.min, reverse=True)
        
    except Exception as e:
        app.logger.error(f"Error in chat_list: {str(e)}")
        chat_history = []
    finally:
        cur.close()
        mydb.close()
    
    return render_template("chat_list.html", conversations=chat_history)

@app.route("/api/online_status")
@validators.login_required
def get_online_status():
    """Return list of currently online user IDs"""
    online_user_list = list(online_users.keys())
    print(f"API: Returning online users: {online_user_list}")
    return {'online_users': online_user_list}

@app.route("/api/upload_image", methods=["POST"])
@validators.login_required
def upload_image():
    """Upload image and return URL"""
    try:
        if 'image' not in request.files:
            return {'error': 'No image file provided'}, 400
        
        file = request.files['image']
        if file.filename == '':
            return {'error': 'No file selected'}, 400
        
        if file and file.content_type.startswith('image/'):
            
            
            import uuid
            import os
            
            
            file_extension = file.filename.rsplit('.', 1)[1].lower()
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            
            
            upload_dir = os.path.join(app.static_folder, 'uploads')
            os.makedirs(upload_dir, exist_ok=True)
            
            
            file_path = os.path.join(upload_dir, unique_filename)
            file.save(file_path)
            
            
            image_url = f"/static/uploads/{unique_filename}"
            return {'image_url': image_url}
        
        return {'error': 'Invalid file type'}, 400
        
    except Exception as e:
        app.logger.error(f"Error uploading image: {str(e)}")
        return {'error': 'Upload failed'}, 500

@app.route("/chat/<username>")
@validators.login_required
def chat(username):

    user_id = session['user_id']
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    
    cur.execute("SELECT user_id, username, pfp_path FROM users WHERE username=%s", (username,))
    other_user_row = cur.fetchone()
    if not other_user_row:
        flash("User not found")
        return redirect(url_for('user_dashboard'))
    
    other_user_id, other_user_name, other_user_pfp = other_user_row
    
    
    cur.execute("""
        SELECT m.sender_id, m.receiver_id, m.content, m.created_at, u.username
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE (m.sender_id=%s AND m.receiver_id=%s) OR (m.sender_id=%s AND m.receiver_id=%s)
        ORDER BY m.created_at
    """, (user_id, other_user_id, other_user_id, user_id))

    conversation = cur.fetchall()
    
    
    try:
        
        cur.execute("""
            SELECT DISTINCT 
                CASE 
                    WHEN m.sender_id = %s THEN m.receiver_id 
                    ELSE m.sender_id 
                END as other_user_id
            FROM messages m
            WHERE m.sender_id = %s OR m.receiver_id = %s
        """, (user_id, user_id, user_id))
        
        user_ids = cur.fetchall()
        chat_history = []
        
        
        for (chat_user_id,) in user_ids:
            
            cur.execute("SELECT username, pfp_path FROM users WHERE user_id = %s", (chat_user_id,))
            user_data = cur.fetchone()
            
            if user_data:
                chat_username, pfp_path = user_data
                
                
                cur.execute("""
                    SELECT content, created_at 
                    FROM messages 
                    WHERE (sender_id = %s AND receiver_id = %s) 
                       OR (sender_id = %s AND receiver_id = %s)
                    ORDER BY created_at DESC 
                    LIMIT 1
                """, (user_id, chat_user_id, chat_user_id, user_id))
                
                message_data = cur.fetchone()
                last_message = message_data[0] if message_data else None
                last_message_time = message_data[1] if message_data else None
                
                chat_history.append((chat_user_id, chat_username, pfp_path, last_message, last_message_time))
        
        
        chat_history.sort(key=lambda x: x[4] if x[4] else datetime.datetime.min, reverse=True)
        
    except Exception as e:
        app.logger.error(f"Error getting chat history in chat route: {str(e)}")
        chat_history = []
    cur.close()
    mydb.close()

    return render_template("chat.html", 
                         conversation=conversation, 
                         other_user_id=other_user_id or None, 
                         other_user_name=other_user_name or '', 
                         other_user_pfp=other_user_pfp or '',
                         chat_history=chat_history or [],
                         current_user_id=user_id or None)


online_users = {}

@socketio.on('connect')
def handle_connect():
    print(f"User connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"User disconnected: {request.sid}")
    
    user_id_to_remove = None
    for user_id, sid in online_users.items():
        if sid == request.sid:
            user_id_to_remove = user_id
            break
    
    if user_id_to_remove:
        del online_users[user_id_to_remove]
        
        emit('user_status_changed', {
            'user_id': user_id_to_remove,
            'is_online': False
        }, broadcast=True)

@socketio.on('user_online')
def handle_user_online(data):
    user_id = data.get('user_id')
    if user_id:
        online_users[user_id] = request.sid
        
        emit('user_status_changed', {
            'user_id': user_id,
            'is_online': True
        }, broadcast=True)
        print(f"User {user_id} is now online. Total online users: {len(online_users)}")
        print(f"Online users: {list(online_users.keys())}")

@socketio.on('join')
def handle_join(data):
    room = utils.get_room_id(data['user1'], data['user2'])
    join_room(room)
    
    
    user_id = data.get('user1')  
    if user_id:
        online_users[user_id] = request.sid

@socketio.on('send_message')
def handle_send_message(data):
    print(f"📨 Received send_message: {data}")
    
    # Validate required fields
    if not data.get('sender_id') or not data.get('receiver_id') or not data.get('message'):
        print(f"❌ Invalid message data: {data}")
        return {'status': 'error', 'message': 'Missing required fields'}
    
    message_content = data['message'].strip()
    if not message_content:
        print("❌ Empty message content")
        return {'status': 'error', 'message': 'Message cannot be empty'}
    
    room = utils.get_room_id(data['sender_id'], data['receiver_id'])
    print(f"🏠 Using room: {room}")
    
    mydb = get_db_connection()
    cur = mydb.cursor()
    try:
        # Insert message into database
        cur.execute(
            "INSERT INTO messages (sender_id, receiver_id, content) VALUES (%s,%s,%s)",
            (data['sender_id'], data['receiver_id'], message_content)
        )
        mydb.commit()
        message_id = cur.lastrowid
        print(f"💾 Message saved with ID: {message_id}")

        # Get sender info
        cur.execute("SELECT username, pfp_path FROM users WHERE user_id=%s", (data['sender_id'],))
        row = cur.fetchone()
        sender_username = row[0] if row else f"User {data['sender_id']}"
        sender_pfp = row[1] if row and row[1] else None
        print(f"👤 Sender info: {sender_username}, {sender_pfp}")

        enriched = {
            'sender_id': data['sender_id'],
            'receiver_id': data['receiver_id'],
            'content': message_content,  # Frontend expects 'content'
            'message': message_content,  # Keep both for compatibility
            'client_message_id': data.get('client_message_id'),
            'sender_username': sender_username,
            'sender_pfp': sender_pfp,
            'message_id': message_id,
        }
        
        print(f"📤 Emitting to room {room}: {enriched}")
        emit('receive_message', enriched, room=room)
        
        return {'status': 'ok', 'message_id': message_id}
        
    except Exception as e:
        print(f"🔥 Error in send_message: {str(e)}")
        mydb.rollback()
        return {'status': 'error', 'message': str(e)}
    finally:
        cur.close()
        mydb.close()

@socketio.on('typing')
def handle_typing(data):
    """Notify the other participant that the user is typing."""
    try:
        room = utils.get_room_id(data['user_id'], data['receiver_id'])
        emit('user_typing', {'user_id': data['user_id']}, room=room, include_self=False)
    except Exception:
        pass

@socketio.on('stop_typing')
def handle_stop_typing(data):
    """Notify the other participant that the user stopped typing."""
    try:
        room = utils.get_room_id(data['user_id'], data['receiver_id'])
        emit('user_stopped_typing', {'user_id': data['user_id']}, room=room, include_self=False)
    except Exception:
        pass

@app.route("/profile")
@validators.login_required
def profile_redirect():
    return redirect(url_for("profile", username=session["username"]))


@app.route("/profile/<username>")
@validators.login_required
def profile(username):
    mydb = None
    cur = None
    try:
        mydb = get_db_connection()
        cur = mydb.cursor()
        user_id = session.get('user_id')
        
        cur.execute("""
            SELECT user_id, firstname, lastname, email, username, dob, graduation_year, 
                   university_name, department, college, current_city, pfp_path, 
                   registration_date, role, enrollment_number, community_id, last_login, login_count
            FROM users 
            WHERE username = %s OR user_id = %s
        """, (username, user_id))
        
        user_data = cur.fetchone()
        if not user_data:
            flash("User not found")
            return redirect(url_for('home'))
        
        
        cur.execute("""
            SELECT i.name 
            FROM interests i
            JOIN user_interests ui ON i.interest_id = ui.interest_id
            WHERE ui.user_id = %s
        """, (user_data[0],))
        
        user_interests = [row[0] for row in cur.fetchall()]
        
        
        cur.execute("""
            SELECT degree_type, university_name, college_name, major, graduation_year
            FROM education_details 
            WHERE user_id = %s
        """, (user_data[0],))
        
        education_data = cur.fetchone()
        
        
        cur.execute("""
            SELECT company_name, job_title, join_year, leave_year
            FROM work_experience 
            WHERE user_id = %s
            ORDER BY join_year DESC
        """, (user_data[0],))
        
        work_experience = cur.fetchall()
        
        
        cur.execute("""
            SELECT COUNT(*) 
            FROM connections 
            WHERE (user_id = %s OR con_user_id = %s) AND status = 'accepted'
        """, (user_data[0], user_data[0]))
        
        connections_count = cur.fetchone()[0]
        
        
        community_name = None
        if user_data[15]:  
            cur.execute("SELECT name FROM communities WHERE community_id = %s", (user_data[15],))
            community_result = cur.fetchone()
            if community_result:
                community_name = community_result[0]
        
        return render_template("profile.html", 
                             user_data=user_data,
                             user_interests=user_interests,
                             education_data=education_data,
                             work_experience=work_experience,
                             connections_count=connections_count,
                             community_name=community_name)
    
    except Exception as e:
        app.logger.error(f"Error fetching profile data: {str(e)}")
        flash("Error loading profile data")
        return redirect(url_for('home'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
            mydb.close()

@app.route('/verification_request', methods=['GET', 'POST'])
@login_required
def verification_request():
    """Handle verification requests from users"""
    try:
        user_id = session['user_id']
        
        # Check if user already has a pending request
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        cur.execute("""
            SELECT vr.request_id, vr.status, vr.created_at, vr.review_notes, c.name, vr.requested_role
            FROM verification_requests vr
            JOIN communities c ON vr.community_id = c.community_id
            WHERE vr.user_id = %s AND vr.status IN ('pending', 'approved')
            ORDER BY vr.created_at DESC LIMIT 1
        """, (user_id,))
        
        current_request = cur.fetchone()
        current_request_data = None
        
        if current_request:
            current_request_data = {
                'request_id': current_request[0],
                'status': current_request[1],
                'created_at': current_request[2],
                'review_notes': current_request[3],
                'college_name': current_request[4],
                'requested_role': current_request[5]
            }
        
        if request.method == 'POST':
            community_id = request.form.get('community_id')
            requested_role = request.form.get('requested_role')
            student_id = request.form.get('student_id')
            graduation_year = request.form.get('graduation_year')
            department = request.form.get('department')
            request_message = request.form.get('request_message')
            
            success, message = submit_verification_request(
                user_id, community_id, requested_role, student_id,
                graduation_year, department, request_message
            )
            
            if success:
                flash(message, 'success')
                return redirect(url_for('verification_request'))
            else:
                flash(message, 'error')
        
        communities = get_communities()
        
        return render_template('verification_request.html', 
                             communities=communities, 
                             current_request=current_request_data)
        
    except Exception as e:
        app.logger.error(f"Error in verification_request: {str(e)}")
        flash("An error occurred. Please try again.", 'error')
        return redirect(url_for('user_dashboard'))
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route('/admin_dashboard', methods=['GET', 'POST'])
@admin_required
def admin_dashboard():
    """Admin dashboard for managing verification requests"""
    try:
        user_id = session['user_id']
        
        if request.method == 'POST':
            request_id = request.form.get('request_id')
            action = request.form.get('action')
            review_notes = request.form.get('review_notes')
            
            if action == 'approve':
                success, message = approve_verification_request(request_id, user_id, review_notes)
            elif action == 'reject':
                success, message = reject_verification_request(request_id, user_id, review_notes)
            else:
                success, message = False, "Invalid action"
            
            if success:
                flash(message, 'success')
            else:
                flash(message, 'error')
            
            return redirect(url_for('admin_dashboard'))
        
        # Get pending requests for this admin
        pending_requests = get_pending_verification_requests(user_id)
        
        # Get stats
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Count pending requests
        cur.execute("""
            SELECT COUNT(*) FROM verification_requests vr
            JOIN admin_permissions ap ON vr.community_id = ap.community_id
            WHERE ap.admin_user_id = %s AND ap.is_active = TRUE AND vr.status = 'pending'
        """, (user_id,))
        pending_count = cur.fetchone()[0]
        
        # Count total verified users
        cur.execute("""
            SELECT COUNT(*) FROM users u
            JOIN admin_permissions ap ON u.community_id = ap.community_id
            WHERE ap.admin_user_id = %s AND ap.is_active = TRUE 
            AND u.role IN ('student', 'alumni')
        """, (user_id,))
        total_verified = cur.fetchone()[0]
        
        return render_template('admin_dashboard.html',
                             pending_requests=pending_requests,
                             pending_count=pending_count,
                             total_verified=total_verified)
        
    except Exception as e:
        app.logger.error(f"Error in admin_dashboard: {str(e)}")
        flash("An error occurred loading the admin dashboard.", 'error')
        return redirect(url_for('user_dashboard'))
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route('/user_role_info')
@login_required
def user_role_info():
    """API endpoint to get user role information"""
    try:
        user_id = session['user_id']
        role_info = get_user_role_info(user_id)
        
        if role_info:
            return {
                'success': True,
                'role': role_info['role'],
                'college_name': role_info['college_name'],
                'verification_status': role_info['verification_status'],
                'is_verified': role_info['role'] in ['student', 'alumni', 'admin']
            }
        else:
            return {'success': False, 'message': 'User not found'}
            
    except Exception as e:
        app.logger.error(f"Error in user_role_info: {str(e)}")
        return {'success': False, 'message': 'Error retrieving user information'}

@app.route('/check_community_access/<int:community_id>')
@verified_user_required
def check_community_access(community_id):
    """Check if user has access to community features"""
    try:
        user_id = session['user_id']
        has_access = user_roles.can_access_community_features(user_id, community_id)
        
        return {'success': True, 'has_access': has_access}
        
    except Exception as e:
        app.logger.error(f"Error in check_college_access: {str(e)}")
        return {'success': False, 'message': 'Error checking access'}

@app.route("/recommendations")
@validators.login_required
def recommendations():
    return render_template("recommendations.html")

@app.route("/requests")
@validators.login_required
def requests():
    """Requests page - manage connection requests"""
    user_id = session['user_id']
    mydb = None
    cur = None
    
    try:
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Get current user info
        cur.execute("SELECT username, firstname, lastname, role, pfp_path FROM users WHERE user_id = %s", (user_id,))
        current_user = cur.fetchone()
        
        # Get pending incoming requests (where current user is the target)
        cur.execute("""
            SELECT c.connection_id, c.user_id, c.request, c.created_at,
                   u.firstname, u.lastname, u.username, u.pfp_path
            FROM connections c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.con_user_id = %s AND c.status = 'pending'
            ORDER BY c.created_at DESC
        """, (user_id,))
        
        pending_requests = []
        for row in cur.fetchall():
            pending_requests.append({
                'connection_id': row[0],
                'user_id': row[1],
                'message': row[2],
                'created_at': row[3],
                'name': f"{row[4]} {row[5]}",
                'username': row[6],
                'avatar': row[7]
            })
        
        # Get sent requests (where current user is the sender)
        cur.execute("""
            SELECT c.connection_id, c.con_user_id, c.request, c.created_at,
                   u.firstname, u.lastname, u.username, u.pfp_path
            FROM connections c
            JOIN users u ON c.con_user_id = u.user_id
            WHERE c.user_id = %s AND c.status = 'pending'
            ORDER BY c.created_at DESC
        """, (user_id,))
        
        sent_requests = []
        for row in cur.fetchall():
            sent_requests.append({
                'connection_id': row[0],
                'user_id': row[1],
                'message': row[2],
                'created_at': row[3],
                'name': f"{row[4]} {row[5]}",
                'username': row[6],
                'avatar': row[7]
            })
        
        # Get accepted connections
        cur.execute("""
            SELECT DISTINCT
                CASE 
                    WHEN c.user_id = %s THEN c.con_user_id 
                    ELSE c.user_id 
                END as other_user_id,
                CASE 
                    WHEN c.user_id = %s THEN u2.firstname 
                    ELSE u1.firstname 
                END as firstname,
                CASE 
                    WHEN c.user_id = %s THEN u2.lastname 
                    ELSE u1.lastname 
                END as lastname,
                CASE 
                    WHEN c.user_id = %s THEN u2.username 
                    ELSE u1.username 
                END as username,
                CASE 
                    WHEN c.user_id = %s THEN u2.pfp_path 
                    ELSE u1.pfp_path 
                END as avatar,
                c.created_at
            FROM connections c
            JOIN users u1 ON c.user_id = u1.user_id
            JOIN users u2 ON c.con_user_id = u2.user_id
            WHERE (c.user_id = %s OR c.con_user_id = %s) AND c.status = 'accepted'
            ORDER BY c.created_at DESC
        """, (user_id, user_id, user_id, user_id, user_id, user_id, user_id))
        
        connections = []
        for row in cur.fetchall():
            connections.append({
                'user_id': row[0],
                'name': f"{row[1]} {row[2]}",
                'username': row[3],
                'avatar': row[4],
                'connected_at': row[5]
            })
        
        connections_count = len(connections)
        
        return render_template("requests.html",
                             pending_requests=pending_requests,
                             sent_requests=sent_requests,
                             connections=connections,
                             connections_count=connections_count,
                             current_user=current_user)
        
    except Exception as e:
        app.logger.error(f"Error in requests route: {str(e)}")
        flash("Error loading requests page")
        return redirect(url_for('user_dashboard'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
            mydb.close()

@app.route("/connect")
@validators.login_required
def connect():
    """Connect page - show alumni for networking"""
    user_id = session['user_id']
    mydb = None
    cur = None
    
    try:
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Get current user info
        cur.execute("SELECT username, firstname, lastname, role, pfp_path, university_name, graduation_year, current_city FROM users WHERE user_id = %s", (user_id,))
        current_user = cur.fetchone()
        
        # Get all users except current user with their details
        cur.execute("""
            SELECT u.user_id, u.firstname, u.lastname, u.username, u.university_name, 
                   u.graduation_year, u.current_city, u.pfp_path, u.role,
                   we.company_name, we.job_title,
                   STRING_AGG(i.name, ', ') as interests
            FROM users u
            LEFT JOIN work_experience we ON u.user_id = we.user_id AND we.leave_year IS NULL
            LEFT JOIN user_interests ui ON u.user_id = ui.user_id
            LEFT JOIN interests i ON ui.interest_id = i.interest_id
            WHERE u.user_id != %s AND u.verified = TRUE
            GROUP BY u.user_id, u.firstname, u.lastname, u.username, u.university_name, 
                     u.graduation_year, u.current_city, u.pfp_path, u.role,
                     we.company_name, we.job_title
            ORDER BY u.lastname, u.firstname
        """, (user_id,))
        
        all_users = cur.fetchall()
        
        # Get existing connections for current user
        cur.execute("""
            SELECT con_user_id, status, connection_id FROM connections 
            WHERE user_id = %s
        """, (user_id,))
        
        connections = {row[0]: {'status': row[1], 'connection_id': row[2]} for row in cur.fetchall()}
        
        # Get reverse connections (where current user is the target)
        cur.execute("""
            SELECT user_id, status, connection_id FROM connections 
            WHERE con_user_id = %s
        """, (user_id,))
        
        reverse_connections = {row[0]: {'status': row[1], 'connection_id': row[2]} for row in cur.fetchall()}
        
        # Process users data
        people_data = []
        for user in all_users:
            # Generate default avatar if none exists
            name = f"{user[1]} {user[2]}"
            avatar = user[7] if user[7] else generate_default_avatar(name)
            
            user_data = {
                'id': user[0],
                'name': name,
                'username': user[3],
                'university': user[4] or 'Not specified',
                'graduation_year': user[5] or 'Not specified',
                'location': user[6] or 'Not specified',
                'avatar': avatar,
                'role': user[8] or 'unverified',
                'company': user[9] or 'Not specified',
                'title': user[10] or 'Not specified',
                'interests': user[11].split(', ') if user[11] else [],
                'connection_status': 'none'
            }
            
            # Determine connection status
            if user[0] in connections:
                user_data['connection_status'] = connections[user[0]]['status']
                user_data['connection_id'] = connections[user[0]]['connection_id']
            elif user[0] in reverse_connections:
                if reverse_connections[user[0]]['status'] == 'accepted':
                    user_data['connection_status'] = 'connected'
                elif reverse_connections[user[0]]['status'] == 'pending':
                    user_data['connection_status'] = 'received_request'
                    user_data['connection_id'] = reverse_connections[user[0]]['connection_id']
            
            people_data.append(user_data)
        
        # Get unique universities, graduation years, and locations for filters
        universities = list(set([user['university'] for user in people_data if user['university'] != 'Not specified']))
        graduation_years = list(set([str(user['graduation_year']) for user in people_data if user['graduation_year'] != 'Not specified']))
        locations = list(set([user['location'] for user in people_data if user['location'] != 'Not specified']))
        
        # Sort the filter options
        universities.sort()
        graduation_years.sort(reverse=True)
        locations.sort()
        
        return render_template("connect.html", 
                             people=people_data,
                             universities=universities,
                             graduation_years=graduation_years,
                             locations=locations,
                             current_user=current_user)
        
    except Exception as e:
        app.logger.error(f"Error in connect route: {str(e)}")
        flash("Error loading connections page")
        return redirect(url_for('user_dashboard'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
            mydb.close()

@app.route("/api/send_connection_request", methods=["POST"])
@validators.login_required
def send_connection_request():
    """Send a connection request to another user"""
    try:
        data = request.get_json()
        target_user_id = data.get('user_id')
        message = data.get('message', '')
        
        if not target_user_id:
            return {'success': False, 'message': 'User ID is required'}, 400
        
        user_id = session['user_id']
        
        # Check if trying to connect to self
        if user_id == target_user_id:
            return {'success': False, 'message': 'Cannot connect to yourself'}, 400
        
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Check if connection already exists
        cur.execute("""
            SELECT connection_id, status FROM connections 
            WHERE (user_id = %s AND con_user_id = %s) OR (user_id = %s AND con_user_id = %s)
        """, (user_id, target_user_id, target_user_id, user_id))
        
        existing_connection = cur.fetchone()
        
        if existing_connection:
            status = existing_connection[1]
            if status == 'accepted':
                return {'success': False, 'message': 'Already connected'}, 400
            elif status == 'pending':
                return {'success': False, 'message': 'Connection request already sent'}, 400
        
        # Insert new connection request
        cur.execute("""
            INSERT INTO connections (user_id, con_user_id, request, status)
            VALUES (%s, %s, %s, 'pending')
        """, (user_id, target_user_id, message))
        
        mydb.commit()
        
        # Get target user info for response
        cur.execute("SELECT firstname, lastname FROM users WHERE user_id = %s", (target_user_id,))
        target_user = cur.fetchone()
        target_name = f"{target_user[0]} {target_user[1]}" if target_user else "User"
        
        return {
            'success': True, 
            'message': f'Connection request sent to {target_name}',
            'status': 'pending'
        }
        
    except Exception as e:
        app.logger.error(f"Error sending connection request: {str(e)}")
        return {'success': False, 'message': 'Error sending connection request'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/respond_connection_request", methods=["POST"])
@validators.login_required
def respond_connection_request():
    """Accept or reject a connection request"""
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        action = data.get('action')  # 'accept' or 'reject'
        
        if not connection_id or action not in ['accept', 'reject']:
            return {'success': False, 'message': 'Invalid request'}, 400
        
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Verify the connection request exists and is for current user
        cur.execute("""
            SELECT user_id, con_user_id, status FROM connections 
            WHERE connection_id = %s AND con_user_id = %s AND status = 'pending'
        """, (connection_id, user_id))
        
        connection = cur.fetchone()
        
        if not connection:
            return {'success': False, 'message': 'Connection request not found'}, 404
        
        # Update connection status
        new_status = 'accepted' if action == 'accept' else 'denied'
        cur.execute("""
            UPDATE connections SET status = %s WHERE connection_id = %s
        """, (new_status, connection_id))
        
        mydb.commit()
        
        return {
            'success': True,
            'message': f'Connection request {action}ed',
            'status': new_status
        }
        
    except Exception as e:
        app.logger.error(f"Error responding to connection request: {str(e)}")
        return {'success': False, 'message': 'Error processing request'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/get_connection_requests")
@validators.login_required
def get_connection_requests():
    """Get pending connection requests for current user"""
    try:
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Get pending requests where current user is the target
        cur.execute("""
            SELECT c.connection_id, c.user_id, c.request, c.created_at,
                   u.firstname, u.lastname, u.username, u.pfp_path
            FROM connections c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.con_user_id = %s AND c.status = 'pending'
            ORDER BY c.created_at DESC
        """, (user_id,))
        
        requests = []
        for row in cur.fetchall():
            requests.append({
                'connection_id': row[0],
                'user_id': row[1],
                'message': row[2],
                'created_at': row[3].isoformat() if row[3] else None,
                'name': f"{row[4]} {row[5]}",
                'username': row[6],
                'avatar': row[7]
            })
        
        return {'success': True, 'requests': requests}
        
    except Exception as e:
        app.logger.error(f"Error getting connection requests: {str(e)}")
        return {'success': False, 'message': 'Error loading requests'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/cancel_connection_request", methods=["POST"])
@validators.login_required
def cancel_connection_request():
    """Cancel a sent connection request"""
    try:
        data = request.get_json()
        connection_id = data.get('connection_id')
        
        if not connection_id:
            return {'success': False, 'message': 'Connection ID is required'}, 400
        
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Verify the connection request exists and belongs to current user
        cur.execute("""
            SELECT user_id, con_user_id, status FROM connections 
            WHERE connection_id = %s AND user_id = %s AND status = 'pending'
        """, (connection_id, user_id))
        
        connection = cur.fetchone()
        
        if not connection:
            return {'success': False, 'message': 'Connection request not found'}, 404
        
        # Delete the connection request
        cur.execute("""
            DELETE FROM connections WHERE connection_id = %s
        """, (connection_id,))
        
        mydb.commit()
        
        return {
            'success': True,
            'message': 'Connection request cancelled successfully'
        }
        
    except Exception as e:
        app.logger.error(f"Error cancelling connection request: {str(e)}")
        return {'success': False, 'message': 'Error cancelling request'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/settings")
@validators.login_required
def settings():
    """User settings page"""
    try:
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Get comprehensive user data for settings (matching actual schema)
        cur.execute("""
            SELECT user_id, firstname, lastname, email, username, dob,
                   university_name, department, college, graduation_year, current_city, 
                   pfp_path, role, community_id, last_login, login_count
            FROM users 
            WHERE user_id = %s
        """, (user_id,))
        
        user_data = cur.fetchone()
        
        if user_data:
            user_dict = {
                'user_id': user_data[0],
                'firstname': user_data[1],
                'lastname': user_data[2],
                'email': user_data[3],
                'username': user_data[4],
                'dob': user_data[5],
                'university_name': user_data[6],
                'department': user_data[7],
                'college': user_data[8],
                'graduation_year': user_data[9],
                'current_city': user_data[10],
                'pfp_path': user_data[11],
                'role': user_data[12],
                'community_id': user_data[13],
                'last_login': user_data[14],
                'login_count': user_data[15],
                # Default values for settings not in database
                'phone': '',
                'bio': '',
                'profile_visibility': 'public',
                'email_notifications': True,
                'job_alerts': True,
                'linkedin': '',
                'github': '',
                'twitter': '',
                'website': '',
                'show_email': False,
                'show_phone': False,
                'allow_messages': True
            }
        else:
            user_dict = {}
        
        return render_template("settings.html", user_data=user_dict)
        
    except Exception as e:
        app.logger.error(f"Error loading settings: {str(e)}")
        flash("Error loading settings page")
        return redirect(url_for('user_dashboard'))
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/update_account", methods=["POST"])
@validators.login_required
def update_account():
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Check if username is already taken by another user
        if data.get('username'):
            cur.execute("SELECT user_id FROM users WHERE username = %s AND user_id != %s", 
                       (data['username'], user_id))
            if cur.fetchone():
                return {'success': False, 'message': 'Username already taken'}, 400
        
        # Update user information (only existing columns)
        update_fields = []
        update_values = []
        
        if data.get('username'):
            update_fields.append("username = %s")
            update_values.append(data['username'])
            
        if data.get('firstName'):
            update_fields.append("firstname = %s")
            update_values.append(data['firstName'])
            
        if data.get('lastName'):
            update_fields.append("lastname = %s")
            update_values.append(data['lastName'])
            
        if data.get('university'):
            update_fields.append("university_name = %s")
            update_values.append(data['university'])
            
        if data.get('department'):
            update_fields.append("department = %s")
            update_values.append(data['department'])
            
        if data.get('college'):
            update_fields.append("college = %s")
            update_values.append(data['college'])
            
        if data.get('graduationYear'):
            update_fields.append("graduation_year = %s")
            update_values.append(data['graduationYear'])
            
        if data.get('currentCity'):
            update_fields.append("current_city = %s")
            update_values.append(data['currentCity'])
            
        
        if update_fields:
            update_values.append(user_id)
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE user_id = %s"
            cur.execute(query, update_values)
            mydb.commit()
            
            # Update session if username changed
            if data.get('username'):
                session['username'] = data['username']
        
        return {'success': True, 'message': 'Account updated successfully'}
    except Exception as e:
        app.logger.error(f"Error updating account: {str(e)}")
        return {'success': False, 'message': 'Error updating account'}, 500
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/update_privacy", methods=["POST"])
@validators.login_required
def update_privacy():
    """Update privacy settings"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Update privacy settings
        cur.execute("""
            UPDATE users SET 
                profile_visibility = %s
            WHERE user_id = %s
        """, (data.get('profileVisibility', 'public'), user_id))
        
        mydb.commit()
        
        return {'success': True, 'message': 'Privacy settings updated successfully'}
        
    except Exception as e:
        app.logger.error(f"Error updating privacy: {str(e)}")
        return {'success': False, 'message': 'Error updating privacy settings'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/update_preferences", methods=["POST"])
@validators.login_required
def update_preferences():
    """Update user preferences (client-side only for now)"""
    try:
        data = request.get_json()
        # Since we don't have preference columns in the database,
        # we'll just return success for client-side storage
        return {'success': True, 'message': 'Preferences updated successfully'}
    except Exception as e:
        app.logger.error(f"Error updating preferences: {str(e)}")
        return {'success': False, 'message': 'Error updating preferences'}, 500

@app.route("/api/update_notifications", methods=["POST"])
@validators.login_required
def update_notifications():
    """Update notification settings"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Update notification settings
        cur.execute("""
            UPDATE users SET 
                email_notifications = %s,
                job_alerts = %s
            WHERE user_id = %s
        """, (data.get('emailNotifications', False), 
              data.get('jobAlerts', False), 
              user_id))
        
        mydb.commit()
        
        return {'success': True, 'message': 'Notification settings updated successfully'}
        
    except Exception as e:
        app.logger.error(f"Error updating notifications: {str(e)}")
        return {'success': False, 'message': 'Error updating notification settings'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/change_password", methods=["POST"])
@validators.login_required
def change_password():
    """Change user password"""
    try:
        data = request.get_json()
        user_id = session['user_id']
        
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')
        
        if not current_password or not new_password:
            return {'success': False, 'message': 'Both current and new passwords are required'}, 400
        
        if len(new_password) < 8:
            return {'success': False, 'message': 'New password must be at least 8 characters long'}, 400
        
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Verify current password
        cur.execute("SELECT password FROM users WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        
        if not row or not bcrypt.check_password_hash(row[0], current_password):
            return {'success': False, 'message': 'Current password is incorrect'}, 400
        
        # Update password
        hashed_new_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
        cur.execute("UPDATE users SET password = %s WHERE user_id = %s", 
                   (hashed_new_password, user_id))
        mydb.commit()
        
        return {'success': True, 'message': 'Password changed successfully'}
        
    except Exception as e:
        app.logger.error(f"Error changing password: {str(e)}")
        return {'success': False, 'message': 'Error changing password'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()


@app.route("/api/export_data", methods=["POST"])
@validators.login_required
def export_data():
    """Export user data"""
    try:
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Get user data
        cur.execute("""
            SELECT firstname, lastname, email, username, dob,
                   university_name, college, graduation_year, current_city,
                   registration_date, role
            FROM users WHERE user_id = %s
        """, (user_id,))
        
        user_data = cur.fetchone()
        
        # Get connections
        cur.execute("""
            SELECT u.firstname, u.lastname, u.email, c.created_at
            FROM connections c
            JOIN users u ON (c.con_user_id = u.user_id OR c.user_id = u.user_id)
            WHERE (c.user_id = %s OR c.con_user_id = %s) 
            AND c.status = 'accepted' AND u.user_id != %s
        """, (user_id, user_id, user_id))
        
        connections = cur.fetchall()
        
        # Prepare export data
        export_data = {
            'user_info': {
                'firstname': user_data[0] if user_data else None,
                'lastname': user_data[1] if user_data else None,
                'email': user_data[2] if user_data else None,
                'username': user_data[3] if user_data else None,
                'dob': str(user_data[4]) if user_data and user_data[4] else None,
                'university': user_data[5] if user_data else None,
                'college': user_data[6] if user_data else None,
                'graduation_year': user_data[7] if user_data else None,
                'city': user_data[8] if user_data else None,
                'registration_date': str(user_data[9]) if user_data and user_data[9] else None,
                'role': user_data[10] if user_data else None
            },
            'connections': [
                {
                    'name': f"{conn[0]} {conn[1]}",
                    'email': conn[2],
                    'connected_date': str(conn[3]) if conn[3] else None
                } for conn in connections
            ],
            'export_date': datetime.datetime.utcnow().isoformat()
        }
        
        # Create JSON response
        import json
        json_data = json.dumps(export_data, indent=2)
        
        response = app.response_class(
            response=json_data,
            status=200,
            mimetype='application/json',
            headers={
                'Content-Disposition': 'attachment; filename=algo_data_export.json'
            }
        )
        
        return response
        
    except Exception as e:
        app.logger.error(f"Error exporting data: {str(e)}")
        return {'success': False, 'message': 'Error exporting data'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/deactivate_account", methods=["POST"])
@validators.login_required
def deactivate_account():
    """Deactivate user account"""
    try:
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Set account as deactivated (you might want to add a deactivated column)
        cur.execute("UPDATE users SET verified = FALSE WHERE user_id = %s", (user_id,))
        mydb.commit()
        
        # Clear session
        session.clear()
        
        return {'success': True, 'message': 'Account deactivated successfully'}
        
    except Exception as e:
        app.logger.error(f"Error deactivating account: {str(e)}")
        return {'success': False, 'message': 'Error deactivating account'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/delete_account", methods=["POST"])
@validators.login_required
def delete_account():
    """Delete user account permanently"""
    try:
        user_id = session['user_id']
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        # Delete user data (in a real app, you might want to anonymize instead of delete)
        cur.execute("DELETE FROM user_interests WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM connections WHERE user_id = %s OR con_user_id = %s", (user_id, user_id))
        cur.execute("DELETE FROM messages WHERE sender_id = %s OR receiver_id = %s", (user_id, user_id))
        cur.execute("DELETE FROM education_details WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM work_experience WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
        
        mydb.commit()
        
        # Clear session
        session.clear()
        
        return {'success': True, 'message': 'Account deleted successfully'}
        
    except Exception as e:
        app.logger.error(f"Error deleting account: {str(e)}")
        return {'success': False, 'message': 'Error deleting account'}, 500
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route("/api/logout_all_sessions", methods=["POST"])
@validators.login_required
def logout_all_sessions():
    """Logout from all sessions"""
    try:
        # In a real app, you would invalidate all session tokens
        # For now, just clear the current session
        session.clear()
        
        return {'success': True, 'message': 'Logged out from all sessions'}
        
    except Exception as e:
        app.logger.error(f"Error logging out sessions: {str(e)}")
        return {'success': False, 'message': 'Error logging out sessions'}, 500

@app.route("/logout")
def logout():
    """Logout user"""
    session.clear()
    flash("You have been logged out successfully")
    return redirect(url_for('home'))

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    
    socketio.run(app, host="0.0.0.0", port=port, debug=debug)
 
