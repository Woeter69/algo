from flask import (
    Blueprint, flash, redirect, render_template, request, session, url_for
)
from algo.db import get_db
from algo.auth.decorators import login_required
import utils

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
