"""
User Roles Management Module
Handles user role verification, permissions, and access control
"""

from functools import wraps
from flask import session, redirect, url_for, flash, request
from .connection import get_db_connection
import datetime

class UserRoles:
    STUDENT = 'student'
    ALUMNI = 'alumni'
    ADMIN = 'admin'
    UNVERIFIED = 'unverified'

class VerificationStatus:
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'

def get_user_role_info(user_id):
    """Get comprehensive user role information"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        cur.execute("""
            SELECT u.role, u.community_id, u.verification_status, u.verified_at,
                   c.name, c.college_code, u.enrollment_number, u.graduation_year, u.department
            FROM users u
            LEFT JOIN communities c ON u.community_id = c.community_id
            WHERE u.user_id = %s
        """, (user_id,))
        
        result = cur.fetchone()
        if result:
            return {
                'role': result[0],
                'community_id': result[1],
                'verification_status': result[2],
                'verified_at': result[3],
                'community_name': result[4],
                'college_code': result[5],
                'enrollment_number': result[6],
                'graduation_year': result[7],
                'department': result[8]
            }
        return None
        
    finally:
        cur.close()
        mydb.close()

def is_admin(user_id, community_id=None):
    """Check if user is admin (optionally for specific community)"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        if community_id:
            cur.execute("""
                SELECT ap.permission_id FROM admin_permissions ap
                JOIN users u ON ap.admin_user_id = u.user_id
                WHERE u.user_id = %s AND ap.community_id = %s AND ap.is_active = TRUE
            """, (user_id, community_id))
        else:
            cur.execute("""
                SELECT role FROM users WHERE user_id = %s AND role = 'admin'
            """, (user_id,))
        
        return cur.fetchone() is not None
        
    finally:
        cur.close()
        mydb.close()

