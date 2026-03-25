# 🗺️ SECURITY REMEDIATION ROADMAP

**Project**: ScoreChat (chat.scoremark1.com)
**Security Level**: 6.2/10 (Needs Immediate Attention)
**Estimated Effort**: 2-3 weeks with proper prioritization

---

## 📍 EXECUTIVE SUMMARY

Your application has **14 identified vulnerabilities** ranging from CRITICAL to LOW severity. The most urgent issues involve:

1. **Hardcoded credentials exposed** in `.env` file
2. **Dependency vulnerabilities** in core packages (Express, node-fetch)
3. **Missing CSRF protection** on all state-changing endpoints
4. **Inadequate input validation** across the application
5. **No token revocation mechanism** for JWT sessions

**Estimated remediation time**: 2-3 weeks (if done properly)
**Risk if left unpatched**: HIGH - potential data breach, unauthorized access, account takeover

---

## 🎯 PRIORITY MATRIX

### 🔴 CRITICAL (Fix This Week)
These are actively exploitable and must be fixed immediately.

| Issue | Impact | Effort | Timeline |
|-------|--------|--------|----------|
| Hardcoded DB credentials in .env | System compromise | 1 hour | TODAY |
| Hardcoded JWT key | Token forgery/session hijacking | 1 hour | TODAY |
| Express.js CVE-2023-46604 | RCE / Prototype pollution | 30 min | TODAY |
| node-fetch timeout bypass | DoS vulnerability | 1 hour | This week |
| SQL injection via table names | Database compromise | 2 hours | This week |

**Daily effort**: 1-2 hours/day × 5 days = 5-10 hours

### 🟠 HIGH (Fix This Week)
High-severity issues that require immediate attention.

| Issue | Impact | Effort | Timeline |
|-------|--------|--------|----------|
| Missing CSRF protection | XSS/CSRF attacks | 4-6 hours | This week |
| No input validation | SQLi, XSS, path traversal | 8-10 hours | This week |
| Inadequate authorization | Privilege escalation | 4 hours | Next week |

**Daily effort**: 2-3 hours/day × 5 days = 10-15 hours

### 🟡 MEDIUM (Fix Next Sprint)
Important security improvements that should be scheduled.

| Issue | Impact | Effort | Timeline |
|-------|--------|--------|----------|
| Base64 instead of encryption | Data exposure | 3-4 hours | Next sprint |
| No token revocation | Session persistence after logout | 4-5 hours | Next sprint |
| Localhost rate limit bypass | Brute force attacks | 1 hour | Next sprint |
| Session file storage | Data exposure on disk | 6-8 hours | Next sprint |

**Daily effort**: 1-2 hours/day × 5 days = 5-10 hours

---

## 📋 WEEK-BY-WEEK IMPLEMENTATION PLAN

### **WEEK 1: CRITICAL FIXES (10-12 hours)**

#### Day 1: Credentials & Dependencies (3-4 hours)
- [ ] **Morning (1 hour)**
  - Rotate all credentials:
    ```bash
    # Generate new DB password
    openssl rand -base64 32

    # Generate new JWT key
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```
  - Update `.env` file with new credentials
  - Update Docker/Docker Compose with new credentials
  - Test database connection with new credentials

- [ ] **Midday (1.5 hours)**
  - Remove `.env` from Git history:
    ```bash
    git log --all --full-history -- .env
    git filter-branch --tree-filter 'rm -f .env' -- --all
    git reflog expire --expire=now --all
    git gc --prune=now
    ```
  - Add `.env` to `.gitignore` and `.dockerignore`
  - Create `.env.example` as template
  - Commit: "Security: Remove .env from version control"

- [ ] **Afternoon (1-1.5 hours)**
  - Update Express.js:
    ```bash
    npm update express@^4.21.0
    npm audit fix
    ```
  - Update node-fetch:
    ```bash
    npm update node-fetch@3 --save
    # OR use native fetch (Node 18+)
    ```
  - Run `npm audit` to verify no critical issues remain
  - Test application still works: `npm start`

#### Day 2: SQL Injection & File Operations (3-4 hours)
- [ ] **Morning (1.5 hours)**
  - Create `utils/tableValidator.js` module
  - Create `utils/pathValidator.js` module
  - Test with sample validations

- [ ] **Afternoon (1.5-2 hours)**
  - Fix `routes/inbox.js` line 116 (table names)
  - Fix `routes/web.js` file operations (path traversal)
  - Run security scan: `./AUDIT_COMMANDS.sh`
  - Test endpoints for regressions

#### Day 3: JWT & Authentication Hardening (2-3 hours)
- [ ] **Morning (1 hour)**
  - Install Redis for token blacklist:
    ```bash
    npm install redis connect-redis
    docker run -d -p 6379:6379 redis:7-alpine
    ```

