import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import datetime
import secrets
from urllib.parse import urlparse
from flask import (
    Flask,
    flash,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)
from flask_bcrypt import Bcrypt
import connection
import user_roles
import utils
import validators
from channels import channels_bp

app = Flask(__name__, template_folder="../templates", static_folder="../static")
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret")
bcrypt = Bcrypt(app)
app.register_blueprint(channels_bp, url_prefix="/api")


def is_safe_url(target):
    """
    Check if the target URL is safe for redirecting.
    Prevents open redirect vulnerabilities by ensuring the URL is relative
    or belongs to the same host.
    """
    if not target:
        return False
    parsed = urlparse(target)
    if not parsed.netloc and (not parsed.scheme):
        return True
    try:
        ref_url = urlparse(request.host_url)
        return parsed.netloc == ref_url.netloc and parsed.scheme in ("http", "https")
    except RuntimeError:
        return not parsed.netloc and (not parsed.scheme)


@app.context_processor
def inject_time_functions():
    return {
        "to_ist": utils.to_ist,
        "format_ist_time": utils.format_ist_time,
        "generate_default_avatar": utils.generate_default_avatar,
    }


@app.route("/thanks", methods=["GET", "POST"])
@validators.login_required
def thanks():
    if request.method == "POST":
        return redirect(url_for("home"))
    return render_template("thanks.html")


@app.route("/api/handle_verification_request", methods=["POST"])
@user_roles.login_required
@user_roles.admin_required
def handle_verification_request():
    """Handle approve/reject verification requests"""
    try:
        data = request.get_json()
        user_id = data.get("user_id")
        action = data.get("action")
        if not user_id or action not in ["approve", "reject"]:
            return ({"success": False, "message": "Invalid request data"}, 400)
        admin_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT username, email, role FROM users \n            WHERE user_id = %s AND verification_status = 'pending'\n        ",
            (user_id,),
        )
        user_info = cur.fetchone()
        if not user_info:
            return (
                {
                    "success": False,
                    "message": "User not found or not pending verification",
                },
                404,
            )
        username, email, current_role = user_info
        if action == "approve":
            cur.execute(
                "\n                UPDATE users \n                SET verification_status = 'verified', \n                    verified_by = %s, \n                    verified_at = NOW()\n                WHERE user_id = %s\n            ",
                (admin_id, user_id),
            )
            message = f"Verification request approved for {username}"
        else:
            cur.execute(
                "\n                UPDATE users \n                SET verification_status = 'rejected',\n                    role = 'unverified',\n                    verified_by = %s,\n                    verified_at = NOW()\n                WHERE user_id = %s\n            ",
                (admin_id, user_id),
            )
            message = f"Verification request rejected for {username}"
        mydb.commit()
        app.logger.info(
            f"Admin {admin_id} {action}d verification for user {user_id} ({username})"
        )
        return {
            "success": True,
            "message": message,
            "action": action,
            "user_id": user_id,
        }
    except Exception as e:
        app.logger.error(f"Error handling verification request: {str(e)}")
        return ({"success": False, "message": "Internal server error"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/verification_request", methods=["GET", "POST"])
@user_roles.login_required
def verification_request():
    """Handle verification requests from users"""
    try:
        user_id = session["user_id"]
        if request.method == "POST":
            flash(
                "Your verification request has been submitted successfully! An admin will review it soon.",
                "success",
            )
            return redirect(url_for("limited_dashboard"))
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT firstname, lastname, email, role, university_name, graduation_year\n            FROM users WHERE user_id = %s\n        ",
            (user_id,),
        )
        user_info = cur.fetchone()
        if not user_info:
            flash("User information not found", "error")
            return redirect(url_for("limited_dashboard"))
        firstname, lastname, email, user_role, uni_name, grad_year = user_info
        form_data = {
            "firstname": firstname,
            "lastname": lastname,
            "email": email,
            "requested_role": user_role or "student",
            "graduation_year": grad_year,
            "university_name": uni_name,
        }
        return render_template("verification_request.html", form_data=form_data)
    except Exception as e:
        app.logger.error(f"Error in verification_request: {str(e)}")
        flash("An error occurred. Please try again.", "error")
        return redirect(url_for("user_dashboard"))
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/recommendations")
@validators.login_required
def recommendations():
    return render_template("recommendations.html")


@app.route("/api/export_data", methods=["POST"])
@validators.login_required
def export_data():
    """Export user data"""
    try:
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT firstname, lastname, email, username, dob,\n                   university_name, college, graduation_year, current_city,\n                   registration_date, role\n            FROM users WHERE user_id = %s\n        ",
            (user_id,),
        )
        user_data = cur.fetchone()
        cur.execute(
            "\n            SELECT u.firstname, u.lastname, u.email\n            FROM connections c\n            JOIN users u ON (c.con_user_id = u.user_id OR c.user_id = u.user_id)\n            WHERE (c.user_id = %s OR c.con_user_id = %s) \n            AND c.status = 'accepted' AND u.user_id != %s\n        ",
            (user_id, user_id, user_id),
        )
        connections = cur.fetchall()
        export_data = {
            "user_info": {
                "firstname": user_data[0] if user_data else None,
                "lastname": user_data[1] if user_data else None,
                "email": user_data[2] if user_data else None,
                "username": user_data[3] if user_data else None,
                "dob": str(user_data[4]) if user_data and user_data[4] else None,
                "university": user_data[5] if user_data else None,
                "college": user_data[6] if user_data else None,
                "graduation_year": user_data[7] if user_data else None,
                "city": user_data[8] if user_data else None,
                "registration_date": (
                    str(user_data[9]) if user_data and user_data[9] else None
                ),
                "role": user_data[10] if user_data else None,
            },
            "connections": [
                {
                    "name": f"{conn[0]} {conn[1]}",
                    "email": conn[2],
                    "connected_date": str(conn[3]) if conn[3] else None,
                }
                for conn in connections
            ],
            "export_date": datetime.datetime.utcnow().isoformat(),
        }
        import json

        json_data = json.dumps(export_data, indent=2)
        response = app.response_class(
            response=json_data,
            status=200,
            mimetype="application/json",
            headers={
                "Content-Disposition": "attachment; filename=algo_data_export.json"
            },
        )
        return response
    except Exception as e:
        app.logger.error(f"Error exporting data: {str(e)}")
        return ({"success": False, "message": "Error exporting data"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    print("🐍 Starting Python Flask Server...")
    print("📡 Web pages and API endpoints")
    print("🚀 Real-time features handled by Go WebSocket server")
    app.run(host="0.0.0.0", port=port, debug=debug)