def is_verified_user(user_id):
    """Check if user is verified (student, alumni, or admin)"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        cur.execute("""
            SELECT role FROM users 
            WHERE user_id = %s AND role IN ('student', 'alumni', 'admin')
        """, (user_id,))
        
        return cur.fetchone() is not None
        
    finally:
        cur.close()
        mydb.close()

def can_access_community_features(user_id, community_id):
    """Check if user can access community-specific features"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        cur.execute("""
            SELECT role, community_id FROM users 
            WHERE user_id = %s AND community_id = %s 
            AND role IN ('student', 'alumni', 'admin')
        """, (user_id, community_id))
        
        return cur.fetchone() is not None
        
    finally:
        cur.close()
        mydb.close()

def get_communities():
    """Get list of all communities"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        cur.execute("""
            SELECT community_id, name, college_code, location 
            FROM communities ORDER BY name
        """)
        
        communities = []
        for row in cur.fetchall():
            communities.append({
                'id': row[0],
                'name': row[1],
                'code': row[2] if row[2] else '',
                'location': row[3] if row[3] else ''
            })
        return communities
        
    finally:
        cur.close()
        mydb.close()

def submit_verification_request(user_id, community_id, requested_role, student_id=None, 
                              graduation_year=None, department=None, request_message=None):
    """Submit a verification request"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        # Check if user already has a pending request for this community
        cur.execute("""
            SELECT request_id FROM verification_requests 
            WHERE user_id = %s AND community_id = %s AND status = 'pending'
        """, (user_id, community_id))
        
        if cur.fetchone():
            return False, "You already have a pending verification request for this community."
        
        # Insert new verification request
        cur.execute("""
            INSERT INTO verification_requests 
            (user_id, community_id, requested_role, student_id, graduation_year, 
             department, request_message, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (user_id, community_id, requested_role, student_id, graduation_year, 
              department, request_message, datetime.datetime.utcnow()))
        
        mydb.commit()
        return True, "Verification request submitted successfully!"
        
    except Exception as e:
        mydb.rollback()
        return False, f"Error submitting request: {str(e)}"
        
    finally:
        cur.close()
        mydb.close()

def get_pending_verification_requests(admin_user_id):
    """Get pending verification requests for admin's communities"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        cur.execute("""
            SELECT vr.request_id, vr.user_id, u.firstname, u.lastname, u.email,
                   vr.requested_role, vr.student_id, vr.graduation_year, vr.department,
                   vr.request_message, vr.created_at, c.name
            FROM verification_requests vr
            JOIN users u ON vr.user_id = u.user_id
            JOIN communities c ON vr.community_id = c.community_id
            JOIN admin_permissions ap ON vr.community_id = ap.community_id
            WHERE ap.admin_user_id = %s AND ap.is_active = TRUE 
            AND vr.status = 'pending'
            ORDER BY vr.created_at DESC
        """, (admin_user_id,))
        
        requests = []
        for row in cur.fetchall():
            requests.append({
                'request_id': row[0],
                'user_id': row[1],
                'firstname': row[2],
                'lastname': row[3],
                'email': row[4],
                'requested_role': row[5],
                'student_id': row[6],
                'graduation_year': row[7],
                'department': row[8],
                'request_message': row[9],
                'created_at': row[10],
                'college_name': row[11]
            })
        return requests
        
    finally:
        cur.close()
        mydb.close()

def approve_verification_request(request_id, admin_user_id, review_notes=None):
    """Approve a verification request"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        # Get request details
        cur.execute("""
            SELECT user_id, community_id, requested_role, student_id, graduation_year, department
            FROM verification_requests WHERE request_id = %s AND status = 'pending'
        """, (request_id,))
        
        request_data = cur.fetchone()
        if not request_data:
            return False, "Request not found or already processed."
        
        user_id, community_id, requested_role, student_id, graduation_year, department = request_data
        
        # Update user record
        cur.execute("""
            UPDATE users SET 
                role = %s, community_id = %s, verification_status = 'approved',
                verified_by = %s, verified_at = %s, enrollment_number = %s,
                graduation_year = %s, department = %s
            WHERE user_id = %s
        """, (requested_role, community_id, admin_user_id, datetime.datetime.utcnow(),
              student_id, graduation_year, department, user_id))
        
        # Update verification request
        cur.execute("""
            UPDATE verification_requests SET 
                status = 'approved', reviewed_by = %s, reviewed_at = %s, review_notes = %s
            WHERE request_id = %s
        """, (admin_user_id, datetime.datetime.utcnow(), review_notes, request_id))
        
        mydb.commit()
        return True, "User verified successfully!"
        
    except Exception as e:
        mydb.rollback()
        return False, f"Error approving request: {str(e)}"
        
    finally:
        cur.close()
        mydb.close()

def reject_verification_request(request_id, admin_user_id, review_notes=None):
    """Reject a verification request"""
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        cur.execute("""
            UPDATE verification_requests SET 
                status = 'rejected', reviewed_by = %s, reviewed_at = %s, review_notes = %s
            WHERE request_id = %s AND status = 'pending'
        """, (admin_user_id, datetime.datetime.utcnow(), review_notes, request_id))
        
        if cur.rowcount == 0:
            return False, "Request not found or already processed."
        
        mydb.commit()
        return True, "Request rejected successfully."
        
    except Exception as e:
        mydb.rollback()
        return False, f"Error rejecting request: {str(e)}"
        
    finally:
        cur.close()
        mydb.close()

# Decorators for access control
def login_required(f):
    """Require user to be logged in"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def verified_user_required(f):
    """Require user to be verified (student, alumni, or admin)"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        
        if not is_verified_user(session['user_id']):
            flash('You need to be verified to access this feature. Please submit a verification request.', 'warning')
            return redirect(url_for('verification_request'))
        
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    """Require user to be admin"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        
        user_role_info = get_user_role_info(session['user_id'])
        if not user_role_info or user_role_info['role'] != 'admin':
            flash('Admin access required.', 'error')
            return redirect(url_for('user_dashboard'))
        
        return f(*args, **kwargs)
    return decorated_function

def community_access_required(f):
    """Require user to have access to community features"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'error')
            return redirect(url_for('login'))
        
        # Get community_id from request args or form
        community_id = request.args.get('community_id') or request.form.get('community_id')
        
        if not community_id:
            flash('Community information required.', 'error')
            return redirect(url_for('user_dashboard'))
        
        if not can_access_community_features(session['user_id'], community_id):
            flash('You do not have access to this community\'s features.', 'error')
            return redirect(url_for('user_dashboard'))
        
        return f(*args, **kwargs)
    return decorated_function