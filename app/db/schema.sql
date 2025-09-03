
-- ===============================
-- Alumni Community Platform Schema
-- ===============================

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS alumni_platform;
USE alumni_platform;

-- 2. Users table
CREATE TABLE IF NOT EXISTS Users (
    user_id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'alumni', 'senior', 'professional', 'admin', 'moderator') NOT NULL,
    course VARCHAR(255),
    graduation_year INT,
    joined_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Posts table
CREATE TABLE IF NOT EXISTS Posts (
    post_id INT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 4. Replies table
CREATE TABLE IF NOT EXISTS Replies (
    reply_id INT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES Posts(post_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

-- 5. Resources table (for documents or old papers)
CREATE TABLE IF NOT EXISTS Resources (
    resource_id INT PRIMARY KEY,
    uploaded_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES Users(user_id) ON DELETE CASCADE
);
