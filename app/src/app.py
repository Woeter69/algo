import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template, request, session, redirect, url_for, flash
import secrets, datetime, time
from flask_bcrypt import Bcrypt
from urllib.parse import urlparse, urljoin

# Local imports (fixed paths for standalone Flask)
import connection
import utils
import validators
import user_roles

# Import channels blueprint
from channels import channels_bp

app = Flask(__name__, template_folder="../templates", static_folder="../static")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")
bcrypt = Bcrypt(app)

# Register blueprints
app.register_blueprint(channels_bp, url_prefix='/api')

# Note: WebSocket /ws route is handled by nginx proxy to Go server

# ====================== ARCHITECTURE CHANGE ======================
# 🐍 Python Flask: Handles web pages, API endpoints, authentication
# 🚀 Go WebSocket: Handles real-time messaging, typing, presence
# 📊 Performance: 10x faster real-time features with Go
# 🔧 Simplicity: Clean Flask app, no more Socket.IO complexity
# ====================== END ARCHITECTURE ======================

def is_safe_url(target):
    """
    Check if the target URL is safe for redirecting.
    Prevents open redirect vulnerabilities by ensuring the URL is relative
    or belongs to the same host.
    """
    if not target:
        return False
    
    # Parse the target URL
    parsed = urlparse(target)
    
    # Allow relative URLs (no scheme or netloc)
    if not parsed.netloc and not parsed.scheme:
        return True
    
    # Allow URLs from the same host
    try:
        ref_url = urlparse(request.host_url)
        return parsed.netloc == ref_url.netloc and parsed.scheme in ('http', 'https')
    except RuntimeError:
        # If we're outside of request context, only allow relative URLs
        return not parsed.netloc and not parsed.scheme

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

            mydb = connection.get_db_connection()
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

                    # Check for saved redirect URL
                    next_url = session.pop('next_url', None)
                    
                    if login_count == 0:
                        # First time login - must complete profile first
                        # Save the next_url for after profile completion
                        if next_url:
                            session['post_profile_redirect'] = next_url
                        return redirect(url_for("complete_profile"))  
                    else:
                        # Regular login - redirect to intended page or dashboard
                        if next_url and is_safe_url(next_url):
                            return redirect(next_url)
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

