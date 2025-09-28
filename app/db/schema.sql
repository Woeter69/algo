-- no CREATE DATABASE IF NOT EXISTS. In Postgres you run this once as superuser:
-- CREATE DATABASE alumni_platform;

-- Then connect to alumni_platform and run the rest:

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,
    dob DATE,
    graduation_year INT,
    university_name TEXT,
    department TEXT,
    college TEXT,
    current_city TEXT,
    pfp_path TEXT,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'alumni', 'staff', 'admin')),
    enrollment_number TEXT UNIQUE,
    community_id INT,
    last_login TIMESTAMP,
    login_count INT DEFAULT 0,
    verified_by INT,
    verified_at TIMESTAMP,
    verification_status TEXT DEFAULT 'pending',
    phone VARCHAR(20),
    bio TEXT,
    linkedin VARCHAR(300),
    github VARCHAR(300),
    twitter VARCHAR(300),
    website VARCHAR(300),
    profile_visibility VARCHAR(20) DEFAULT 'public',
    email_notifications VARCHAR(20) DEFAULT 'enabled',
    job_alerts VARCHAR(20) DEFAULT 'enabled',
    student_id TEXT,
    alumni_id TEXT,
    employee_id TEXT,
    department_role TEXT,
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE SET NULL,
    FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for users table
CREATE INDEX idx_users_community ON users(community_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_verification_status ON users(verification_status);

CREATE TABLE verification_tokens (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiry TIMESTAMP NOT NULL
);

CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiry TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE interests (
    interest_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE user_interests (
    user_id INT NOT NULL,
    interest_id INT NOT NULL,
    PRIMARY KEY(user_id, interest_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (interest_id) REFERENCES interests(interest_id) ON DELETE CASCADE
);

INSERT INTO interests (name) VALUES
('Career Guidance'),
('Internships / Job Opportunities'),
('Research Projects'),
('Startups & Entrepreneurship'),
('Technology / Software Development'),
('Data Science / AI / Machine Learning'),
('Engineering / Design'),
('Business / Management'),
('Networking'),
('Clubs & Societies'),
('Sports & Fitness'),
('Cultural Activities'),
('Events & Workshops'),
('Competitions / Hackathons'),
('Mentorship'),
('Volunteering / Social Work'),
('Travel'),
('Music / Arts / Creative Work');

CREATE TABLE connections (
    connection_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    con_user_id INT NOT NULL,
    request TEXT,
    status TEXT CHECK (status IN ('pending','accepted','denied')) DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (con_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE education_details (
    detail_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    degree_type TEXT CHECK (degree_type IN ('Bachelors','Masters','PHD','Doctorate','B Tech','M Tech','B.E.','M.E.','B.Sc.','M.Sc.','BCA','MCA','MBA','BBA','Diploma')) NOT NULL,
    university_name TEXT NOT NULL,
    college_name TEXT,
    major TEXT NOT NULL,
    graduation_year INT,
    gpa NUMERIC(4,2) CHECK (gpa >= 0.00 AND gpa <= 10.00),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE work_experience (
    exp_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    join_year INT NOT NULL,
    leave_year INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Communities table (referenced by admin_permissions)
CREATE TABLE communities (
    community_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    college_code VARCHAR(10),
    location VARCHAR(255),
    established_year INT,
    website VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Admin permissions table
CREATE TABLE admin_permissions (
    permission_id SERIAL PRIMARY KEY,
    admin_user_id INT NOT NULL,
    community_id INT,
    can_verify_students BOOLEAN DEFAULT TRUE,
    can_verify_alumni BOOLEAN DEFAULT TRUE,
    can_manage_admins BOOLEAN DEFAULT FALSE,
    granted_by INT,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(admin_user_id, community_id),
    FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE SET NULL,
    FOREIGN KEY (granted_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for admin_permissions table
CREATE INDEX idx_admin_permissions_admin ON admin_permissions(admin_user_id);
CREATE INDEX idx_admin_permissions_community ON admin_permissions(community_id);

-- Verification requests table (referenced by communities)
CREATE TABLE verification_requests (
    request_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    community_id INT,
    requested_role TEXT NOT NULL DEFAULT 'student',
    student_id TEXT,
    graduation_year INT,
    department TEXT,
    university_name TEXT,
    college TEXT,
    request_message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (community_id) REFERENCES communities(community_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create indexes for verification_requests table
CREATE INDEX idx_verification_requests_user_id ON verification_requests(user_id);
CREATE INDEX idx_verification_requests_community ON verification_requests(community_id);
CREATE INDEX idx_verification_requests_community_id ON verification_requests(community_id);
CREATE INDEX idx_verification_requests_status ON verification_requests(status);
