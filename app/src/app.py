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
    get_user_role_info, get_colleges, submit_verification_request,
    get_pending_verification_requests, approve_verification_request,
    reject_verification_request, is_admin
)


app = Flask(__name__,template_folder="../templates",static_folder="../static")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="gevent",
    ping_timeout=30,
    ping_interval=25,
    logger=True,
    engineio_logger=True,
)

bcrypt = Bcrypt(app)
@app.context_processor
def inject_time_functions():
    return {
        'to_ist': utils.to_ist,
        'format_ist_time': utils.format_ist_time
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
                "SELECT user_id, password, login_count, username FROM users WHERE email=%s OR username=%s",
                (email_or_username, email_or_username)
            )
            row = cur.fetchone()

            if row:
                user_id, hashed_password, login_count, username = row
                if bcrypt.check_password_hash(hashed_password, password):
                    session['user_id'] = user_id
                    session['username'] = username

                    
                    cur.execute(
                        "UPDATE users SET last_login=%s, login_count=login_count+1 WHERE user_id=%s",
                        (datetime.datetime.utcnow(), user_id)
                    )
                    mydb.commit()

                    if login_count == 0:
                        return redirect(url_for("register"))  
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

            mydb = connection.get_db_connection()
            cur = mydb.cursor()

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
            
            session.pop('register_data')
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
            uni_name = request.form["uni-name"]
            clg_name = request.form["clg-name"]
            dob = request.form["dob"]
            grad_year = request.form["grad_year"]
            city = request.form["city"]

            pfp_file = request.files.get("pfp")
            pfp_url = None
            if pfp_file and validators.allowed_file(pfp_file.filename):
                pfp_url = utils.upload_to_imgbb(pfp_file, os.getenv("PFP_API"))
            
            dob_date = datetime.datetime.strptime(dob, "%Y-%m-%d").date()
            today = datetime.date.today()
            age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
            
            if age < 16:
                return render_template("complete_profile.html",cities=cities,error="You must be atleast 16")

            mydb = get_db_connection()
            cur = mydb.cursor()

            user_id = session.get('user_id')

            cur.execute("UPDATE users SET university_name=%s,college=%s,dob=%s,graduation_year=%s,current_city=%s,pfp_path=%s WHERE user_id=%s",(uni_name,clg_name,dob,grad_year,city,pfp_url,user_id))

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

@app.route("/logout")
def logout():
    session.clear()
    flash("You have been logged out successfully.")
    return redirect(url_for('home'))

@app.route("/chat")
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
    room = utils.get_room_id(data['sender_id'], data['receiver_id'])
    
    mydb = get_db_connection()
    cur = mydb.cursor()
    try:
        cur.execute(
            "INSERT INTO messages (sender_id, receiver_id, content) VALUES (%s,%s,%s)",
            (data['sender_id'], data['receiver_id'], data['message'])
        )
        mydb.commit()
        message_id = cur.lastrowid

        
        cur.execute("SELECT username, pfp_path FROM users WHERE user_id=%s", (data['sender_id'],))
        row = cur.fetchone()
        sender_username = row[0] if row else None
        sender_pfp = row[1] if row and row[1] else None

        enriched = {
            'sender_id': data['sender_id'],
            'receiver_id': data['receiver_id'],
            'message': data['message'],
            'client_message_id': data.get('client_message_id'),
            'sender_username': sender_username,
            'sender_pfp': sender_pfp,
            'message_id': message_id,
        }
    finally:
        cur.close()
        mydb.close()

    emit('receive_message', enriched, room=room)
    
    return {'status': 'ok', 'message_id': message_id}

@socketio.on('typing')
def handle_typing(data):
    """Notify the other participant that the user is typing."""
    try:
        room = utils.get_room_id(data['user_id'], data['receiver_id'])
        emit('typing', {'user_id': data['user_id']}, room=room, include_self=False)
    except Exception:
        pass

@socketio.on('stop_typing')
def handle_stop_typing(data):
    """Notify the other participant that the user stopped typing."""
    try:
        room = utils.get_room_id(data['user_id'], data['receiver_id'])
        emit('stop_typing', {'user_id': data['user_id']}, room=room, include_self=False)
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
@validators.login_required
def verification_request():
    """Handle verification requests from users"""
    try:
        user_id = session['user_id']
        
        # Check if user already has a pending request
        mydb = get_db_connection()
        cur = mydb.cursor()
        
        cur.execute("""
            SELECT vr.request_id, vr.status, vr.created_at, vr.review_notes, c.college_name, vr.requested_role
            FROM verification_requests vr
            JOIN colleges c ON vr.college_id = c.college_id
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
            college_id = request.form.get('college_id')
            requested_role = request.form.get('requested_role')
            student_id = request.form.get('student_id')
            graduation_year = request.form.get('graduation_year')
            department = request.form.get('department')
            request_message = request.form.get('request_message')
            
            success, message = submit_verification_request(
                user_id, college_id, requested_role, student_id,
                graduation_year, department, request_message
            )
            
            if success:
                flash(message, 'success')
                return redirect(url_for('verification_request'))
            else:
                flash(message, 'error')
        
        colleges = get_colleges()
        
        return render_template('verification_request.html', 
                             colleges=colleges, 
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
            JOIN admin_permissions ap ON vr.college_id = ap.college_id
            WHERE ap.admin_user_id = %s AND ap.is_active = TRUE AND vr.status = 'pending'
        """, (user_id,))
        pending_count = cur.fetchone()[0]
        
        # Count total verified users
        cur.execute("""
            SELECT COUNT(*) FROM users u
            JOIN admin_permissions ap ON u.college_id = ap.college_id
            WHERE ap.admin_user_id = %s AND ap.is_active = TRUE 
            AND u.user_role IN ('student', 'alumni')
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

@app.route('/check_college_access/<int:college_id>')
@verified_user_required
def check_college_access(college_id):
    """Check if user has access to college features"""
    try:
        user_id = session['user_id']
        has_access = user_roles.can_access_college_features(user_id, college_id)
        
        return {'success': True, 'has_access': has_access}
        
    except Exception as e:
        app.logger.error(f"Error in check_college_access: {str(e)}")
        return {'success': False, 'message': 'Error checking access'}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    
    socketio.run(app, host="0.0.0.0", port=port, debug=debug)
 
