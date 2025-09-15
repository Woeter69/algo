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
    pfp_path TEXT
);

CREATE TABLE verification_tokens (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiry TIMESTAMP NOT NULL
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
    degree_type TEXT CHECK (degree_type IN ('Bachelors','Masters','PHD','Doctorate')) NOT NULL,
    university_name TEXT NOT NULL,
    college_name TEXT,
    major TEXT NOT NULL,
    graduation_year INT,
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
