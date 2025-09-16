import sys, os
# Fixed sys.path of won't clash later
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask,render_template,request, session, redirect, url_for,flash
from . import connection 
import secrets, datetime
from flask_bcrypt import Bcrypt
from . import utils, validators
from .connection import get_db_connection

# Defining Flask app
app = Flask(__name__,template_folder="../templates",static_folder="../static")
app.secret_key = os.urandom(24)

bcrypt = Bcrypt(app)

@app.route('/')
def home():
    try:
        return render_template("home.html")
    except Exception as e:
        app.logger.error(f"Error in home route: {str(e)}")
        flash("An error occurred while loading the page. Please try again later.")
        return render_template("home.html"), 500

@app.route("/login",methods=["GET","POST"])
def login():
    cur = None
    mydb = None

    try:
        if request.method == "POST":
            email = request.form["email"]
            username = request.form["email"]
            password = request.form["password"]
            mydb = get_db_connection()
            cur = mydb.cursor()

            cur.execute("SELECT user_id,password,login_count FROM users where email=%s OR username=%s ",(email,username))
            row = cur.fetchone()
            
            if row:
                user_id,hashed_password,login_count = row
                if bcrypt.check_password_hash(hashed_password,password):
                    session['user_id'] = user_id
                    cur.execute("UPDATE users SET last_login=%s, login_count=login_count+1 WHERE user_id=%s", (datetime.datetime.utcnow(), user_id))
                    mydb.commit()

                    if login_count == 0:
                        return redirect(url_for("complete_profile"))
                    else:
                        return redirect(url_for("user_dashboard"))
            return render_template("login.html",error="Invalid Credentials")
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

@app.route('/register',methods=["GET","POST"])
def register():
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
                "password": hashed_password
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
            user_id = session.get('user_id')
            
            if not user_id:
              return redirect(url_for("login"))

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
def thanks():
    if request.method == "POST":
        if session.get('user_id'):
            return redirect(url_for("home"))
        else:
            return redirect(url_for("login"))
    return render_template("thanks.html")


@app.route("/user_dashboard", methods=["GET", "POST"])
@validators.login_required
def user_dashboard():
    if 'user_id' not in session:
        flash("Please log in to access your dashboard.")
        return redirect(url_for('login'))
    
    user_id = session['user_id']

    mydb = get_db_connection()
    cur = mydb.cursor()
    cur.execute("SELECT username FROM users WHERE user_id = %s", (user_id,))
    row = cur.fetchone()
    cur.close()
    mydb.close()

    username = row[0] if row else None

    return render_template("user_dashboard.html", username=username)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    app.run(host="0.0.0.0", port=port, debug=debug)
 # Fixed Flash issues
