
CREATE DATABASE IF NOT EXISTS alumni_platform;
USE alumni_platform;

CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    firstname VARCHAR(255) NOT NULL,
    lastname VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    dob DATE NOT NULL,
    graduation_year INT NOT NULL,
    university VARCHAR(255) NOT NULL,
    interests TEXT,
    preference ENUM('email','phone','linkedin') NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
