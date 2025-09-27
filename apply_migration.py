#!/usr/bin/env python3
"""
Apply database migration to fix education_details constraint
"""

import sys
import os

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app', 'src'))

from connection import get_db_connection

def apply_migration():
    """Apply the education_details constraint fix"""
    
    migration_sql = """
    -- Drop the existing constraint
    ALTER TABLE education_details DROP CONSTRAINT IF EXISTS education_details_degree_type_check;
    
    -- Add the gpa column if it doesn't exist
    ALTER TABLE education_details ADD COLUMN IF NOT EXISTS gpa DECIMAL(3,2);
    
    -- Add the updated constraint with more degree types
    ALTER TABLE education_details ADD CONSTRAINT education_details_degree_type_check 
    CHECK (degree_type IN ('Bachelors','Masters','PHD','Doctorate','B Tech','M Tech','B.E.','M.E.','B.Sc.','M.Sc.','BCA','MCA','MBA','BBA','Diploma'));
    """
    
    conn = None
    cur = None
    
    try:
        print("Connecting to database...")
        conn = get_db_connection()
        cur = conn.cursor()
        
        print("Applying migration to fix education_details constraint...")
        cur.execute(migration_sql)
        conn.commit()
        
        print("✅ Migration applied successfully!")
        print("The education_details table now supports the following degree types:")
        print("- Bachelors, Masters, PHD, Doctorate")
        print("- B Tech, M Tech, B.E., M.E.")
        print("- B.Sc., M.Sc., BCA, MCA")
        print("- MBA, BBA, Diploma")
        print("- Added GPA column (DECIMAL(3,2))")
        
    except Exception as e:
        print(f"❌ Error applying migration: {str(e)}")
        if conn:
            conn.rollback()
        return False
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()
    
    return True

if __name__ == "__main__":
    success = apply_migration()
    if not success:
        sys.exit(1)
