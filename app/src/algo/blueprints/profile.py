from flask import (
    Blueprint, flash, redirect, render_template, request, session, url_for, current_app
)
import os
import datetime
from algo.db import get_db
from algo.auth.decorators import login_required
from algo.utils import is_safe_url
from algo import utils
from algo import validators

bp = Blueprint('profile', __name__)

@bp.route('/')
@login_required
def profile_redirect():
    return redirect(url_for('profile.user_profile', username=session['username']))

@bp.route('/<username>')
@login_required
def user_profile(username):
    db = get_db()
    cur = db.cursor()
    user_id = session.get('user_id')

    cur.execute(
        """
        SELECT user_id, firstname, lastname, email, username, dob, graduation_year, 
               university_name, department, college, current_city, pfp_path, 
               registration_date, role, enrollment_number, community_id, last_login, login_count
        FROM users 
        WHERE username = %s OR user_id = %s
    """,
        (username, user_id),
    )

    user_data = cur.fetchone()
    if not user_data:
        flash('User not found')
        return redirect(url_for('core.home'))

    cur.execute(
        """
        SELECT i.name 
        FROM interests i
        JOIN user_interests ui ON i.interest_id = ui.interest_id
        WHERE ui.user_id = %s
    """,
        (user_data[0],),
    )

    user_interests = [row[0] for row in cur.fetchall()]

    cur.execute(
        """
        SELECT degree_type, university_name, college_name, major, graduation_year
        FROM education_details 
        WHERE user_id = %s
    """,
        (user_data[0],),
    )

    education_data = cur.fetchone()

    cur.execute(
        """
        SELECT company_name, job_title, join_year, leave_year
        FROM work_experience 
        WHERE user_id = %s
        ORDER BY join_year DESC
    """,
        (user_data[0],),
    )

    work_experience = cur.fetchall()

    cur.execute(
        """
        SELECT COUNT(*) 
        FROM connections 
        WHERE (user_id = %s OR con_user_id = %s) AND status = 'accepted'
    """,
        (user_data[0], user_data[0]),
    )

    connections_count = cur.fetchone()[0]
    
    # Get community name if exists
    community_name = None
    if user_data[15]:
        cur.execute(
            "SELECT name FROM communities WHERE community_id = %s", (user_data[15],)
        )
        community_result = cur.fetchone()
        if community_result:
            community_name = community_result[0]

    # Get current logged-in user's info for the dropdown
    current_user_info = None
    if user_id != user_data[0]:  # If viewing someone else's profile
        cur.execute(
            """
            SELECT user_id, firstname, lastname, email, username, pfp_path, role
            FROM users 
            WHERE user_id = %s
        """,
            (user_id,),
        )
        current_user_info = cur.fetchone()

    cur.close()

    return render_template(
        'profile.html',
        user_data=user_data,
        user_interests=user_interests,
        education_data=education_data,
        work_experience=work_experience,
        connections_count=connections_count,
        community_name=community_name,
        current_user_info=current_user_info,
        user_bio=None,
        user_skills=[],
        user_social_links=None,
        user_phone=None,
    )