- [ ] **Midday (1-1.5 hours)**
  - Create `utils/tokenBlacklist.js`
  - Update middleware to check blacklist
  - Add logout endpoint with token revocation

- [ ] **Afternoon (0.5 hour)**
  - Test logout invalidates JWT
  - Test old token cannot be reused
  - Commit: "Security: Add JWT revocation mechanism"

---

### **WEEK 1: CONTINUED - HIGH PRIORITY (8-10 hours)**

#### Day 4: Input Validation Framework (4-5 hours)
- [ ] **Full Day**
  - Create `validators/inputValidator.js`
  - Install `express-validator`:
    ```bash
    npm install express-validator
    ```
  - Apply to critical endpoints:
    - `/api/user/signup` (30 min)
    - `/api/admin/login` (30 min)
    - `/api/admin/update_user` (30 min)
    - `/api/web/get-one-translation` (30 min)
    - Remaining routes (1-1.5 hours)
  - Test validation with invalid inputs
  - Commit: "Security: Add input validation schema"

#### Day 5: CSRF Protection (3-4 hours)
- [ ] **Morning (1.5 hours)**
  - Create `middlewares/csrf.js`
  - Install session middleware:
    ```bash
    npm install express-session
    ```
  - Configure in `app.js`

- [ ] **Afternoon (1.5-2 hours)**
  - Apply CSRF middleware globally
  - Update all POST/PUT/DELETE endpoints to include CSRF token
  - Test CSRF protection with curl:
    ```bash
    # Should fail without token
    curl -X POST http://localhost:8001/api/admin/update_user \
      -H "Authorization: Bearer TOKEN" \
      -d '{"name":"test"}'

    # Should fail with wrong token
    curl -X POST http://localhost:8001/api/admin/update_user \
      -H "Authorization: Bearer TOKEN" \
      -H "X-CSRF-Token: wrong_token" \
      -d '{"name":"test"}'
    ```
  - Commit: "Security: Add CSRF protection"

**End of Week 1**: Critical vulnerabilities patched, JWT secured, input validation in place

---

### **WEEK 2: HIGH PRIORITY COMPLETION (10-12 hours)**

#### Day 1-2: Encryption Module (4 hours)
- [ ] Create `utils/encryption.js`
- [ ] Replace Base64 usage with AES-256-GCM
- [ ] Test encryption/decryption
- [ ] Update codebase to use new encryption
- [ ] Commit: "Security: Replace Base64 with AES-256-GCM encryption"

#### Day 3: CORS Hardening (2-3 hours)
- [ ] **Current Issue**: `origin: true` accepts all origins
- [ ] **Fix**:
  ```javascript
  const allowedOrigins = [
      process.env.FRONTENDURI,
      'http://localhost:3000',
      'http://localhost:8001',
  ];

  origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
      } else {
          callback(new Error('CORS not allowed'));
      }
  }
  ```
- [ ] Test CORS with different origins
- [ ] Commit: "Security: Implement CORS whitelist"

#### Day 4-5: Authorization & Rate Limiting (4-5 hours)
- [ ] Implement proper RBAC (role-based access control)
  - Create role middleware
  - Verify user roles match endpoints

- [ ] Fix rate limiting bypass (localhost)
  - Remove IP-based skip rules
  - Use environment variables instead

- [ ] Test all rate limits work
- [ ] Commit: "Security: Implement RBAC and fix rate limiting"

---

### **WEEK 3: MEDIUM PRIORITY & TESTING (6-8 hours)**

#### Day 1: Session Management (3-4 hours)
- [ ] Implement Redis-based session store
- [ ] Replace file-based sessions
- [ ] Configure session security:
  ```javascript
  session({
      secret: process.env.SESSION_SECRET,
      store: new RedisStore({ client: redisClient }),
      cookie: {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'Strict',
          maxAge: 1000 * 60 * 60 * 24 // 24 hours
      }
  })
  ```

#### Day 2-3: Security Testing (2-3 hours)
- [ ] Run OWASP ZAP:
  ```bash
  docker run -t owasp/zap2docker-stable \
    zap-baseline.py -t http://localhost:8001
  ```
- [ ] Run npm audit
- [ ] Run Snyk:
  ```bash
  npm install -g snyk
  snyk auth
  snyk test
  ```
- [ ] Manual penetration testing

#### Day 4-5: Documentation & Cleanup (1-2 hours)
- [ ] Update `.env.example`
- [ ] Create `SECURITY.md` for team
- [ ] Update `README.md` with security guidelines
- [ ] Add security headers verification script

---

## 🔍 VERIFICATION CHECKLIST

After implementing fixes, verify using these commands:

