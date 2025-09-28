-- Fix verification status for existing admin users
-- This migration updates admin users who have 'pending' verification status to 'verified'

UPDATE users 
SET verification_status = 'verified', 
    verified_at = CURRENT_TIMESTAMP
WHERE role = 'admin' 
AND (verification_status = 'pending' OR verification_status IS NULL);

-- Also ensure the admin user lewis.for.the.win has correct status
UPDATE users 
SET verification_status = 'verified', 
    verified_at = CURRENT_TIMESTAMP,
    verified = TRUE
WHERE username = 'lewis.for.the.win' 
AND role = 'admin';

-- Add a comment for tracking
INSERT INTO migration_log (migration_name, applied_at, description) 
VALUES ('003_fix_admin_verification_status', CURRENT_TIMESTAMP, 'Fixed verification status for existing admin users')
ON CONFLICT DO NOTHING;
