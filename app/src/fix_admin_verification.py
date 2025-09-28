#!/usr/bin/env python3
"""
Fix admin user verification status in database
"""

import sys
import os

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app', 'src'))

from connection import get_db_connection

def fix_admin_verification():
    """Fix verification status for admin users"""
    
    conn = None
    cur = None
    
    try:
        print("Connecting to database...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check current status of lewis.for.the.win
        print("Checking current status of lewis.for.the.win...")
        cur.execute("""
            SELECT username, role, verification_status, verified 
            FROM users 
            WHERE username = %s
        """, ('lewis.for.the.win',))
        
        user_data = cur.fetchone()
        if user_data:
            username, role, verification_status, verified = user_data
            print(f"Current status: username={username}, role={role}, verification_status={verification_status}, verified={verified}")
        else:
            print("User lewis.for.the.win not found!")
            return False
        
        # Fix admin verification status
        print("Updating admin verification status...")
        cur.execute("""
            UPDATE users 
            SET verification_status = 'verified', 
                verified_at = CURRENT_TIMESTAMP,
                verified = TRUE
            WHERE role = 'admin' 
            AND (verification_status != 'verified' OR verification_status IS NULL OR verified = FALSE)
        """)
        
        rows_updated = cur.rowcount
        conn.commit()
        
        print(f"Updated {rows_updated} admin user(s)")
        
        # Verify the fix
        print("Verifying fix for lewis.for.the.win...")
        cur.execute("""
            SELECT username, role, verification_status, verified 
            FROM users 
            WHERE username = %s
        """, ('lewis.for.the.win',))
        
        user_data = cur.fetchone()
        if user_data:
            username, role, verification_status, verified = user_data
            print(f"Updated status: username={username}, role={role}, verification_status={verification_status}, verified={verified}")
        
        print("Admin verification status fixed successfully!")
        return True
        
    except Exception as e:
        print(f"Error fixing admin verification: {str(e)}")
        if conn:
            conn.rollback()
        return False
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    success = fix_admin_verification()
    if not success:
        sys.exit(1)