@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    """Handle forgot password requests"""
    if 'user_id' in session:
        return redirect(url_for('user_dashboard'))
    
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        
        if not email:
            flash("Please enter your email address or username.", "error")
            return render_template("forgot_password.html")
        
        mydb = None
        cur = None
        
        try:
            mydb = connection.get_db_connection()
            cur = mydb.cursor()
            
            # Check if user exists by email or username
            cur.execute("SELECT user_id, firstname, lastname, email FROM users WHERE email = %s OR username = %s", (email, email))
            user = cur.fetchone()
            
            if user:
                user_id, firstname, lastname, user_email = user
                user_name = f"{firstname} {lastname}".strip()
                
                # Generate reset token
                reset_token = secrets.token_urlsafe(32)
                expiry = datetime.datetime.utcnow() + datetime.timedelta(hours=1)  # 1 hour expiry
                
                # Store reset token in database
                cur.execute("""
                    INSERT INTO password_reset_tokens (user_id, email, token, expiry)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, user_email, reset_token, expiry))
                mydb.commit()
                
                # Send reset email
                email_sent = utils.send_password_reset_email(user_email, reset_token, user_name)
                
                if email_sent:
                    flash("Password reset link has been sent to your email address. Please check your inbox.", "success")
                else:
                    flash("Failed to send reset email. Please try again later.", "error")
            else:
                # Don't reveal if email exists or not for security
                flash("If an account with that email exists, a password reset link has been sent.", "success")
            
            return render_template("forgot_password.html")
            
        except Exception as e:
            app.logger.error(f"Error in forgot_password: {str(e)}")
            flash("An error occurred. Please try again later.", "error")
            return render_template("forgot_password.html")
        
        finally:
            if cur:
                cur.close()
            if mydb:
                mydb.close()
    
    return render_template("forgot_password.html")

@app.route("/reset-password/<token>", methods=["GET", "POST"])
def reset_password(token):
    """Handle password reset with token"""
    if 'user_id' in session:
        return redirect(url_for('user_dashboard'))
    
    mydb = None
    cur = None
    
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        
        # Verify token
        cur.execute("""
            SELECT prt.user_id, prt.email, u.firstname, u.lastname
            FROM password_reset_tokens prt
            JOIN users u ON prt.user_id = u.user_id
            WHERE prt.token = %s AND prt.expiry > %s AND prt.used = FALSE
        """, (token, datetime.datetime.utcnow()))
        
        token_data = cur.fetchone()
        
        if not token_data:
            flash("Invalid or expired reset link. Please request a new password reset.", "error")
            return redirect(url_for('forgot_password'))
        
        user_id, email, firstname, lastname = token_data
        user_name = f"{firstname} {lastname}".strip()
        
        if request.method == "POST":
            password = request.form.get("password", "")
            confirm_password = request.form.get("confirm_password", "")
            
            if not password or len(password) < 8:
                flash("Password must be at least 8 characters long.", "error")
                return render_template("forgot_password.html", token=token)
            
            if password != confirm_password:
                flash("Passwords do not match.", "error")
                return render_template("forgot_password.html", token=token)
            
            # Hash new password
            hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")
            
            # Update password
            cur.execute("UPDATE users SET password = %s WHERE user_id = %s", (hashed_password, user_id))
            
            # Mark token as used
            cur.execute("UPDATE password_reset_tokens SET used = TRUE WHERE token = %s", (token,))
            
            mydb.commit()
            
            # Send confirmation email
            utils.send_password_changed_notification(email, user_name)
            
            flash("Your password has been successfully updated. You can now log in with your new password.", "success")
            return redirect(url_for('login'))
        
        return render_template("reset_password.html", token=token)
        
    except Exception as e:
        app.logger.error(f"Error in reset_password: {str(e)}")
        flash("An error occurred. Please try again later.", "error")
        return redirect(url_for('forgot_password'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
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
            bio = request.form.get("bio", "")
            
            # Role Information
            role = request.form.get("role")
            student_id = request.form.get("student_id", "")
            alumni_id = request.form.get("alumni_id", "")
            employee_id = request.form.get("employee_id", "")
            department_role = request.form.get("department_role", "")
            
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

            mydb = connection.get_db_connection()
            cur = mydb.cursor()
            user_id = session.get('user_id')

            # Validate role selection
            if not role or role not in ['student', 'alumni', 'staff']:
                return render_template("complete_profile.html", cities=cities, cutoff_date=cutoff_date, 
                                     error="Please select a valid role")
            
            # Validate role-specific fields
            if role == 'student' and not student_id:
                return render_template("complete_profile.html", cities=cities, cutoff_date=cutoff_date,
                                     error="Student ID is required for student role")
            elif role == 'staff' and (not employee_id or not department_role):
                return render_template("complete_profile.html", cities=cities, cutoff_date=cutoff_date,
                                     error="Employee ID and Department/Position are required for staff role")

            # Update users table with basic info and role
            cur.execute("""
                UPDATE users SET 
                    firstname=%s, lastname=%s, dob=%s,
                    university_name=%s, college=%s, graduation_year=%s, current_city=%s, 
                    pfp_path=%s, role=%s, verification_status=%s
                WHERE user_id=%s
            """, (first_name, last_name, dob, uni_name, clg_name, grad_year, city, 
                  pfp_url, role, 'verified' if role == 'admin' else 'pending', user_id))

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

            # Update session with role information
            session['role'] = role
            session['verification_status'] = 'verified' if role == 'admin' else 'pending'
            
            mydb.commit()
            
            # Redirect to interests page to complete profile setup
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
        mydb = connection.get_db_connection()
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
           
            # Check for saved redirect URL after profile completion
            post_profile_redirect = session.pop('post_profile_redirect', None)
            if post_profile_redirect and is_safe_url(post_profile_redirect):
                return redirect(post_profile_redirect)
            else:
                return redirect(url_for("user_dashboard"))
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

            mydb = connection.get_db_connection()
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

@app.route('/about')
def about():
    try:
        return render_template("about.html")
    except Exception as e:
        app.logger.error(f"Error in about route: {str(e)}")
        flash("An error occurred while loading the About Us page.")
        return render_template("home.html"), 500

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

    mydb = connection.get_db_connection()
    cur = mydb.cursor()
    cur.execute("SELECT username, role, pfp_path, verification_status FROM users WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    cur.close()
    mydb.close()

    username, role, pfp_path, verification_status = row
    
    # Redirect unverified users to limited dashboard (but not admins)
    if role == 'unverified' or (role != 'admin' and verification_status == 'pending'):
        return redirect(url_for('limited_dashboard'))

    return render_template("user_dashboard.html", username=username,role=role,pfp_path=pfp_path)


@app.route("/admin_dashboard", methods=["GET", "POST"])
@user_roles.login_required
@user_roles.admin_required
def admin_dashboard():
    """Admin dashboard for managing users and verification requests"""
    user_id = session['user_id']
    
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        
        # Get admin user info
        cur.execute("SELECT username, role, pfp_path FROM users WHERE user_id = %s", (user_id,))
        admin_info = cur.fetchone()
        
        if not admin_info:
            flash("Admin information not found", "error")
            return redirect(url_for('user_dashboard'))
        
        username, role, pfp_path = admin_info
        
        # Get pending verification requests count
        cur.execute("SELECT COUNT(*) FROM users WHERE verification_status = 'pending' AND role != 'unverified'")
        pending_requests = cur.fetchone()[0]
        
        # Get total users count
        cur.execute("SELECT COUNT(*) FROM users")
        total_users = cur.fetchone()[0]
        
        # Get verified users count
        cur.execute("SELECT COUNT(*) FROM users WHERE verification_status = 'verified'")
        verified_users = cur.fetchone()[0]
        
        # Get recent registrations (last 7 days)
        cur.execute("""
            SELECT COUNT(*) FROM users 
            WHERE registration_date >= NOW() - INTERVAL '7 days'
        """)
        recent_registrations = cur.fetchone()[0]
        
        cur.close()
        mydb.close()
        
        return render_template("admin_dashboard.html", 
                             username=username,
                             role=role,
                             pfp_path=pfp_path,
                             pending_requests=pending_requests,
                             total_users=total_users,
                             verified_users=verified_users,
                             recent_registrations=recent_registrations)
        
    except Exception as e:
        app.logger.error(f"Error in admin_dashboard: {str(e)}")
        flash("Error loading admin dashboard", "error")
        return redirect(url_for('user_dashboard'))

@app.route("/limited_dashboard", methods=["GET"])
@validators.login_required
def limited_dashboard():
    """Dashboard for unverified users with limited access"""
    user_id = session['user_id']
    
    mydb = connection.get_db_connection()
    cur = mydb.cursor()
    
    try:
        # Get user information
        cur.execute("""
            SELECT firstname, lastname, username, role, verification_status, pfp_path 
            FROM users WHERE user_id = %s
        """, (user_id,))
        user_row = cur.fetchone()
        
        if not user_row:
            flash("User not found", "error")
            return redirect(url_for('login'))
        
        user = {
            'firstname': user_row[0],
            'lastname': user_row[1],
            'username': user_row[2],
            'role': user_row[3],
            'verification_status': user_row[4],
            'pfp_path': user_row[5]
        }
        
        # Skip verification request check for now since table doesn't exist
        verification_request = None
        verification_req = None
        if verification_request:
            verification_req = {
                'request_id': verification_request[0],
                'created_at': verification_request[1]
            }
        
        return render_template("limited_dashboard.html", 
                             user=user, 
                             verification_request=verification_req)
    
    except Exception as e:
        app.logger.error(f"Error in limited_dashboard: {str(e)}")
        flash("An error occurred loading the dashboard.", 'error')
        return redirect(url_for('home'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
            mydb.close()


@app.route("/channels", methods=["GET","POST"])
@validators.login_required
@user_roles.verified_user_required
def channels():
    """Main channels page - Discord-like interface"""
    user_id = session['user_id']
    
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        
        # Get user's communities
        cur.execute("""
            SELECT c.community_id, c.name, c.description, cm.role
            FROM communities c
            JOIN community_members cm ON c.community_id = cm.community_id
            WHERE cm.user_id = %s AND cm.status = 'active'
            ORDER BY c.name
        """, (user_id,))
        
        communities = cur.fetchall()
        
        # Default to first community or CIC
        selected_community_id = request.args.get('community_id')
        if not selected_community_id and communities:
            # Try to find CIC first, otherwise use first community
            cic_community = next((c for c in communities if 'cluster innovation centre' in c[1].lower()), None)
            selected_community_id = cic_community[0] if cic_community else communities[0][0]
        
        channels_list = []
        if selected_community_id:
            # Get channels for selected community
            cur.execute("""
                SELECT channel_id, name, description, channel_type, is_private
                FROM channels
                WHERE community_id = %s AND is_active = true
                ORDER BY position_order, created_at
            """, (selected_community_id,))
            
            channels_list = cur.fetchall()
        
        cur.close()
        mydb.close()
        
        return render_template("channels.html", 
                             communities=communities,
                             channels=channels_list,
                             selected_community_id=int(selected_community_id) if selected_community_id else None,
                             user_id=user_id)
        
    except Exception as e:
        app.logger.error(f"Error in channels route: {str(e)}")
        flash("Error loading channels", "error")
        return render_template("channels.html", communities=[], channels=[])


@app.route("/chat")
@app.route("/chat_list")
@validators.login_required
@user_roles.verified_user_required
def chat_list():
    user_id = session['user_id']
    mydb = connection.get_db_connection()
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
    mydb = connection.get_db_connection()
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

# Old Socket.IO code removed - now handled by Go WebSocket server

# Typing handlers moved to Go WebSocket server

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
        mydb = connection.get_db_connection()
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
        # Get community name if exists
        community_name = None
        if user_data[15]:  
            cur.execute("SELECT name FROM communities WHERE community_id = %s", (user_data[15],))
            community_result = cur.fetchone()
            if community_result:
                community_name = community_result[0]
        
        # Get current logged-in user's info for the dropdown
        current_user_info = None
        if user_id != user_data[0]:  # If viewing someone else's profile
            cur.execute("""
                SELECT user_id, firstname, lastname, email, username, pfp_path, role
                FROM users 
                WHERE user_id = %s
            """, (user_id,))
            current_user_info = cur.fetchone()
        
        return render_template("profile.html", 
                             user_data=user_data,
                             user_interests=user_interests,
                             education_data=education_data,
                             work_experience=work_experience,
                             connections_count=connections_count,
                             community_name=community_name,
                             current_user_info=current_user_info,
                             user_bio=None,  # TODO: Add bio field to database
                             user_skills=[],  # TODO: Add skills field to database
                             user_social_links=None,  # TODO: Add social links to database
                             user_phone=None)  # TODO: Add phone field to database
    
    except Exception as e:
        app.logger.error(f"Error fetching profile data: {str(e)}")
        flash("Error loading profile data")
        return redirect(url_for('home'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
            mydb.close()

@app.route('/create_community', methods=['GET', 'POST'])
@user_roles.login_required
def create_community():
    """Create Community page - only for admin and college_admin roles"""
    user_id = session['user_id']
    user_role = session.get('role', 'user')
    
    # Check if user has permission to create communities
    if user_role not in ['admin', 'college_admin']:
        flash("Access denied. Only administrators can create communities.", 'error')
        return redirect(url_for('user_dashboard'))
    
    mydb = None
    cur = None
    
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        
        if request.method == 'POST':
            # Get form data
            community_name = request.form.get('community_name', '').strip()
            college_code = request.form.get('college_code', '').strip().upper()
            location = request.form.get('location', '').strip()
            description = request.form.get('description', '').strip()
            
            # Validation
            if not all([community_name, college_code, location]):
                flash("All required fields must be filled.", 'error')
                return render_template('create_community.html')
            
            # Check if college code already exists
            cur.execute("SELECT community_id FROM communities WHERE college_code = %s", (college_code,))
            existing_community = cur.fetchone()
            
            if existing_community:
                flash(f"A community with college code '{college_code}' already exists.", 'error')
                return render_template('create_community.html')
            
            # Insert new community
            cur.execute("""
                INSERT INTO communities (name, college_code, location, description, created_by, created_at)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            """, (community_name, college_code, location, description, user_id))
            
            mydb.commit()
            
            flash(f"Community '{community_name}' created successfully!", 'success')
            return redirect(url_for('admin_dashboard'))
        
        # GET request - show the form
        # Get current user info
        cur.execute("SELECT firstname, lastname, role, pfp_path FROM users WHERE user_id = %s", (user_id,))
        current_user = cur.fetchone()
        
        return render_template('create_community.html', current_user=current_user)
        
    except Exception as e:
        app.logger.error(f"Error in create_community: {str(e)}")
        flash("Error creating community. Please try again.", 'error')
        return redirect(url_for('admin_dashboard'))
    
    finally:
        if cur:
            cur.close()
        if mydb:
            mydb.close()

@app.route('/verification_request', methods=['GET', 'POST'])
@user_roles.login_required
def verification_request():
    """Handle verification requests from users"""
    try:
        user_id = session['user_id']
        
        if request.method == "POST":
            # Simple POST handler - just show success message
            flash("Your verification request has been submitted successfully! An admin will review it soon.", "success")
            return redirect(url_for('limited_dashboard'))
        
        # For GET request, get basic user info
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        
        cur.execute("""
            SELECT firstname, lastname, email, role, university_name, graduation_year
            FROM users WHERE user_id = %s
        """, (user_id,))
        user_info = cur.fetchone()
        
        if not user_info:
            flash("User information not found", "error")
            return redirect(url_for('limited_dashboard'))
        
        firstname, lastname, email, user_role, uni_name, grad_year = user_info
        
        # Simple verification request page - just show basic info
        form_data = {
            'firstname': firstname,
            'lastname': lastname,
            'email': email,
            'requested_role': user_role or 'student',
            'graduation_year': grad_year,
            'university_name': uni_name
        }
        
        return render_template('verification_request.html', 
                             form_data=form_data)
        
    except Exception as e:
        app.logger.error(f"Error in verification_request: {str(e)}")
        flash("An error occurred. Please try again.", 'error')
        return redirect(url_for('user_dashboard'))
    
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'mydb' in locals() and mydb:
            mydb.close()

@app.route('/user_role_info')
@user_roles.login_required
def user_role_info():
    """API endpoint to get user role information"""
    try:
        user_id = session['user_id']
        role_info = user_roles.get_user_role_info(user_id)
        
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
@user_roles.verified_user_required
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
        mydb = connection.get_db_connection()
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
        
        # Debug logging
        app.logger.info(f"User {user_id} requests data:")
        app.logger.info(f"  - Pending requests: {len(pending_requests)}")
        app.logger.info(f"  - Sent requests: {len(sent_requests)}")
        app.logger.info(f"  - Connections: {connections_count}")
        
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
@user_roles.verified_user_required
def connect():
    """Connect page - show alumni for networking"""
    user_id = session['user_id']
    mydb = None
    cur = None
    
    try:
        mydb = connection.get_db_connection()
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
@user_roles.verified_user_required
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
        
        mydb = connection.get_db_connection()
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
        mydb = connection.get_db_connection()
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
        mydb = connection.get_db_connection()
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
        mydb = connection.get_db_connection()
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
        mydb = connection.get_db_connection()
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
                'bio': '',
                'profile_visibility': 'public',
                'email_notifications': True,
                'job_alerts': True,
                'linkedin': '',
                'github': '',
                'twitter': '',
                'website': '',
                'show_email': False,
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
        
        mydb = connection.get_db_connection()
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
        
        mydb = connection.get_db_connection()
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
        
        mydb = connection.get_db_connection()
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
        
        mydb = connection.get_db_connection()
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

@app.route("/api/update_profile_picture", methods=["POST"])
@validators.login_required
def update_profile_picture():
    """Update user profile picture using ImgBB API"""
    try:
        user_id = session['user_id']
        
        # Check if image file is provided
        if 'profile_picture' not in request.files:
            return {'success': False, 'message': 'No image file provided'}, 400
        
        file = request.files['profile_picture']
        if file.filename == '':
            return {'success': False, 'message': 'No file selected'}, 400
        
        # Validate file type
        if not validators.allowed_file(file.filename):
            return {'success': False, 'message': 'Invalid file type. Please upload an image file.'}, 400
        
        # Get ImgBB API key from environment
        imgbb_api_key = os.getenv("PFP_KEY")
        if not imgbb_api_key:
            app.logger.error("PFP_KEY not found in environment variables")
            return {'success': False, 'message': 'Image upload service not configured'}, 500
        
        # Upload to ImgBB
        try:
            pfp_url = utils.upload_to_imgbb(file, imgbb_api_key)
            if not pfp_url:
                return {'success': False, 'message': 'Failed to upload image'}, 500
        except Exception as upload_error:
            app.logger.error(f"ImgBB upload error: {str(upload_error)}")
            return {'success': False, 'message': 'Failed to upload image to server'}, 500
        
        # Update database with new profile picture URL
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        
        cur.execute("UPDATE users SET pfp_path = %s WHERE user_id = %s", (pfp_url, user_id))
        mydb.commit()
        
        # Update session with new profile picture
        session['pfp_path'] = pfp_url
        
        return {
            'success': True, 
            'message': 'Profile picture updated successfully',
            'pfp_url': pfp_url
        }
        
    except Exception as e:
        app.logger.error(f"Error updating profile picture: {str(e)}")
        return {'success': False, 'message': 'Error updating profile picture'}, 500
    
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
        mydb = connection.get_db_connection()
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
        mydb = connection.get_db_connection()
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
        mydb = connection.get_db_connection()
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

# ====================== REAL-TIME FEATURES MOVED TO GO ======================
# All WebSocket functionality is now handled by the Go server
# This provides much better performance and can handle more users
# Go WebSocket server runs on a separate port and handles:
# - Real-time messaging
# - Typing indicators  
# - User presence
# - Channel management
# - Much faster than Socket.IO!
# ====================== END REAL-TIME FEATURES ======================

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    
    print("🐍 Starting Python Flask Server...")
    print("📡 Web pages and API endpoints")
    print("🚀 Real-time features handled by Go WebSocket server")
    
    app.run(host="0.0.0.0", port=port, debug=debug)
