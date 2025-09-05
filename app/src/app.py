from flask import Flask,render_template,request, session, redirect, url_for
import connection 
import os, secrets, datetime
from flask_bcrypt import Bcrypt
import utils, validators

app = Flask(__name__,template_folder="../templates",static_folder="../static")
app.secret_key = os.urandom(24)

bcrypt = Bcrypt(app)

@app.route('/')
def home():
  name = "Woeter"
  return render_template("index.html",name=name)


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

@app.route("/confirmation")
def confirmation():
    return render_template("confirmation.html")

@app.route('/complete_profile')
def complete_profile():
    return render_template('complete_profile.html')

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
        insert into users (firstname, lastname, email, username, password)
        values (%s, %s, %s, %s, %s)
    """, (
        register_data['firstname'],
        register_data['lastname'],
        register_data['email'],
        register_data['username'],
        register_data['password']
    ))

    cur.execute("delete from verification_tokens WHERE token=%s",(token,))
    mydb.commit()
    
    cur.close()
    mydb.close()

    session.pop("register_data",None)
    return redirect(url_for("confirmation"))


if __name__ == "__main__":
    app.run(debug=True)
