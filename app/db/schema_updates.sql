-- Schema updates for role-based verification system
-- Run these SQL commands to update the existing database

-- Add new columns to users table for role-specific information
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alumni_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by INT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS enrollment_number TEXT;

-- Create verification_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS verification_requests (
    request_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    community_id INT,
    requested_role TEXT NOT NULL CHECK (requested_role IN ('student', 'alumni', 'staff')),
    student_id TEXT,
    graduation_year INT,
    department TEXT,
    request_message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create communities table if it doesn't exist
CREATE TABLE IF NOT EXISTS communities (
    community_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    college_code TEXT,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_permissions (
    permission_id SERIAL PRIMARY KEY,
    admin_user_id INT NOT NULL,
    community_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INT,
    FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Insert some sample communities
INSERT INTO communities (name, college_code, location) VALUES
('Indian Institute of Technology Delhi', 'IITD', 'New Delhi, India'),
('Indian Institute of Technology Bombay', 'IITB', 'Mumbai, India'),
('Indian Institute of Technology Kanpur', 'IITK', 'Kanpur, India'),
('Indian Institute of Technology Madras', 'IITM', 'Chennai, India'),
('Indian Institute of Technology Kharagpur', 'IITKGP', 'Kharagpur, India'),
('Delhi Technological University', 'DTU', 'Delhi, India'),
('Netaji Subhas University of Technology', 'NSUT', 'Delhi, India'),
('Indira Gandhi Delhi Technical University for Women', 'IGDTUW', 'Delhi, India')
ON CONFLICT DO NOTHING;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON users(verification_status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_community_id ON verification_requests(community_id);

-- Update existing users to have 'unverified' role if they don't have one
UPDATE users SET role = 'unverified' WHERE role IS NULL OR role = '';

-- Add foreign key constraint for verified_by if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_verified_by_fkey'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_verified_by_fkey 
        FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL;
    END IF;
END $$;