@bp.route("/complete_profile", methods=["GET", "POST"])
@login_required
def complete_profile():
    db = get_db()
    cur = db.cursor()
    try:
        cutoff_date = (
            datetime.datetime.utcnow()
            .date()
            .replace(year=datetime.datetime.utcnow().year - 16)
        )
        cities = utils.load_cities()
        if request.method == "POST":
            # Personal Information
            first_name = request.form.get("first_name", "")
            last_name = request.form.get("last_name", "")
            dob = request.form["dob"]
            bio = request.form.get("bio", "")

            # Role Information
            role = request.form.get("role")
            student_id = request.form.get("student_id", "")
            alumni_id = request.form.get("alumni_id", "")
            employee_id = request.form.get("employee_id", "")
            department_role = request.form.get("department_role", "")

            # Education Information
            uni_name = request.form["uni_name"]
            clg_name = request.form.get("clg_name", "")
            degree = request.form.get("degree", "")
            major = request.form.get("major", "")
            grad_year = request.form["grad_year"]
            gpa = request.form.get("gpa", "")

            # Location
            city = request.form["city"]

            # Work Experience
            company = request.form.get("company", "")
            job_title = request.form.get("job_title", "")
            join_year = request.form.get("join_year", "")
            leave_year = request.form.get("leave_year", "")

            # Skills and Interests
            skills = request.form.get("skills", "")
            interests = request.form.get("interests", "")

            # Social Links
            linkedin = request.form.get("linkedin", "")
            github = request.form.get("github", "")
            twitter = request.form.get("twitter", "")
            website = request.form.get("website", "")

            # Privacy Settings
            profile_visibility = request.form.get("profile_visibility", "")
            email_notifications = request.form.get("email_notifications", "")
            job_alerts = request.form.get("job_alerts", "")

            # Handle profile picture upload
            pfp_file = request.files.get("pfp")
            pfp_url = None
            if pfp_file and validators.allowed_file(pfp_file.filename):
                pfp_url = utils.upload_to_imgbb(pfp_file, os.getenv("PFP_API"))

            # Validate age
            dob_date = datetime.datetime.strptime(dob, "%Y-%m-%d").date()
            today = datetime.date.today()
            age = (
                today.year
                - dob_date.year
                - ((today.month, today.day) < (dob_date.month, dob_date.day))
            )

            if age < 16:
                return render_template(
                    "complete_profile.html",
                    cities=cities,
                    error="You must be atleast 16",
                )

            user_id = session.get("user_id")

            # Validate role selection
            if not role or role not in ["student", "alumni", "staff"]:
                return render_template(
                    "complete_profile.html",
                    cities=cities,
                    cutoff_date=cutoff_date,
                    error="Please select a valid role",
                )

            # Validate role-specific fields
            if role == "student" and not student_id:
                return render_template(
                    "complete_profile.html",
                    cities=cities,
                    cutoff_date=cutoff_date,
                    error="Student ID is required for student role",
                )
            elif role == "staff" and (not employee_id or not department_role):
                return render_template(
                    "complete_profile.html",
                    cities=cities,
                    cutoff_date=cutoff_date,
                    error="Employee ID and Department/Position are required for staff role",
                )

            # Update users table with basic info and role
            cur.execute(
                """
                UPDATE users SET 
                    firstname=%s, lastname=%s, dob=%s,
                    university_name=%s, college=%s, graduation_year=%s, current_city=%s, 
                    pfp_path=%s, role=%s, verification_status=%s
                WHERE user_id=%s
            """,
                (
                    first_name,
                    last_name,
                    dob,
                    uni_name,
                    clg_name,
                    grad_year,
                    city,
                    pfp_url,
                    role,
                    "verified" if role == "admin" else "pending",
                    user_id,
                ),
            )

            # Insert education details if provided
            if degree or major or gpa:
                # Check if education record exists
                cur.execute(
                    "SELECT COUNT(*) FROM education_details WHERE user_id = %s",
                    (user_id,),
                )
                if cur.fetchone()[0] > 0:
                    # Update existing record
                    cur.execute(
                        """
                        UPDATE education_details SET 
                            degree_type=%s, major=%s, university_name=%s, college_name=%s, 
                            graduation_year=%s, gpa=%s
                        WHERE user_id=%s
                    """,
                        (
                            degree,
                            major,
                            uni_name,
                            clg_name,
                            grad_year,
                            float(gpa) if gpa else None,
                            user_id,
                        ),
                    )
                else:
                    # Insert new record
                    cur.execute(
                        """
                        INSERT INTO education_details 
                        (user_id, degree_type, major, university_name, college_name, graduation_year, gpa)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                        (
                            user_id,
                            degree,
                            major,
                            uni_name,
                            clg_name,
                            grad_year,
                            float(gpa) if gpa else None,
                        ),
                    )

            # Insert work experience if provided (and not "None" or empty)
            if company and company.lower() not in ["none", "n/a", ""] and job_title:
                # Check if work experience record exists
                cur.execute(
                    "SELECT COUNT(*) FROM work_experience WHERE user_id = %s",
                    (user_id,),
                )
                if cur.fetchone()[0] > 0:
                    # Update existing record
                    cur.execute(
                        """
                        UPDATE work_experience SET 
                            company_name=%s, job_title=%s, join_year=%s, leave_year=%s
                        WHERE user_id=%s
                    """,
                        (
                            company,
                            job_title,
                            int(join_year) if join_year else None,
                            int(leave_year) if leave_year else None,
                            user_id,
                        ),
                    )
                else:
                    # Insert new record
                    cur.execute(
                        """
                        INSERT INTO work_experience 
                        (user_id, company_name, job_title, join_year, leave_year)
                        VALUES (%s, %s, %s, %s, %s)
                    """,
                        (
                            user_id,
                            company,
                            job_title,
                            int(join_year) if join_year else None,
                            int(leave_year) if leave_year else None,
                        ),
                    )

            # Update session with new profile picture and name
            if pfp_url:
                session["pfp_path"] = pfp_url
            if first_name and last_name:
                session["username"] = f"{first_name} {last_name}"

            # Update session with role information
            session["role"] = role
            session["verification_status"] = (
                "verified" if role == "admin" else "pending"
            )

            db.commit()

            # Redirect to interests page to complete profile setup
            return redirect(url_for("profile.interests"))
        return render_template(
            "complete_profile.html", cities=cities, cutoff_date=cutoff_date
        )
    except Exception as e:
        current_app.logger.error(f"Error during complete_profile: {str(e)}")
        flash("An unexpected error occurred. Please try again.")
        return render_template("complete_profile.html"), 500
    finally:
        cur.close()

@bp.route("/interests", methods=["GET", "POST"])
@login_required
def interests():
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("SELECT interest_id, name FROM interests ORDER BY name")
        db_interests = cur.fetchall()

        if request.method == "POST":
            selected_interests = request.form.getlist("interests")
            user_id = session["user_id"]

            cur.execute("DELETE FROM user_interests where user_id=%s", (user_id,))

            for interest_id in selected_interests:
                cur.execute(
                    "INSERT INTO user_interests (user_id,interest_id) VALUES (%s,%s) ",
                    (user_id, interest_id),
                )
            db.commit()

            # Check for saved redirect URL after profile completion
            post_profile_redirect = session.pop("post_profile_redirect", None)
            if post_profile_redirect and is_safe_url(post_profile_redirect):
                return redirect(post_profile_redirect)
            else:
                return redirect(url_for("user_dashboard"))
        return render_template("interests.html", db_interests=db_interests)

    except Exception as e:
        current_app.logger.error(f"Error updating interests: {str(e)}")
        flash("There was an error saving your interests.")
        return redirect(url_for("core.home"))
    finally:
        cur.close()
