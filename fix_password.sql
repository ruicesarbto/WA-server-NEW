-- Fix corrupted password for admin@admin.com
UPDATE "user"
SET password = '$2b$10$OUmfMxfNYQOw4yGtYWzQV./vpMHKYDXzkn6q2FK58hO8uzYuqdFcq'
WHERE email = 'admin@admin.com';

-- Verify the update
SELECT email, password FROM "user" WHERE email = 'admin@admin.com';
