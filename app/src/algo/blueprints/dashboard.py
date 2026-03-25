from flask import Blueprint, render_template, session, redirect, url_for, flash, request
from algo.db import get_db
from algo.auth.decorators import login_required
import user_roles

bp = Blueprint('dashboard', __name__)

@bp.route('/user_dashboard')
@login_required
def user_dashboard():
    user_id = session["user_id"]

    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT username, role, pfp_path, verification_status FROM users WHERE user_id = %s",
        (user_id,),
    )
    row = cur.fetchone()
    cur.close()

    if not row:
        flash("User not found", "error")
        return redirect(url_for("auth.login"))

    username, role, pfp_path, verification_status = row

    if role == "unverified" or (role != "admin" and verification_status == "pending"):
        return redirect(url_for("dashboard.limited_dashboard"))
        
    return render_template(
        "user_dashboard.html", username=username, role=role, pfp_path=pfp_path
    )

@bp.route("/admin_dashboard", methods=["GET", "POST"])
@login_required
@user_roles.admin_required
def admin_dashboard():
    """Admin dashboard for managing users and verification requests"""
    user_id = session["user_id"]
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute(
            "SELECT username, role, pfp_path FROM users WHERE user_id = %s", (user_id,)
        )
        admin_info = cur.fetchone()
        if not admin_info:
            flash("Admin information not found", "error")
            return redirect(url_for("dashboard.user_dashboard"))
            
        username, role, pfp_path = admin_info
        
        try:
            cur.execute(
                "SELECT COUNT(*) FROM users WHERE verification_status = 'pending' AND role != 'unverified'"
            )
            pending_count_result = cur.fetchone()
            pending_count = pending_count_result[0] if pending_count_result else 0
            cur.execute(
                """
                SELECT user_id, username, email, role, pfp_path, registration_date 
                FROM users 
                WHERE verification_status = 'pending' AND role != 'unverified'
                ORDER BY registration_date DESC
                """
            )
            pending_requests_data = cur.fetchall()
            pending_requests = []
            for row in pending_requests_data:
                pending_requests.append(
                    {
                        "user_id": row[0],
                        "username": row[1],
                        "email": row[2],
                        "requested_role": row[3],
                        "pfp_path": row[4],
                        "created_at": row[5],
                    }
                )
        except Exception as e:
            pending_count = 0
            pending_requests = []
            
        try:
            cur.execute("SELECT COUNT(*) FROM users")
            total_users_result = cur.fetchone()
            total_users = total_users_result[0] if total_users_result else 0
        except Exception as e:
            total_users = 0
            
        try:
            cur.execute(
                "SELECT COUNT(*) FROM users WHERE verification_status = 'verified'"
            )
            verified_users_result = cur.fetchone()
            verified_users = verified_users_result[0] if verified_users_result else 0
        except Exception as e:
            verified_users = 0
            
        try:
            cur.execute(
                """
                SELECT COUNT(*) FROM users 
                WHERE registration_date >= NOW() - INTERVAL '7 days'
                """
            )
            recent_registrations_result = cur.fetchone()
            recent_registrations = (
                recent_registrations_result[0] if recent_registrations_result else 0
            )
        except Exception as e:
            recent_registrations = 0
            
        cur.close()
        
        return render_template(
            "admin_dashboard.html",
            username=username,
            role=role,
            pfp_path=pfp_path,
            pending_count=pending_count,
            pending_requests=pending_requests,
            total_users=total_users,
            total_verified=verified_users,
            recent_registrations=recent_registrations,
        )
    except Exception as e:
        flash("Error loading admin dashboard", "error")
        return redirect(url_for("dashboard.user_dashboard"))

@bp.route("/limited_dashboard", methods=["GET"])
@login_required
def limited_dashboard():
    """Dashboard for unverified users with limited access"""
    user_id = session["user_id"]
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            """
            SELECT firstname, lastname, username, role, verification_status, pfp_path 
            FROM users WHERE user_id = %s
            """,
            (user_id,),
        )
        user_row = cur.fetchone()
        if not user_row:
            flash("User not found", "error")
            return redirect(url_for("auth.login"))
            
        user = {
            "firstname": user_row[0],
            "lastname": user_row[1],
            "username": user_row[2],
            "role": user_row[3],
            "verification_status": user_row[4],
            "pfp_path": user_row[5],
        }
        
        verification_request = None
        verification_req = None
        if verification_request:
            verification_req = {
                "request_id": verification_request[0],
                "created_at": verification_request[1],
            }
            
        return render_template(
            "limited_dashboard.html", user=user, verification_request=verification_req
        )
    except Exception as e:
        flash("An error occurred loading the dashboard.", "error")
        return redirect(url_for("core.home"))
    finally:
        if cur:
            cur.close()
