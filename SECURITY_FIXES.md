# 🔧 SECURITY FIXES - IMPLEMENTATION GUIDE

## Module 1: CSRF Protection Middleware

**File**: `middlewares/csrf.js` (CREATE NEW)

```javascript
const crypto = require('crypto');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');

// Initialize Redis client
const redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
});

const csrfProtection = () => {
    return (req, res, next) => {
        // Initialize session if needed
        if (!req.session) {
            req.session = {};
        }

        // Generate CSRF token for session
        if (!req.session.csrfToken) {
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
        }

        // For GET requests, just provide token for next request
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            res.locals.csrfToken = req.session.csrfToken;
            return next();
        }

        // For POST/PUT/DELETE, validate token
        const token = req.body._csrf || req.headers['x-csrf-token'];

        if (!token) {
            return res.status(403).json({
                success: false,
                msg: 'CSRF token missing'
            });
        }

        // Constant-time comparison to prevent timing attacks
        const expectedToken = req.session.csrfToken;
        const isValid = crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(expectedToken)
        );

        if (!isValid) {
            return res.status(403).json({
                success: false,
                msg: 'CSRF token invalid'
            });
        }

        // Token valid, proceed
        req.csrfToken = token;
        next();
    };
};

module.exports = csrfProtection;
```

---

## Module 2: Secure Encryption/Decryption

**File**: `utils/encryption.js` (CREATE NEW)

```javascript
const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from(
    process.env.ENCRYPTION_SECRET ?
    crypto.scryptSync(process.env.ENCRYPTION_SECRET, 'salt', 32) :
    crypto.scryptSync('fallback-key-change-in-production', 'salt', 32)
);

class Encryption {
    // AES-256-GCM encryption (secure)
    encryptData(data) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);

            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag();

            // Format: iv:authTag:encrypted
            return {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                encrypted: encrypted,
                combined: `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
            };
        } catch (error) {
            throw new Error('Encryption failed: ' + error.message);
        }
    }

    decryptData(encryptedData) {
        try {
            let parts;

            if (typeof encryptedData === 'object') {
                parts = [encryptedData.iv, encryptedData.authTag, encryptedData.encrypted];
            } else {
                parts = encryptedData.split(':');
            }

            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];

            const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return JSON.parse(decrypted);
        } catch (error) {
            throw new Error('Decryption failed - data may be corrupted: ' + error.message);
        }
    }

    // Hash password with bcrypt (already used, this is just for reference)
    async hashPassword(password) {
        const bcrypt = require('bcrypt');
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    }

    async verifyPassword(password, hash) {
        const bcrypt = require('bcrypt');
        return bcrypt.compare(password, hash);
    }
}

module.exports = new Encryption();
```

---

## Module 3: Input Validation Schema

**File**: `validators/inputValidator.js` (CREATE NEW)

```javascript
const { body, param, query, validationResult } = require('express-validator');

const validators = {
    // User signup validation
    signup: [
        body('email')
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email required'),
        body('password')
            .isLength({ min: 12 })
            .withMessage('Password must be at least 12 characters')
            .matches(/[A-Z]/)
            .withMessage('Password must contain uppercase letter')
            .matches(/[0-9]/)
            .withMessage('Password must contain number')
            .matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/)
            .withMessage('Password must contain special character'),
        body('name')
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be 2-100 characters')
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('Name contains invalid characters'),
        body('mobile')
            .trim()
            .matches(/^[0-9]{10,15}$/)
            .withMessage('Mobile must be 10-15 digits'),
        body('acceptPolicy')
            .isBoolean()
            .equals('true')
            .withMessage('Must accept privacy policy'),
    ],

    // User login validation
    login: [
        body('email')
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email required'),
        body('password')
            .notEmpty()
            .withMessage('Password required'),
    ],

    // Language code validation
    languageCode: [
        query('code')
            .trim()
            .matches(/^[a-z]{2}(?:-[A-Z]{2})?$/)
            .withMessage('Invalid language code (e.g., en, en-US)'),
    ],

    // File upload validation
    fileUpload: [
        body('filename')
            .trim()
            .matches(/^[a-zA-Z0-9._-]+$/)
            .withMessage('Filename contains invalid characters'),
    ],

    // Update user validation
    updateUser: [
        body('uid')
            .trim()
            .isLength({ min: 10, max: 50 })
            .withMessage('Invalid user ID'),
        body('email')
            .optional()
            .trim()
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email required'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 })
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('Invalid name'),
        body('mobile')
            .optional()
            .matches(/^[0-9]{10,15}$/)
            .withMessage('Invalid mobile number'),
        body('newPassword')
            .optional()
            .isLength({ min: 12 })
            .matches(/[A-Z0-9!@#$%^&*()]/)
            .withMessage('Password too weak'),
    ],

    // JID/Phone validation (WhatsApp)
    jid: [
        query('jid')
            .trim()
            .matches(/^[0-9]{10,15}(@s\.whatsapp\.net)?$/)
            .withMessage('Invalid JID format'),
    ],
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            msg: 'Validation failed',
            errors: errors.array().map(e => ({
                field: e.param,
                message: e.msg,
                value: e.value
            }))
        });
    }
    next();
};

