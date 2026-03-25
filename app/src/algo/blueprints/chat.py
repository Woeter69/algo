from flask import Blueprint, render_template, session, redirect, url_for, flash, request, jsonify, current_app
from algo.db import get_db
from algo.auth.decorators import login_required
from algo.auth import user_roles
from algo import utils
import datetime

bp = Blueprint('chat', __name__)

@bp.route("/chat")
@bp.route("/chat_list")
@login_required
@user_roles.verified_user_required
def chat_list():
    user_id = session["user_id"]
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            """
            SELECT DISTINCT other_user_id FROM (
                -- Users from message history
                SELECT CASE 
                    WHEN m.sender_id = %s THEN m.receiver_id 
                    ELSE m.sender_id 
                END as other_user_id
                FROM messages m
                WHERE m.sender_id = %s OR m.receiver_id = %s
                
                UNION
                
                -- Users from accepted connections
                SELECT CASE 
                    WHEN c.user_id = %s THEN c.con_user_id 
                    ELSE c.user_id 
                END as other_user_id
                FROM connections c
                WHERE (c.user_id = %s OR c.con_user_id = %s) AND c.status = 'accepted'
            ) AS combined_users
            """,
            (user_id, user_id, user_id, user_id, user_id, user_id),
        )
        user_ids = cur.fetchall()
        chat_history = []
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
                    """
                    SELECT content, created_at 
                    FROM messages 
                    WHERE (sender_id = %s AND receiver_id = %s) 
                       OR (sender_id = %s AND receiver_id = %s)
                    ORDER BY created_at DESC 
                    LIMIT 1
                    """,
                    (user_id, other_user_id, other_user_id, user_id),
                )
                message_data = cur.fetchone()
                if message_data:
                    last_message = message_data[0]
                    last_message_time = message_data[1]
                else:
                    cur.execute(
                        """
                        SELECT 1 FROM connections 
                        WHERE ((user_id = %s AND con_user_id = %s) OR (user_id = %s AND con_user_id = %s)) 
                        AND status = 'accepted'
                        """,
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
    except Exception as e:
        chat_history = []
    finally:
        cur.close()
    return render_template("chat_list.html", conversations=chat_history)

@bp.route("/api/online_status")
@login_required
def get_online_status():
    """Return list of currently online user IDs - now handled by Go WebSocket server"""
    return jsonify(
        {"online_users": [], "message": "Online status handled by Go WebSocket server"}
    )

@bp.route("/api/upload_image", methods=["POST"])
@login_required
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
            upload_dir = os.path.join(current_app.static_folder, "uploads")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, unique_filename)
            file.save(file_path)
            image_url = f"/static/uploads/{unique_filename}"
            return {"image_url": image_url}
        return ({"error": "Invalid file type"}, 400)
    except Exception as e:
        return ({"error": "Upload failed"}, 500)

@bp.route("/chat/<username>")
@login_required
def chat(username):
    user_id = session["user_id"]
    db = get_db()
    cur = db.cursor()
    cur.execute(
        "SELECT user_id, username, pfp_path, firstname, lastname FROM users WHERE username=%s",
        (username,),
    )
    other_user_row = cur.fetchone()
    if not other_user_row:
        flash("User not found")
        return redirect(url_for("dashboard.user_dashboard"))
    other_user_id, other_user_name, other_user_pfp, other_firstname, other_lastname = (
        other_user_row
    )
    if not other_user_pfp:
        other_full_name = f"{other_firstname or ''} {other_lastname or ''}".strip()
        other_user_pfp = utils.generate_default_avatar(
            other_full_name or other_user_name
        )
    cur.execute(
        """
        SELECT m.sender_id, m.receiver_id, m.content, m.created_at, u.username
        FROM messages m
        JOIN users u ON m.sender_id = u.user_id
        WHERE (m.sender_id=%s AND m.receiver_id=%s) OR (m.sender_id=%s AND m.receiver_id=%s)
        ORDER BY m.created_at
        """,
        (user_id, other_user_id, other_user_id, user_id),
    )
    conversation = cur.fetchall()
    try:
        cur.execute(
            """
            SELECT DISTINCT 
                CASE 
                    WHEN m.sender_id = %s THEN m.receiver_id 
                    ELSE m.sender_id 
                END as other_user_id
            FROM messages m
            WHERE m.sender_id = %s OR m.receiver_id = %s
            """,
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
                    """
                    SELECT content, created_at 
                    FROM messages 
                    WHERE (sender_id = %s AND receiver_id = %s) 
                       OR (sender_id = %s AND receiver_id = %s)
                    ORDER BY created_at DESC 
                    LIMIT 1
                    """,
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
        chat_history = []
    finally:
        cur.close()
    return render_template(
        "chat.html",
        conversation=conversation,
        other_user_id=other_user_id or None,
        other_user_name=other_user_name or "",
        other_user_pfp=other_user_pfp or "",
        chat_history=chat_history or [],
        current_user_id=user_id or None,
    )
