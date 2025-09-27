-- Migration to fix education_details table constraints and add gpa column
-- Run this script to update existing database

-- First, drop the existing constraint
ALTER TABLE education_details DROP CONSTRAINT IF EXISTS education_details_degree_type_check;

-- Add the gpa column if it doesn't exist
ALTER TABLE education_details ADD COLUMN IF NOT EXISTS gpa DECIMAL(3,2);

-- Add the updated constraint with more degree types
ALTER TABLE education_details ADD CONSTRAINT education_details_degree_type_check 
CHECK (degree_type IN ('Bachelors','Masters','PHD','Doctorate','B Tech','M Tech','B.E.','M.E.','B.Sc.','M.Sc.','BCA','MCA','MBA','BBA','Diploma'));
