CREATE DATABASE IF NOT EXISTS alumni_platform;
USE alumni_platform;

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE,   -- NEW: track email verification

    -- Profile info (can be NULL initially)
    dob DATE,
    graduation_year INT,
    university_name VARCHAR(255),
    department VARCHAR(255),
    college VARCHAR(255),
    interests TEXT,
    preferred_contact ENUM('email','phone','linkedin'),
    linkedin_profile VARCHAR(255),
    current_city VARCHAR(255),
    phone_number VARCHAR(20)
);

-- Table to store email verification tokens
CREATE TABLE IF NOT EXISTS verification_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expiry DATETIME NOT NULL
);
