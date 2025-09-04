
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