module.exports = { validators, handleValidationErrors };
```

---

## Module 4: Secure Path Resolution

**File**: `utils/pathValidator.js` (CREATE NEW)

```javascript
const path = require('path');
const fs = require('fs');

class PathValidator {
    /**
     * Safely resolve a path and verify it's within allowed directory
     * @param {string} basePath - The allowed base directory
     * @param {string} requestedPath - The requested path (may contain ../ etc)
     * @returns {string} - Validated absolute path
     * @throws {Error} - If path is outside base directory
     */
    validatePath(basePath, requestedPath) {
        // Resolve both paths to absolute
        const base = path.resolve(basePath);
        const target = path.resolve(basePath, requestedPath);

        // Ensure target is within base (prevents path traversal)
        if (!target.startsWith(base + path.sep) && target !== base) {
            throw new Error(`Path traversal detected: ${requestedPath}`);
        }

        return target;
    }

    /**
     * Get safe file path for reading
     * @param {string} basePath - Allowed base directory
     * @param {string} requestedPath - Requested file path
     * @returns {string} - Safe absolute path
     */
    getSafePath(basePath, requestedPath) {
        return this.validatePath(basePath, requestedPath);
    }

    /**
     * Verify a file exists and is readable
     * @param {string} filePath - File path to check
     * @returns {boolean}
     */
    fileExists(filePath) {
        try {
            return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
        } catch (e) {
            return false;
        }
    }

    /**
     * Get safe language file path
     * @param {string} code - Language code (e.g., 'en', 'en-US')
     * @returns {string} - Safe file path
     */
    getLanguageFilePath(code) {
        const languagesDir = path.join(process.cwd(), 'languages');

        // Validate language code format
        if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(code)) {
            throw new Error('Invalid language code format');
        }

        const filePath = path.join(languagesDir, `${code}.json`);
        return this.validatePath(languagesDir, filePath);
    }
}

module.exports = new PathValidator();
```

---

## Module 5: Token Blacklist/Revocation

**File**: `utils/tokenBlacklist.js` (CREATE NEW)

```javascript
const redis = require('redis');

class TokenBlacklist {
    constructor() {
        this.client = null;
        this.enabled = process.env.REDIS_ENABLED === 'true';
        this.initializeRedis();
    }

    async initializeRedis() {
        try {
            if (!this.enabled) return;

            this.client = redis.createClient({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: process.env.REDIS_DB || 0,
            });

            this.client.on('error', (err) => {
                console.error('Redis error:', err.message);
                this.enabled = false;
            });

            this.client.on('connect', () => {
                console.log('Redis connected for token blacklist');
            });

            await this.client.connect();
        } catch (err) {
            console.warn('Token blacklist disabled (Redis unavailable):', err.message);
            this.enabled = false;
        }
    }

    /**
     * Add token to blacklist
     * @param {string} token - JWT token to revoke
     * @param {number} expiresIn - Token expiration time in milliseconds
     */
    async revoke(token, expiresIn) {
        try {
            if (!this.enabled || !this.client) return;

            const ttl = Math.ceil(expiresIn / 1000); // Convert to seconds
            const key = `blacklist:${token}`;

            await this.client.setEx(key, ttl, 'revoked');
            console.log(`Token revoked: ${key} (TTL: ${ttl}s)`);
        } catch (err) {
            console.error('Failed to revoke token:', err.message);
            // Don't fail the logout if Redis is down
        }
    }

    /**
     * Check if token is blacklisted
     * @param {string} token - JWT token to check
     * @returns {boolean} - True if token is revoked
     */
    async isRevoked(token) {
        try {
            if (!this.enabled || !this.client) return false;

            const key = `blacklist:${token}`;
            const result = await this.client.get(key);
            return result !== null;
        } catch (err) {
            console.error('Failed to check token revocation:', err.message);
            // If Redis is down, be conservative and allow the token
            return false;
        }
    }

    /**
     * Clear all blacklisted tokens (for maintenance)
     */
    async clearBlacklist() {
        try {
            if (!this.enabled || !this.client) return;

            const keys = await this.client.keys('blacklist:*');
            if (keys.length > 0) {
                await this.client.del(keys);
                console.log(`Cleared ${keys.length} blacklisted tokens`);
            }
        } catch (err) {
            console.error('Failed to clear blacklist:', err.message);
        }
    }

