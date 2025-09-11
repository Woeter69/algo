from flask import Flask,render_template,request, session, redirect, url_for
import connection 
import os, secrets, datetime
from flask_bcrypt import Bcrypt
import utils, validators
from connection import get_db_connection
app = Flask(__name__,template_folder="../templates",static_folder="../static")
app.secret_key = os.urandom(24)

bcrypt = Bcrypt(app)

@app.route('/')
def home():
    return render_template("home.html")

@app.route("/login",methods=["GET","POST"])
def login():
    if request.method == "POST":
        email = request.form["email"]
        password = request.form["password"]
        mydb = get_db_connection()
        cur = mydb.cursor()

        cur.execute("SELECT user_id,password FROM users where email=%s",(email,))
        row = cur.fetchone()

        cur.close()
        mydb.close()

        if row:
            user_id,hashed_password = row
            if bcrypt.check_password_hash(hashed_password,password):
                session['user_id'] = user_id
                return redirect(url_for("complete_profile"))
        return render_template("login.html",error="Invalid Credentials")
    return render_template("login.html")

@app.route('/register',methods=["GET","POST"])
def register():
    if request.method == "POST":
        firstname = request.form["firstname"]
        lastname = request.form["lastname"]
        email = request.form["email"]
        username = request.form["username"]
        password = request.form["password"]
        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

        if not utils.is_student_email(email):
            return render_template("register.html",error="Only student emails are allowed")
        
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

        link = f"http://127.0.0.1:5000/verify/{token}"
        validators.send_verification_email(email, link)

        return redirect(url_for("check_email"))
    return render_template("register.html")

@app.route("/confirmation",methods=["GET","POST"])
def confirmation():
    if request.method == "POST":
        return redirect(url_for("login"))
    return render_template("confirmation.html")

@app.route('/complete_profile',methods=["GET","POST"])
def complete_profile():
    cutoff_date = datetime.datetime.utcnow().date().replace(year=datetime.datetime.utcnow().year - 16)
    cities = utils.load_cities()
    if request.method == "POST":
        uni_name = request.form["uni-name"]
        clg_name = request.form["clg-name"]
        dob = request.form["dob"]
        grad_year = request.form["grad_year"]
        city = request.form["city"]
         
        dob_date = datetime.datetime.strptime(dob, "%Y-%m-%d").date()
        today = datetime.date.today()
        age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
        
        if age < 16:
            return render_template("complete_profile.html",cities=cities,error="You must be atleast 16")

        mydb = get_db_connection()
        cur = mydb.cursor()

        user_id = session.get('user_id')

        cur.execute("UPDATE users SET university_name=%s,college=%s,dob=%s,graduation_year=%s,current_city=%s WHERE user_id=%s",(uni_name,clg_name,dob,grad_year,city,user_id))

        mydb.commit()
        cur.close()
        mydb.close()

        return redirect(url_for("interests"))
    return render_template('complete_profile.html',cities=cities,cutoff_date=cutoff_date)

@app.route("/check_email")
def check_email():
    return render_template("check_email.html")

@app.route("/verify/<token>")
def verify(token):
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
        insert into users (firstname, lastname, email, username, password,veritfied)
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
    
    cur.close()
    mydb.close()

    session.pop("register_data",None)
    return redirect(url_for("confirmation"))

@app.route("/interests",methods=["GET","POST"])
def interests():
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    cur.execute("SELECT interest_id, name FROM interests ORDER BY name")
    db_interests = cur.fetchall()
    
    if request.method == "POST":
        selected_intrests = request.form.getlist('interests')
        user_id = session.get('user_id')

        cur.execute("DELETE FROM user_interests where user_id=%s",(user_id,))

        for interest_id in selected_intrests:
            cur.execute("INSERT INTO user_interests (user_id,interest_id) VALUES (%s,%s) ",(user_id,interest_id))
        
        mydb.commit()
        cur.close()
        mydb.close()

        return redirect(url_for("thanks"))
    cur.close()
    mydb.close()
    return render_template("interests.html",db_interests=db_interests)

"""-------------------------Code block added by ovesh start----------------------------------------"""

@app.route('/contact', methods=["GET", "POST"])
def contact():
    if request.method == "POST":
        full_name = request.form.get("full_name")
        email = request.form.get("email")
        phone = request.form.get("phone")
        message = request.form.get("message")

        print("Received form:", full_name, email, phone, message)  # DEBUG

        if not full_name or not email or not message:
            return "Please fill in all required fields.", 400

        mydb = get_db_connection()
        cur = mydb.cursor()
        try:
            cur.execute("""
                INSERT INTO contacts (full_name, email, phone, message)
                VALUES (%s, %s, %s, %s)
            """, (full_name, email, phone, message))
            mydb.commit()
            print("Insert successful!")  # DEBUG
        except Exception as e:
            mydb.rollback()
            print("Database error:", e)
            return "Database error", 500
        finally:
            cur.close()
            mydb.close()

        return redirect(url_for("contact"))  # clears form after POST

    return render_template("contact.html")

        

"""-------------------------------code block added by ovesh finish----------------------------------------"""

@app.route("/thanks", methods=["GET","POST"])
def thanks():
    if request.method == "POST":
        if session.get('user_id'):
            return redirect(url_for("home"))
        else:
            return redirect(url_for("login"))
    return render_template("thanks.html")

if __name__ == "__main__":
    app.run(debug=True)
