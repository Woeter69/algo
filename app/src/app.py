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


@app.route("/channels", methods=["GET", "POST"])
@validators.login_required
@user_roles.verified_user_required
def channels():
    """Main channels page - Discord-like interface"""
    user_id = session["user_id"]
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT c.community_id, c.name, c.description, cm.role\n            FROM communities c\n            JOIN community_members cm ON c.community_id = cm.community_id\n            WHERE cm.user_id = %s AND cm.status = 'active'\n            ORDER BY c.name\n        ",
            (user_id,),
        )
        communities = cur.fetchall()
        app.logger.info(
            f"User {user_id} communities: found {len(communities)} communities"
        )
        for community in communities:
            app.logger.info(
                f"  - Community {community[0]}: {community[1]} (role: {community[3]})"
            )
        if not communities:
            app.logger.warning(f"User {user_id} is not a member of any communities")
            flash(
                "You are not a member of any communities. Please contact an administrator to be added to a community.",
                "warning",
            )
        selected_community_id = request.args.get("community_id")
        if not selected_community_id and communities:
            cic_community = next(
                (c for c in communities if "cluster innovation centre" in c[1].lower()),
                None,
            )
            selected_community_id = (
                cic_community[0] if cic_community else communities[0][0]
            )
        channels_list = []
        app.logger.info(f"Selected community ID: {selected_community_id}")
        if selected_community_id:
            cur.execute(
                "\n                SELECT DISTINCT c.channel_id, c.name, c.description, c.channel_type, c.is_private, c.position_order, c.created_at\n                FROM channels c\n                LEFT JOIN channel_members cm ON c.channel_id = cm.channel_id\n                WHERE c.community_id = %s AND c.is_active = true\n                AND (\n                    c.is_private = false OR \n                    (c.is_private = true AND cm.user_id = %s)\n                )\n                ORDER BY c.position_order, c.created_at\n            ",
                (selected_community_id, user_id),
            )
            channels_list = cur.fetchall()
            app.logger.info(
                f"User {user_id} in community {selected_community_id}: found {len(channels_list)} accessible channels"
            )
            for channel in channels_list:
                app.logger.info(
                    f"  - Channel {channel[0]}: {channel[1]} (private: {channel[4]})"
                )
        cur.close()
        mydb.close()
        return render_template(
            "channels.html",
            communities=communities,
            channels=channels_list,
            selected_community_id=(
                int(selected_community_id) if selected_community_id else None
            ),
            user_id=user_id,
        )
    except Exception as e:
        app.logger.error(f"Error in channels route: {str(e)}")
        flash("Error loading channels", "error")
        return render_template("channels.html", communities=[], channels=[])


@app.route("/chat")
@app.route("/chat_list")
@validators.login_required
@user_roles.verified_user_required
def chat_list():
    user_id = session["user_id"]
    mydb = connection.get_db_connection()
    cur = mydb.cursor()
    try:
        cur.execute(
            "\n            SELECT DISTINCT other_user_id FROM (\n                -- Users from message history\n                SELECT CASE \n                    WHEN m.sender_id = %s THEN m.receiver_id \n                    ELSE m.sender_id \n                END as other_user_id\n                FROM messages m\n                WHERE m.sender_id = %s OR m.receiver_id = %s\n                \n                UNION\n                \n                -- Users from accepted connections\n                SELECT CASE \n                    WHEN c.user_id = %s THEN c.con_user_id \n                    ELSE c.user_id \n                END as other_user_id\n                FROM connections c\n                WHERE (c.user_id = %s OR c.con_user_id = %s) AND c.status = 'accepted'\n            ) AS combined_users\n        ",
            (user_id, user_id, user_id, user_id, user_id, user_id),
        )
        user_ids = cur.fetchall()
        chat_history = []
        app.logger.info(
            f"Chat list for user {user_id}: found {len(user_ids)} potential chat partners"
        )
        for user_tuple in user_ids:
            app.logger.info(f"  - User ID: {user_tuple[0]}")
        for (other_user_id,) in user_ids:
            cur.execute(
                "SELECT username, pfp_path, firstname, lastname FROM users WHERE user_id = %s",
                (other_user_id,),
            )
            user_data = cur.fetchone()
            if user_data:
                username, pfp_path, firstname, lastname = user_data
                if not pfp_path:
                    full_name = f"{firstname or ''} {lastname or ''}".strip()
                    pfp_path = utils.generate_default_avatar(full_name or username)
                cur.execute(
                    "\n                    SELECT content, created_at \n                    FROM messages \n                    WHERE (sender_id = %s AND receiver_id = %s) \n                       OR (sender_id = %s AND receiver_id = %s)\n                    ORDER BY created_at DESC \n                    LIMIT 1\n                ",
                    (user_id, other_user_id, other_user_id, user_id),
                )
                message_data = cur.fetchone()
                if message_data:
                    last_message = message_data[0]
                    last_message_time = message_data[1]
                    app.logger.info(
                        f"  - Found message with {username}: '{last_message[:50]}...' at {last_message_time}"
                    )
                else:
                    cur.execute(
                        "\n                        SELECT 1 FROM connections \n                        WHERE ((user_id = %s AND con_user_id = %s) OR (user_id = %s AND con_user_id = %s)) \n                        AND status = 'accepted'\n                    ",
                        (user_id, other_user_id, other_user_id, user_id),
                    )
                    if cur.fetchone():
                        last_message = "You're now connected! Start a conversation."
                        last_message_time = None
                    else:
                        last_message = None
                        last_message_time = None
                chat_history.append(
                    (other_user_id, username, pfp_path, last_message, last_message_time)
                )
        chat_history.sort(
            key=lambda x: x[4] if x[4] else datetime.datetime.min, reverse=True
        )
        app.logger.info(
            f"Final chat_history for user {user_id}: {len(chat_history)} conversations"
        )
        for chat in chat_history:
            app.logger.info(f"  - {chat[1]} (ID: {chat[0]}): '{chat[3]}' at {chat[4]}")
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
    """Return list of currently online user IDs - now handled by Go WebSocket server"""
    return jsonify(
        {"online_users": [], "message": "Online status handled by Go WebSocket server"}
    )