    /**
     * Get blacklist statistics
     */
    async getStats() {
        try {
            if (!this.enabled || !this.client) {
                return { enabled: false };
            }

            const keys = await this.client.keys('blacklist:*');
            return {
                enabled: true,
                count: keys.length,
                keys: keys.slice(0, 10) // Return first 10
            };
        } catch (err) {
            console.error('Failed to get blacklist stats:', err.message);
            return { enabled: false, error: err.message };
        }
    }
}

module.exports = new TokenBlacklist();
```

---

## Module 6: Secure Database Table Names

**File**: `utils/tableValidator.js` (CREATE NEW)

```javascript
/**
 * Whitelist of allowed database tables
 * Prevents SQL injection through table name variables
 */
const ALLOWED_TABLES = {
    // User tables
    'user': 'user',
    'admin': 'admin',
    'contact': 'contact',

    // Chat/Message tables
    'chats': 'chats',
    'messages': 'messages',
    'chat_pinned': 'chat_pinned',
    'chat_sessions': 'chat_sessions',

    // Instance tables
    'instance': 'instance',
    'instance_settings': 'instance_settings',

    // WhatsApp integration tables
    'whatsapp_media': 'whatsapp_media',
    'whatsapp_flows': 'whatsapp_flows',

    // Payment tables
    'payment': 'payment',
    'plan': 'plan',
    'subscription': 'subscription',

    // System tables
    'smtp': 'smtp',
    'web_public': 'web_public',
    'phonebook': 'phonebook',
};

class TableValidator {
    /**
     * Get safe table name
     * @param {string} tableName - Requested table name
     * @returns {string} - Validated table name from whitelist
     * @throws {Error} - If table name not in whitelist
     */
    validateTable(tableName) {
        if (!tableName || typeof tableName !== 'string') {
            throw new Error('Invalid table name type');
        }

        const sanitized = tableName.trim().toLowerCase();

        if (!ALLOWED_TABLES[sanitized]) {
            throw new Error(`Table '${sanitized}' not allowed. Only these tables are permitted: ${Object.keys(ALLOWED_TABLES).join(', ')}`);
        }

        return ALLOWED_TABLES[sanitized];
    }

    /**
     * Get all allowed table names
     */
    getAllowedTables() {
        return Object.keys(ALLOWED_TABLES);
    }

    /**
     * Add new table to whitelist (admin only)
     * @param {string} tableName - New table name
     */
    addTable(tableName) {
        const sanitized = tableName.trim().toLowerCase();
        if (!/^[a-z_][a-z0-9_]*$/.test(sanitized)) {
            throw new Error('Invalid table name format');
        }
        ALLOWED_TABLES[sanitized] = sanitized;
    }
}

module.exports = new TableValidator();
```

---

## Integration Steps

### Step 1: Install Dependencies
```bash
npm install redis connect-redis express-validator
```

### Step 2: Update app.js
```javascript
// Add to app.js after express() initialization
const csrf = require('./middlewares/csrf');
const { handleValidationErrors } = require('./validators/inputValidator');

// Apply CSRF protection
app.use(csrf());

// Apply validation error handler globally
app.use(handleValidationErrors);
```

### Step 3: Update .env
```bash
# Add encryption secret
ENCRYPTION_SECRET=your_32_char_secret_here_minimum

# Add Redis config (optional but recommended)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### Step 4: Update Routes
```javascript
// Before route handler
const { validators, handleValidationErrors } = require('../validators/inputValidator');

// In route
router.post('/signup', validators.signup, handleValidationErrors, async (req, res) => {
    // All inputs are now validated
});
```

### Step 5: Use Token Blacklist in Logout
```javascript
const tokenBlacklist = require('../utils/tokenBlacklist');

router.post('/logout', adminValidator, async (req, res) => {
    try {
        const token = req.get('Authorization').split(' ')[1];
        const decoded = jwt.decode(token);

        if (decoded && decoded.exp) {
            const expiresIn = (decoded.exp - Math.floor(Date.now() / 1000)) * 1000;
            if (expiresIn > 0) {
                await tokenBlacklist.revoke(token, expiresIn);
            }
        }

        res.json({ success: true, msg: 'Logged out successfully' });
    } catch (err) {
        res.json({ success: false, msg: 'Logout failed' });
    }
});
```

---

## Testing Security Fixes

```bash
# Test CSRF protection
curl -X POST http://localhost:8001/api/admin/update_user \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"test"}' \
  # Should return 403 without CSRF token

# Test input validation
curl -X POST http://localhost:8001/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"short"}' \
  # Should return validation errors

# Test token blacklist
# 1. Login to get token
# 2. Logout (token added to blacklist)
# 3. Try using old token - should fail

# Check Redis blacklist status
redis-cli
> KEYS blacklist:*
> TTL blacklist:your_token_here
```
