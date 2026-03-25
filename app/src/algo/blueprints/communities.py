from flask import Blueprint, render_template, session, redirect, url_for, flash, request, jsonify, current_app
from algo.db import get_db
from algo.auth.decorators import login_required
from algo.auth import user_roles
import datetime
import utils

bp = Blueprint('communities', __name__)

@bp.route("/channels", methods=["GET", "POST"])
@login_required
@user_roles.verified_user_required
def channels():
    """Main channels page - Discord-like interface"""
    user_id = session["user_id"]
    try:
        db = get_db()
        cur = db.cursor()
        cur.execute(
            """
            SELECT c.community_id, c.name, c.description, cm.role
            FROM communities c
            JOIN community_members cm ON c.community_id = cm.community_id
            WHERE cm.user_id = %s AND cm.status = 'active'
            ORDER BY c.name
            """,
            (user_id,),
        )
        communities = cur.fetchall()
        if not communities:
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
        if selected_community_id:
            cur.execute(
                """
                SELECT DISTINCT c.channel_id, c.name, c.description, c.channel_type, c.is_private, c.position_order, c.created_at
                FROM channels c
                LEFT JOIN channel_members cm ON c.channel_id = cm.channel_id
                WHERE c.community_id = %s AND c.is_active = true
                AND (
                    c.is_private = false OR 
                    (c.is_private = true AND cm.user_id = %s)
                )
                ORDER BY c.position_order, c.created_at
                """,
                (selected_community_id, user_id),
            )
            channels_list = cur.fetchall()
        cur.close()
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
        flash("Error loading channels", "error")
        return render_template("channels.html", communities=[], channels=[])

@bp.route("/create_community", methods=["GET", "POST"])
@login_required
def create_community():
    """Create Community page - only for admin and college_admin roles"""
    user_id = session["user_id"]
    user_role = session.get("role", "user")
    if user_role not in ["admin", "college_admin"]:
        flash("Access denied. Only administrators can create communities.", "error")
        return redirect(url_for("dashboard.user_dashboard"))
    try:
        db = get_db()
        cur = db.cursor()
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
                """
                INSERT INTO communities (name, college_code, location, description, created_by, created_at)
                VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                """,
                (community_name, college_code, location, description, user_id),
            )
            db.commit()
            flash(f"Community '{community_name}' created successfully!", "success")
            return redirect(url_for("dashboard.admin_dashboard"))
        cur.execute(
            "SELECT firstname, lastname, role, pfp_path FROM users WHERE user_id = %s",
            (user_id,),
        )
        current_user = cur.fetchone()
        return render_template("create_community.html", current_user=current_user)
    except Exception as e:
        flash("Error creating community. Please try again.", "error")
        return redirect(url_for("dashboard.admin_dashboard"))
    finally:
        cur.close()

@bp.route("/user_role_info")
@login_required
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
        return {"success": False, "message": "Error retrieving user information"}

@bp.route("/check_community_access/<int:community_id>")
@user_roles.verified_user_required
def check_community_access(community_id):
    """Check if user has access to community features"""
    try:
        user_id = session["user_id"]
        has_access = user_roles.can_access_community_features(user_id, community_id)
        return {"success": True, "has_access": has_access}
    except Exception as e:
        return {"success": False, "message": "Error checking access"}
