-- Update user table with correct bcrypt hash for "123"
UPDATE "user"
SET password = '$2a$10$JFnA5kcBB.fg6ZMA25Zkgu42Fz9GQAmBmD/PAUXWyte9dCodGcj4S'
WHERE email = 'admin@admin.com';

-- Update admin table with correct bcrypt hash for "123"
UPDATE admin
SET password = '$2a$10$JFnA5kcBB.fg6ZMA25Zkgu42Fz9GQAmBmD/PAUXWyte9dCodGcj4S'
WHERE email = 'admin@admin.com';

-- Verify the updates
SELECT 'user table:' as table_name, email, password FROM "user" WHERE email = 'admin@admin.com'
UNION ALL
SELECT 'admin table:', email, password FROM admin WHERE email = 'admin@admin.com';