```bash
# ✅ Run all security checks
chmod +x AUDIT_COMMANDS.sh
./AUDIT_COMMANDS.sh

# ✅ Dependency scan
npm audit
npm list | grep "CRITICAL\|HIGH"

# ✅ Code security
npx eslint routes/**/*.js --plugin security

# ✅ OWASP scan
docker run -t owasp/zap2docker-stable \
  zap-baseline.py -t http://localhost:8001

# ✅ Secrets detection
git secrets --scan
npm install -g truffleHog
truffleHog filesystem .

# ✅ Docker image scan
docker build -t scorechat:latest .
docker scan scorechat:latest

# ✅ API security test
# 1. Test CSRF protection
curl -X POST http://localhost:8001/api/admin/update_user \
  -H "Authorization: Bearer token" \
  -d '{}'
  # Should return 403 Forbidden

# 2. Test input validation
curl -X POST http://localhost:8001/api/user/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"123"}'
  # Should return validation errors

# 3. Test rate limiting
for i in {1..50}; do curl -s http://localhost:8001/api/web/get-one-translation?code=en; done
# Should return 429 after limit

# 4. Test token revocation
# Login -> Logout -> Use old token
# Old token should return 401 Unauthorized
```

---

## 📊 RISK ASSESSMENT BEFORE & AFTER

### Current State (Before Fixes)
```
🔴 CRITICAL:    3 issues
🟠 HIGH:        5 issues
🟡 MEDIUM:      6 issues
Overall Score:  6.2/10 ❌
```

### After Full Implementation
```
🔴 CRITICAL:    0 issues
🟠 HIGH:        1 issue (depending on custom fixes)
🟡 MEDIUM:      1-2 issues (low priority)
Overall Score:  9.0/10 ✅
```

---

## 🚀 DEPLOYMENT CONSIDERATIONS

### Pre-Production Checklist
- [ ] All CRITICAL vulnerabilities fixed
- [ ] npm audit returns no vulnerabilities
- [ ] OWASP ZAP baseline scan passes
- [ ] Secrets not in version control
- [ ] Environment variables properly configured
- [ ] HTTPS enforced
- [ ] Database encrypted at rest
- [ ] Backups encrypted
- [ ] Security headers verified

### Production Deployment
```bash
# 1. Verify no .env in repo
git log --all -S "DBPASS" -- .env

# 2. Build container with security scan
docker build -t scorechat:prod .
docker scan scorechat:prod

# 3. Run container with security options
docker run -d \
  --read-only \
  --security-opt=no-new-privileges:true \
  --cap-drop=ALL \
  --cap-add=NET_BIND_SERVICE \
  -e NODE_ENV=production \
  scorechat:prod

# 4. Verify security headers
curl -I https://your-domain.com | grep -i "X-\|Content-Security\|Strict-Transport"
```

---

## 📞 SUPPORT & RESOURCES

### Security Monitoring Tools
- **Snyk**: Continuous dependency monitoring
- **Sentry**: Error tracking (avoid logging sensitive data)
- **DataDog**: APM & security monitoring
- **PagerDuty**: Incident alerting

### Security Guidelines
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security](https://nodejs.org/en/docs/guides/nodejs-security/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### Compliance
- **PCI DSS**: If handling payments (using Stripe)
- **GDPR**: If handling EU user data
- **CCPA**: If handling California user data

---

## ✅ SUCCESS METRICS

After implementation, you should achieve:

- ✅ Zero CRITICAL vulnerabilities
- ✅ npm audit returns 0 vulnerabilities
- ✅ OWASP ZAP baseline scan passes
- ✅ JWT tokens properly revoked on logout
- ✅ All inputs validated against schema
- ✅ CSRF tokens on all state-changing operations
- ✅ Credentials stored securely (not in code)
- ✅ Rate limiting prevents brute force
- ✅ Path traversal attacks prevented
- ✅ SQL injection not possible

---

## 📝 TRACKING PROGRESS

Use this template to track your progress:

```markdown
## Security Remediation Progress

**Week 1: CRITICAL FIXES**
- [x] Day 1: Credentials rotation
- [x] Day 2: Dependency updates
- [ ] Day 3: SQL injection fixes
- [ ] Day 4: Input validation
- [ ] Day 5: CSRF protection

**Week 2: HIGH PRIORITY**
- [ ] Encryption module
- [ ] CORS hardening
- [ ] RBAC implementation
- [ ] Security testing

**Week 3: COMPLETION**
- [ ] Session management
- [ ] Final verification
- [ ] Documentation

**Status**: In Progress (3/15 tasks completed)
**Completion**: ~20%
```

---

## 🎯 FINAL NOTES

- **Don't skip the credential rotation** - this is the most critical step
- **Test thoroughly** - especially authentication and CSRF
- **Document changes** - your team needs to understand new security procedures
- **Monitor in production** - implement alerting for security events
- **Keep dependencies updated** - subscribe to security advisories

**Questions?** Refer back to `SECURITY_AUDIT.md` for detailed vulnerability analysis and `SECURITY_FIXES.md` for implementation code.

Good luck! 🔒
