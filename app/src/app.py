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


@app.route("/requests")
@validators.login_required
def requests():
    """Requests page - manage connection requests"""
    user_id = session["user_id"]
    mydb = None
    cur = None
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "SELECT username, firstname, lastname, role, pfp_path FROM users WHERE user_id = %s",
            (user_id,),
        )
        current_user = cur.fetchone()
        cur.execute(
            "\n            SELECT c.connection_id, c.user_id, c.request,\n                   u.firstname, u.lastname, u.username, u.pfp_path\n            FROM connections c\n            JOIN users u ON c.user_id = u.user_id\n            WHERE c.con_user_id = %s AND c.status = 'pending'\n            ORDER BY c.connection_id DESC\n        ",
            (user_id,),
        )
        pending_requests = []
        for row in cur.fetchall():
            pending_requests.append(
                {
                    "connection_id": row[0],
                    "user_id": row[1],
                    "message": row[2],
                    "created_at": "Recently",
                    "name": f"{row[3]} {row[4]}",
                    "username": row[5],
                    "avatar": row[6],
                }
            )
        cur.execute(
            "\n            SELECT c.connection_id, c.con_user_id, c.request,\n                   u.firstname, u.lastname, u.username, u.pfp_path\n            FROM connections c\n            JOIN users u ON c.con_user_id = u.user_id\n            WHERE c.user_id = %s AND c.status = 'pending'\n            ORDER BY c.connection_id DESC\n        ",
            (user_id,),
        )
        sent_requests = []
        for row in cur.fetchall():
            sent_requests.append(
                {
                    "connection_id": row[0],
                    "user_id": row[1],
                    "message": row[2],
                    "created_at": "Recently",
                    "name": f"{row[3]} {row[4]}",
                    "username": row[5],
                    "avatar": row[6],
                }
            )
        cur.execute(
            "\n            SELECT DISTINCT\n                CASE \n                    WHEN c.user_id = %s THEN c.con_user_id \n                    ELSE c.user_id \n                END as other_user_id,\n                CASE \n                    WHEN c.user_id = %s THEN u2.firstname \n                    ELSE u1.firstname \n                END as firstname,\n                CASE \n                    WHEN c.user_id = %s THEN u2.lastname \n                    ELSE u1.lastname \n                END as lastname,\n                CASE \n                    WHEN c.user_id = %s THEN u2.username \n                    ELSE u1.username \n                END as username,\n                CASE \n                    WHEN c.user_id = %s THEN u2.pfp_path \n                    ELSE u1.pfp_path \n                END as avatar,\n                c.connection_id\n            FROM connections c\n            JOIN users u1 ON c.user_id = u1.user_id\n            JOIN users u2 ON c.con_user_id = u2.user_id\n            WHERE (c.user_id = %s OR c.con_user_id = %s) AND c.status = 'accepted'\n            ORDER BY c.connection_id DESC\n        ",
            (user_id, user_id, user_id, user_id, user_id, user_id, user_id),
        )
        connections = []
        for row in cur.fetchall():
            connections.append(
                {
                    "user_id": row[0],
                    "name": f"{row[1]} {row[2]}",
                    "username": row[3],
                    "avatar": row[4],
                    "connected_at": "Recently",
                }
            )
        connections_count = len(connections)
        app.logger.info(f"User {user_id} requests data:")
        app.logger.info(f"  - Pending requests: {len(pending_requests)}")
        app.logger.info(f"  - Sent requests: {len(sent_requests)}")
        app.logger.info(f"  - Connections: {connections_count}")
        return render_template(
            "requests.html",
            pending_requests=pending_requests,
            sent_requests=sent_requests,
            connections=connections,
            connections_count=connections_count,
            current_user=current_user,
        )
    except Exception as e:
        app.logger.error(f"Error in requests route: {str(e)}")
        flash("Error loading requests page")
        return redirect(url_for("user_dashboard"))
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
    user_id = session["user_id"]
    mydb = None
    cur = None
    try:
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "SELECT username, firstname, lastname, role, pfp_path, university_name, graduation_year, current_city FROM users WHERE user_id = %s",
            (user_id,),
        )
        current_user = cur.fetchone()
        cur.execute(
            "\n            SELECT u.user_id, u.firstname, u.lastname, u.username, u.university_name, \n                   u.graduation_year, u.current_city, u.pfp_path, u.role,\n                   we.company_name, we.job_title,\n                   STRING_AGG(i.name, ', ') as interests\n            FROM users u\n            LEFT JOIN work_experience we ON u.user_id = we.user_id AND we.leave_year IS NULL\n            LEFT JOIN user_interests ui ON u.user_id = ui.user_id\n            LEFT JOIN interests i ON ui.interest_id = i.interest_id\n            WHERE u.user_id != %s AND u.verification_status = 'verified'\n            GROUP BY u.user_id, u.firstname, u.lastname, u.username, u.university_name, \n                     u.graduation_year, u.current_city, u.pfp_path, u.role,\n                     we.company_name, we.job_title\n            ORDER BY u.lastname, u.firstname\n        ",
            (user_id,),
        )
        all_users = cur.fetchall()
        cur.execute(
            "\n            SELECT con_user_id, status, connection_id FROM connections \n            WHERE user_id = %s\n        ",
            (user_id,),
        )
        connections = {
            row[0]: {"status": row[1], "connection_id": row[2]}
            for row in cur.fetchall()
        }
        cur.execute(
            "\n            SELECT user_id, status, connection_id FROM connections \n            WHERE con_user_id = %s\n        ",
            (user_id,),
        )
        reverse_connections = {
            row[0]: {"status": row[1], "connection_id": row[2]}
            for row in cur.fetchall()
        }
        people_data = []
        for user in all_users:
            name = f"{user[1]} {user[2]}"
            avatar = user[7] if user[7] else utils.generate_default_avatar(name)
            user_data = {
                "id": user[0],
                "name": name,
                "username": user[3],
                "university": user[4] or "Not specified",
                "graduation_year": user[5] or "Not specified",
                "location": user[6] or "Not specified",
                "avatar": avatar,
                "role": user[8] or "unverified",
                "company": user[9] or "Not specified",
                "title": user[10] or "Not specified",
                "interests": user[11].split(", ") if user[11] else [],
                "connection_status": "none",
            }
            if user[0] in connections:
                user_data["connection_status"] = connections[user[0]]["status"]
                user_data["connection_id"] = connections[user[0]]["connection_id"]
            elif user[0] in reverse_connections:
                if reverse_connections[user[0]]["status"] == "accepted":
                    user_data["connection_status"] = "connected"
                elif reverse_connections[user[0]]["status"] == "pending":
                    user_data["connection_status"] = "received_request"
                    user_data["connection_id"] = reverse_connections[user[0]][
                        "connection_id"
                    ]
            people_data.append(user_data)
        universities = list(
            set(
                [
                    user["university"]
                    for user in people_data
                    if user["university"] != "Not specified"
                ]
            )
        )
        graduation_years = list(
            set(
                [
                    str(user["graduation_year"])
                    for user in people_data
                    if user["graduation_year"] != "Not specified"
                ]
            )
        )
        locations = list(
            set(
                [
                    user["location"]
                    for user in people_data
                    if user["location"] != "Not specified"
                ]
            )
        )
        universities.sort()
        graduation_years.sort(reverse=True)
        locations.sort()
        return render_template(
            "connect.html",
            people=people_data,
            universities=universities,
            graduation_years=graduation_years,
            locations=locations,
            current_user=current_user,
        )
    except Exception as e:
        app.logger.error(f"Error in connect route: {str(e)}")
        flash("Error loading connections page")
        return redirect(url_for("user_dashboard"))
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
        target_user_id = data.get("user_id")
        message = data.get("message", "")
        if not target_user_id:
            return ({"success": False, "message": "User ID is required"}, 400)
        user_id = session["user_id"]
        if user_id == target_user_id:
            return ({"success": False, "message": "Cannot connect to yourself"}, 400)
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT connection_id, status FROM connections \n            WHERE (user_id = %s AND con_user_id = %s) OR (user_id = %s AND con_user_id = %s)\n        ",
            (user_id, target_user_id, target_user_id, user_id),
        )
        existing_connection = cur.fetchone()
        if existing_connection:
            status = existing_connection[1]
            if status == "accepted":
                return ({"success": False, "message": "Already connected"}, 400)
            elif status == "pending":
                return (
                    {"success": False, "message": "Connection request already sent"},
                    400,
                )
        cur.execute(
            "\n            INSERT INTO connections (user_id, con_user_id, request, status)\n            VALUES (%s, %s, %s, 'pending')\n        ",
            (user_id, target_user_id, message),
        )
        mydb.commit()
        cur.execute(
            "SELECT firstname, lastname FROM users WHERE user_id = %s",
            (target_user_id,),
        )
        target_user = cur.fetchone()
        target_name = f"{target_user[0]} {target_user[1]}" if target_user else "User"
        return {
            "success": True,
            "message": f"Connection request sent to {target_name}",
            "status": "pending",
        }
    except Exception as e:
        app.logger.error(f"Error sending connection request: {str(e)}")
        return ({"success": False, "message": "Error sending connection request"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/respond_connection_request", methods=["POST"])
@validators.login_required
def respond_connection_request():
    """Accept or reject a connection request"""
    try:
        data = request.get_json()
        connection_id = data.get("connection_id")
        action = data.get("action")
        if not connection_id or action not in ["accept", "reject"]:
            return ({"success": False, "message": "Invalid request"}, 400)
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT user_id, con_user_id, status FROM connections \n            WHERE connection_id = %s AND con_user_id = %s AND status = 'pending'\n        ",
            (connection_id, user_id),
        )
        connection_record = cur.fetchone()
        if not connection_record:
            return ({"success": False, "message": "Connection request not found"}, 404)
        new_status = "accepted" if action == "accept" else "denied"
        cur.execute(
            "\n            UPDATE connections SET status = %s WHERE connection_id = %s\n        ",
            (new_status, connection_id),
        )
        mydb.commit()
        return {
            "success": True,
            "message": f"Connection request {action}ed",
            "status": new_status,
        }
    except Exception as e:
        app.logger.error(f"Error responding to connection request: {str(e)}")
        return ({"success": False, "message": "Error processing request"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/get_connection_requests")
@validators.login_required
def get_connection_requests():
    """Get pending connection requests for current user"""
    try:
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT c.connection_id, c.user_id, c.request,\n                   u.firstname, u.lastname, u.username, u.pfp_path\n            FROM connections c\n            JOIN users u ON c.user_id = u.user_id\n            WHERE c.con_user_id = %s AND c.status = 'pending'\n            ORDER BY c.connection_id DESC\n        ",
            (user_id,),
        )
        requests = []
        for row in cur.fetchall():
            requests.append(
                {
                    "connection_id": row[0],
                    "user_id": row[1],
                    "message": row[2],
                    "created_at": "Recently",
                    "name": f"{row[3]} {row[4]}",
                    "username": row[5],
                    "avatar": row[6],
                }
            )
        return {"success": True, "requests": requests}
    except Exception as e:
        app.logger.error(f"Error getting connection requests: {str(e)}")
        return ({"success": False, "message": "Error loading requests"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/cancel_connection_request", methods=["POST"])
@validators.login_required
def cancel_connection_request():
    """Cancel a sent connection request"""
    try:
        data = request.get_json()
        connection_id = data.get("connection_id")
        if not connection_id:
            return ({"success": False, "message": "Connection ID is required"}, 400)
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT user_id, con_user_id, status FROM connections \n            WHERE connection_id = %s AND user_id = %s AND status = 'pending'\n        ",
            (connection_id, user_id),
        )
        connection = cur.fetchone()
        if not connection:
            return ({"success": False, "message": "Connection request not found"}, 404)
        cur.execute(
            "\n            DELETE FROM connections WHERE connection_id = %s\n        ",
            (connection_id,),
        )
        mydb.commit()
        return {"success": True, "message": "Connection request cancelled successfully"}
    except Exception as e:
        app.logger.error(f"Error cancelling connection request: {str(e)}")
        return ({"success": False, "message": "Error cancelling request"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/settings")
@validators.login_required
def settings():
    """User settings page"""
    try:
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            SELECT user_id, firstname, lastname, email, username, dob,\n                   university_name, department, college, graduation_year, current_city, \n                   pfp_path, role, community_id, last_login, login_count\n            FROM users \n            WHERE user_id = %s\n        ",
            (user_id,),
        )
        user_data = cur.fetchone()
        if user_data:
            user_dict = {
                "user_id": user_data[0],
                "firstname": user_data[1],
                "lastname": user_data[2],
                "email": user_data[3],
                "username": user_data[4],
                "dob": user_data[5],
                "university_name": user_data[6],
                "department": user_data[7],
                "college": user_data[8],
                "graduation_year": user_data[9],
                "current_city": user_data[10],
                "pfp_path": user_data[11],
                "role": user_data[12],
                "community_id": user_data[13],
                "last_login": user_data[14],
                "login_count": user_data[15],
                "bio": "",
                "profile_visibility": "public",
                "email_notifications": True,
                "job_alerts": True,
                "linkedin": "",
                "github": "",
                "twitter": "",
                "website": "",
                "show_email": False,
                "allow_messages": True,
            }
        else:
            user_dict = {}
        return render_template("settings.html", user_data=user_dict)
    except Exception as e:
        app.logger.error(f"Error loading settings: {str(e)}")
        flash("Error loading settings page")
        return redirect(url_for("user_dashboard"))
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/update_account", methods=["POST"])
@validators.login_required
def update_account():
    try:
        data = request.get_json()
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        if data.get("username"):
            cur.execute(
                "SELECT user_id FROM users WHERE username = %s AND user_id != %s",
                (data["username"], user_id),
            )
            if cur.fetchone():
                return ({"success": False, "message": "Username already taken"}, 400)
        update_fields = []
        update_values = []
        if data.get("username"):
            update_fields.append("username = %s")
            update_values.append(data["username"])
        if data.get("firstName"):
            update_fields.append("firstname = %s")
            update_values.append(data["firstName"])
        if data.get("lastName"):
            update_fields.append("lastname = %s")
            update_values.append(data["lastName"])
        if data.get("university"):
            update_fields.append("university_name = %s")
            update_values.append(data["university"])
        if data.get("department"):
            update_fields.append("department = %s")
            update_values.append(data["department"])
        if data.get("college"):
            update_fields.append("college = %s")
            update_values.append(data["college"])
        if data.get("graduationYear"):
            update_fields.append("graduation_year = %s")
            update_values.append(data["graduationYear"])
        if data.get("currentCity"):
            update_fields.append("current_city = %s")
            update_values.append(data["currentCity"])
        if update_fields:
            update_values.append(user_id)
            query = f"UPDATE users SET {', '.join(update_fields)} WHERE user_id = %s"
            cur.execute(query, update_values)
            mydb.commit()
            if data.get("username"):
                session["username"] = data["username"]
        return {"success": True, "message": "Account updated successfully"}
    except Exception as e:
        app.logger.error(f"Error updating account: {str(e)}")
        return ({"success": False, "message": "Error updating account"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/update_privacy", methods=["POST"])
@validators.login_required
def update_privacy():
    """Update privacy settings"""
    try:
        data = request.get_json()
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            UPDATE users SET \n                profile_visibility = %s\n            WHERE user_id = %s\n        ",
            (data.get("profileVisibility", "public"), user_id),
        )
        mydb.commit()
        return {"success": True, "message": "Privacy settings updated successfully"}
    except Exception as e:
        app.logger.error(f"Error updating privacy: {str(e)}")
        return ({"success": False, "message": "Error updating privacy settings"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/update_preferences", methods=["POST"])
@validators.login_required
def update_preferences():
    """Update user preferences (client-side only for now)"""
    try:
        data = request.get_json()
        return {"success": True, "message": "Preferences updated successfully"}
    except Exception as e:
        app.logger.error(f"Error updating preferences: {str(e)}")
        return ({"success": False, "message": "Error updating preferences"}, 500)


@app.route("/api/update_notifications", methods=["POST"])
@validators.login_required
def update_notifications():
    """Update notification settings"""
    try:
        data = request.get_json()
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "\n            UPDATE users SET \n                email_notifications = %s,\n                job_alerts = %s\n            WHERE user_id = %s\n        ",
            (
                data.get("emailNotifications", False),
                data.get("jobAlerts", False),
                user_id,
            ),
        )
        mydb.commit()
        return {
            "success": True,
            "message": "Notification settings updated successfully",
        }
    except Exception as e:
        app.logger.error(f"Error updating notifications: {str(e)}")
        return (
            {"success": False, "message": "Error updating notification settings"},
            500,
        )
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/change_password", methods=["POST"])
@validators.login_required
def change_password():
    """Change user password"""
    try:
        data = request.get_json()
        user_id = session["user_id"]
        current_password = data.get("currentPassword")
        new_password = data.get("newPassword")
        if not current_password or not new_password:
            return (
                {
                    "success": False,
                    "message": "Both current and new passwords are required",
                },
                400,
            )
        if len(new_password) < 8:
            return (
                {
                    "success": False,
                    "message": "New password must be at least 8 characters long",
                },
                400,
            )
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute("SELECT password FROM users WHERE user_id = %s", (user_id,))
        row = cur.fetchone()
        if not row or not bcrypt.check_password_hash(row[0], current_password):
            return ({"success": False, "message": "Current password is incorrect"}, 400)
        hashed_new_password = bcrypt.generate_password_hash(new_password).decode(
            "utf-8"
        )
        cur.execute(
            "UPDATE users SET password = %s WHERE user_id = %s",
            (hashed_new_password, user_id),
        )
        mydb.commit()
        return {"success": True, "message": "Password changed successfully"}
    except Exception as e:
        app.logger.error(f"Error changing password: {str(e)}")
        return ({"success": False, "message": "Error changing password"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/update_profile_picture", methods=["POST"])
@validators.login_required
def update_profile_picture():
    """Update user profile picture using ImgBB API"""
    try:
        user_id = session["user_id"]
        if "profile_picture" not in request.files:
            return ({"success": False, "message": "No image file provided"}, 400)
        file = request.files["profile_picture"]
        if file.filename == "":
            return ({"success": False, "message": "No file selected"}, 400)
        if not validators.allowed_file(file.filename):
            return (
                {
                    "success": False,
                    "message": "Invalid file type. Please upload an image file.",
                },
                400,
            )
        imgbb_api_key = os.getenv("PFP_KEY")
        if not imgbb_api_key:
            app.logger.error("PFP_KEY not found in environment variables")
            return (
                {"success": False, "message": "Image upload service not configured"},
                500,
            )
        try:
            pfp_url = utils.upload_to_imgbb(file, imgbb_api_key)
            if not pfp_url:
                return ({"success": False, "message": "Failed to upload image"}, 500)
        except Exception as upload_error:
            app.logger.error(f"ImgBB upload error: {str(upload_error)}")
            return (
                {"success": False, "message": "Failed to upload image to server"},
                500,
            )
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute(
            "UPDATE users SET pfp_path = %s WHERE user_id = %s", (pfp_url, user_id)
        )
        mydb.commit()
        session["pfp_path"] = pfp_url
        return {
            "success": True,
            "message": "Profile picture updated successfully",
            "pfp_url": pfp_url,
        }
    except Exception as e:
        app.logger.error(f"Error updating profile picture: {str(e)}")
        return ({"success": False, "message": "Error updating profile picture"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


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


@app.route("/api/deactivate_account", methods=["POST"])
@validators.login_required
def deactivate_account():
    """Deactivate user account"""
    try:
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute("UPDATE users SET verified = FALSE WHERE user_id = %s", (user_id,))
        mydb.commit()
        session.clear()
        return {"success": True, "message": "Account deactivated successfully"}
    except Exception as e:
        app.logger.error(f"Error deactivating account: {str(e)}")
        return ({"success": False, "message": "Error deactivating account"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/delete_account", methods=["POST"])
@validators.login_required
def delete_account():
    """Delete user account permanently"""
    try:
        user_id = session["user_id"]
        mydb = connection.get_db_connection()
        cur = mydb.cursor()
        cur.execute("DELETE FROM user_interests WHERE user_id = %s", (user_id,))
        cur.execute(
            "DELETE FROM connections WHERE user_id = %s OR con_user_id = %s",
            (user_id, user_id),
        )
        cur.execute(
            "DELETE FROM messages WHERE sender_id = %s OR receiver_id = %s",
            (user_id, user_id),
        )
        cur.execute("DELETE FROM education_details WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM work_experience WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))
        mydb.commit()
        session.clear()
        return {"success": True, "message": "Account deleted successfully"}
    except Exception as e:
        app.logger.error(f"Error deleting account: {str(e)}")
        return ({"success": False, "message": "Error deleting account"}, 500)
    finally:
        if "cur" in locals() and cur:
            cur.close()
        if "mydb" in locals() and mydb:
            mydb.close()


@app.route("/api/logout_all_sessions", methods=["POST"])
@validators.login_required
def logout_all_sessions():
    """Logout from all sessions"""
    try:
        session.clear()
        return {"success": True, "message": "Logged out from all sessions"}
    except Exception as e:
        app.logger.error(f"Error logging out sessions: {str(e)}")
        return ({"success": False, "message": "Error logging out sessions"}, 500)


@app.route("/logout")
def logout():
    """Logout user"""
    session.clear()
    flash("You have been logged out successfully")
    return redirect(url_for("home"))


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "True") == "True"
    print("🐍 Starting Python Flask Server...")
    print("📡 Web pages and API endpoints")
    print("🚀 Real-time features handled by Go WebSocket server")
    app.run(host="0.0.0.0", port=port, debug=debug)
