"""
Database Migration Script for User Role System
Run this script to update your database with the new user role system
"""

import psycopg2
from connection import get_db_connection
import datetime

def create_user_role_system():
    """Create tables and update existing schema for user role system"""
    
    mydb = get_db_connection()
    cur = mydb.cursor()
    
    try:
        # Create user_roles enum if it doesn't exist
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE user_role AS ENUM ('student', 'alumni', 'admin', 'unverified');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        
        # Create verification_status enum
        cur.execute("""
            DO $$ BEGIN
                CREATE TYPE verification_status AS ENUM ('pending', 'approved', 'rejected');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """)
        
        # Create colleges table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS colleges (
                college_id SERIAL PRIMARY KEY,
                college_name VARCHAR(255) NOT NULL UNIQUE,
                college_code VARCHAR(10) NOT NULL UNIQUE,
                location VARCHAR(255),
                established_year INTEGER,
                website VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Add role-related columns to users table if they don't exist
        try:
            cur.execute("ALTER TABLE users ADD COLUMN user_role user_role DEFAULT 'unverified';")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN college_id INTEGER REFERENCES colleges(college_id);")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN verification_status verification_status DEFAULT 'pending';")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN verified_by INTEGER REFERENCES users(user_id);")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN verified_at TIMESTAMP;")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN student_id VARCHAR(50);")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN graduation_year INTEGER;")
        except psycopg2.errors.DuplicateColumn:
            pass
            
        try:
            cur.execute("ALTER TABLE users ADD COLUMN department VARCHAR(100);")
        except psycopg2.errors.DuplicateColumn:
            pass
        
        # Create verification_requests table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS verification_requests (
                request_id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(user_id),
                college_id INTEGER NOT NULL REFERENCES colleges(college_id),
                requested_role user_role NOT NULL,
                student_id VARCHAR(50),
                graduation_year INTEGER,
                department VARCHAR(100),
                supporting_documents TEXT,
                request_message TEXT,
                status verification_status DEFAULT 'pending',
                reviewed_by INTEGER REFERENCES users(user_id),
                reviewed_at TIMESTAMP,
                review_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create admin_permissions table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_permissions (
                permission_id SERIAL PRIMARY KEY,
                admin_user_id INTEGER NOT NULL REFERENCES users(user_id),
                college_id INTEGER NOT NULL REFERENCES colleges(college_id),
                can_verify_students BOOLEAN DEFAULT TRUE,
                can_verify_alumni BOOLEAN DEFAULT TRUE,
                can_manage_admins BOOLEAN DEFAULT FALSE,
                can_manage_college_info BOOLEAN DEFAULT FALSE,
                granted_by INTEGER REFERENCES users(user_id),
                granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE,
                UNIQUE(admin_user_id, college_id)
            );
        """)
        
        # Insert some sample colleges
        cur.execute("""
            INSERT INTO colleges (college_name, college_code, location, established_year, website) 
            VALUES 
                ('Harvard University', 'HARV', 'Cambridge, MA', 1636, 'https://harvard.edu'),
                ('Stanford University', 'STAN', 'Stanford, CA', 1885, 'https://stanford.edu'),
                ('MIT', 'MIT', 'Cambridge, MA', 1861, 'https://mit.edu'),
                ('UC Berkeley', 'UCB', 'Berkeley, CA', 1868, 'https://berkeley.edu'),
                ('Yale University', 'YALE', 'New Haven, CT', 1701, 'https://yale.edu')
            ON CONFLICT (college_name) DO NOTHING;
        """)
        
        # Create indexes for better performance
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(user_role);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_college ON users(college_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_verification_requests_college ON verification_requests(college_id);")
        
        mydb.commit()
        print("✅ Database migration completed successfully!")
        print("✅ User role system tables created")
        print("✅ Sample colleges added")
        print("✅ Indexes created for performance")
        
    except Exception as e:
        mydb.rollback()
        print(f"❌ Error during migration: {str(e)}")
        raise e
        
    finally:
        cur.close()
        mydb.close()

if __name__ == "__main__":
    create_user_role_system()