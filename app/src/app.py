from flask import Flask,render_template,request, session, redirect, url_for
from connection import get_db_connection
import os
from flask_bcrypt import Bcrypt

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

        mydb = get_db_connection()
        cur = mydb.cursor()
        query = "INSERT INTO users (firstname, lastname, email, username, password) VALUES (%s,%s,%s,%s,%s)"
        cur.execute(query,(firstname,lastname,email,username,hashed_password))
        mydb.commit()
        cur.close()
        mydb.close()
        
        return redirect(url_for("confirmation"))

    return render_template("register.html")

@app.route("/confirmation")
def confirmation():
    return render_template("confirmation.html")

if __name__ == "__main__":
    app.run(debug=True)
