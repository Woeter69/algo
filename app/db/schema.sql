CREATE DATABASE IF NOT EXISTS alumni_platform;
USE alumni_platform;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,   -- Track email verification

    -- Profile info
    dob DATE,
    graduation_year INT,
    university_name VARCHAR(255),
    department VARCHAR(255),
    college VARCHAR(255),
    current_city VARCHAR(255),
    pfp_path VARCHAR(255)
);

-- Table to store email verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expiry DATETIME NOT NULL
);

-- Table for all possible interests
CREATE TABLE IF NOT EXISTS interests (
    interest_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Many-to-many table linking users and interests
CREATE TABLE IF NOT EXISTS user_interests (
    user_id INT NOT NULL,
    interest_id INT NOT NULL,
    PRIMARY KEY(user_id, interest_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (interest_id) REFERENCES interests(interest_id) ON DELETE CASCADE
);

-- Populate interests (relevant for alumni networking)
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

-- connections table
CREATE TABLE IF NOT EXISTS connections(
    connection_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    con_user_id INT NOT NULL,
    request VARCHAR(500),
    status ENUM('pending','accepted','denied') DEFAULT 'pending',
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (con_user_id) REFERENCES users(user_id) ON DELETE CASCADE
);



-- education_details table it will basically store details of all the education a person has done phd masters bachelors etc
CREATE TABLE IF NOT EXISTS education_details(
    detail_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    degree_type ENUM('Bachelors','Masters','PHD','Doctorate') NOT NULL,
    university_name VARCHAR(500) NOT NULL,
    college_name VARCHAR(500),
    major VARCHAR(500) NOT NULL,
    graduation_year INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE

);

<<<<<<< HEAD

=======
>>>>>>> 5bef8401dd0ae414d2dadb8f40ad580d1d8a106d
--                                          ovesh start
--contacts table for user feedback
CREATE TABLE IF NOT EXISTS contacts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    message TEXT NOT NULL,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

--                                          ovesh end

--work experience table    <-- This table is SUS!
CREATE TABLE IF NOT EXISTS work_experience(
    exp_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(500) NOT NULL,
    join_year INT NOT NULL,
    leave_year INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    
);