@app.route("/api/upload_image", methods=["POST"])
@validators.login_required
def upload_image():
    """Upload image and return URL"""
    try:
        if "image" not in request.files:
            return ({"error": "No image file provided"}, 400)
        file = request.files["image"]
        if file.filename == "":
            return ({"error": "No file selected"}, 400)
        if file and file.content_type.startswith("image/"):
            import os
            import uuid

            file_extension = file.filename.rsplit(".", 1)[1].lower()
            unique_filename = f"{uuid.uuid4()}.{file_extension}"
            upload_dir = os.path.join(app.static_folder, "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, unique_filename)
            file.save(file_path)
            image_url = f"/static/uploads/{unique_filename}"
            return {"image_url": image_url}
        return ({"error": "Invalid file type"}, 400)
    except Exception as e:
        app.logger.error(f"Error uploading image: {str(e)}")
        return ({"error": "Upload failed"}, 500)


@app.route("/chat/<username>")
@validators.login_required
def chat(username):
    user_id = session["user_id"]
    mydb = connection.get_db_connection()
    cur = mydb.cursor()
    cur.execute(
        "SELECT user_id, username, pfp_path, firstname, lastname FROM users WHERE username=%s",
        (username,),
    )
    other_user_row = cur.fetchone()
    if not other_user_row:
        flash("User not found")
        return redirect(url_for("user_dashboard"))
    other_user_id, other_user_name, other_user_pfp, other_firstname, other_lastname = (
        other_user_row
    )
    if not other_user_pfp:
        other_full_name = f"{other_firstname or ''} {other_lastname or ''}".strip()
        other_user_pfp = utils.generate_default_avatar(
            other_full_name or other_user_name
        )
    cur.execute(
        "\n        SELECT m.sender_id, m.receiver_id, m.content, m.created_at, u.username\n        FROM messages m\n        JOIN users u ON m.sender_id = u.user_id\n        WHERE (m.sender_id=%s AND m.receiver_id=%s) OR (m.sender_id=%s AND m.receiver_id=%s)\n        ORDER BY m.created_at\n    ",
        (user_id, other_user_id, other_user_id, user_id),
    )
    conversation = cur.fetchall()
    try:
        cur.execute(
            "\n            SELECT DISTINCT \n                CASE \n                    WHEN m.sender_id = %s THEN m.receiver_id \n                    ELSE m.sender_id \n                END as other_user_id\n            FROM messages m\n            WHERE m.sender_id = %s OR m.receiver_id = %s\n        ",
            (user_id, user_id, user_id),
        )
        user_ids = cur.fetchall()
        chat_history = []
        for (chat_user_id,) in user_ids:
            cur.execute(
                "SELECT username, pfp_path, firstname, lastname FROM users WHERE user_id = %s",
                (chat_user_id,),
            )
            user_data = cur.fetchone()
            if user_data:
                chat_username, pfp_path, chat_firstname, chat_lastname = user_data
                if not pfp_path:
                    chat_full_name = (
                        f"{chat_firstname or ''} {chat_lastname or ''}".strip()
                    )
                    pfp_path = utils.generate_default_avatar(
                        chat_full_name or chat_username
                    )
                cur.execute(
                    "\n                    SELECT content, created_at \n                    FROM messages \n                    WHERE (sender_id = %s AND receiver_id = %s) \n                       OR (sender_id = %s AND receiver_id = %s)\n                    ORDER BY created_at DESC \n                    LIMIT 1\n                ",
                    (user_id, chat_user_id, chat_user_id, user_id),
                )
                message_data = cur.fetchone()
                last_message = message_data[0] if message_data else None
                last_message_time = message_data[1] if message_data else None
                chat_history.append(
                    (
                        chat_user_id,
                        chat_username,
                        pfp_path,
                        last_message,
                        last_message_time,
                    )
                )
        chat_history.sort(
            key=lambda x: x[4] if x[4] else datetime.datetime.min, reverse=True
        )
    except Exception as e:
        app.logger.error(f"Error getting chat history in chat route: {str(e)}")
        chat_history = []
    cur.close()
    mydb.close()
    return render_template(
        "chat.html",
        conversation=conversation,
        other_user_id=other_user_id or None,
        other_user_name=other_user_name or "",
        other_user_pfp=other_user_pfp or "",
        chat_history=chat_history or [],
        current_user_id=user_id or None,
    )


@app.route("/create_community", methods=["GET", "POST"])
@user_roles.login_required
def create_community():
    """Create Community page - only for admin and college_admin roles"""
    user_id = session["user_id"]
    user_role = session.get("role", "user")
    if user_role not in ["admin", "college_admin"]:
        flash("Access denied. Only administrators can create communities.", "error")
        return redirect(url_for("user_dashboard"))
    mydb = None
    cur = None
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        if request.method == "POST":
            community_name = request.form.get("community_name", "").strip()
            college_code = request.form.get("college_code", "").strip().upper()
            location = request.form.get("location", "").strip()
            description = request.form.get("description", "").strip()
            if not all([community_name, college_code, location]):
                flash("All required fields must be filled.", "error")
                return render_template("create_community.html")
            cur.execute(
                "SELECT community_id FROM communities WHERE college_code = %s",
                (college_code,),
            )
            existing_community = cur.fetchone()
            if existing_community:
                flash(
                    f"A community with college code '{college_code}' already exists.",
                    "error",
                )
                return render_template("create_community.html")
            cur.execute(
                "\n                INSERT INTO communities (name, college_code, location, description, created_by, created_at)\n                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)\n            ",
                (community_name, college_code, location, description, user_id),
            )
            mydb.commit()
            flash(f"Community '{community_name}' created successfully!", "success")
            return redirect(url_for("admin_dashboard"))
        cur.execute(
            "SELECT firstname, lastname, role, pfp_path FROM users WHERE user_id = %s",
            (user_id,),
        )
        current_user = cur.fetchone()
        return render_template("create_community.html", current_user=current_user)
    except Exception as e:
        app.logger.error(f"Error in create_community: {str(e)}")
        flash("Error creating community. Please try again.", "error")
        return redirect(url_for("admin_dashboard"))
    finally:
        if cur:
            cur.close()
        if mydb:
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


@app.route("/user_role_info")
@user_roles.login_required
def user_role_info():
    """API endpoint to get user role information"""
    try:
        user_id = session["user_id"]
        role_info = user_roles.get_user_role_info(user_id)
        if role_info:
            return {
                "success": True,
                "role": role_info["role"],
                "college_name": role_info["college_name"],
                "verification_status": role_info["verification_status"],
                "is_verified": role_info["role"] in ["student", "alumni", "admin"],
            }
        else:
            return {"success": False, "message": "User not found"}
    except Exception as e:
        app.logger.error(f"Error in user_role_info: {str(e)}")
        return {"success": False, "message": "Error retrieving user information"}


@app.route("/check_community_access/<int:community_id>")
@user_roles.verified_user_required
def check_community_access(community_id):
    """Check if user has access to community features"""
    try:
        user_id = session["user_id"]
        has_access = user_roles.can_access_community_features(user_id, community_id)
        return {"success": True, "has_access": has_access}
    except Exception as e:
        app.logger.error(f"Error in check_college_access: {str(e)}")
        return {"success": False, "message": "Error checking access"}


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
