import functools
import os
import secrets
import datetime

from flask import (
    Blueprint, flash, g, redirect, render_template, request, session, url_for
)
from werkzeug.security import check_password_hash, generate_password_hash

from algo.db import get_db
# We will create and move the validation functions later
# import utils
# import validators

bp = Blueprint('auth', __name__, url_prefix='/auth')

@bp.route('/register', methods=('GET', 'POST'))
def register():
    # Placeholder for register logic
    if request.method == 'POST':
        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('auth.login'))
    return render_template('register.html')

from algo.auth.decorators import login_required

@bp.route('/login', methods=('GET', 'POST'))
def login():
    if 'user_id' in session:
        return redirect(url_for('user_dashboard')) # This will need to be updated

    if request.method == 'POST':
        email_or_username = request.form['email']
        password = request.form['password']
        db = get_db()
        error = None
        
        cur = db.cursor()
        cur.execute(
            'SELECT user_id, password, login_count, username, pfp_path, role FROM users WHERE email=%s OR username=%s',
            (email_or_username, email_or_username)
        )
        user = cur.fetchone()
        cur.close()

        if user is None:
            error = 'Incorrect email or username.'
        elif not check_password_hash(user[1], password):
            error = 'Incorrect password.'

        if error is None:
            session.clear()
            session['user_id'] = user[0]
            session['username'] = user[3]
            session['pfp_path'] = user[4]
            session['role'] = user[5]
            
            # Update login stats
            cur = db.cursor()
            cur.execute(
                'UPDATE users SET last_login=%s, login_count=login_count+1 WHERE user_id=%s',
                (datetime.datetime.utcnow(), user[0])
            )
            db.commit()
            cur.close()

            # Redirect logic
            next_url = request.args.get('next')
            if user[2] == 0: # First login
                if next_url:
                    session['post_profile_redirect'] = next_url
                return redirect(url_for('profile.complete_profile')) # This will need to be updated
            
            # This is_safe_url check needs to be moved to a utils file
            # if next_url and is_safe_url(next_url):
            if next_url:
                return redirect(next_url)
            return redirect(url_for('user_dashboard')) # This will need to be updated

        flash(error)

    return render_template('auth/login.html')

@bp.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'success')
    return redirect(url_for('core.home'))
