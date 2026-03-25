#!/bin/bash

#############################################################################
# COMPREHENSIVE SECURITY AUDIT COMMAND CHECKLIST
# For: chat.scoremark1.com (ScoreChat)
# Run all commands from project root directory
#############################################################################

echo "=========================================="
echo "  SECURITY AUDIT - COMMAND CHECKLIST"
echo "  Starting at: $(date)"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create audit report file
AUDIT_REPORT="AUDIT_REPORT_$(date +%Y%m%d_%H%M%S).txt"
{
    echo "SECURITY AUDIT REPORT"
    echo "Generated: $(date)"
    echo "Project: chat.scoremark1.com"
    echo "=========================================="
    echo ""
} | tee "$AUDIT_REPORT"

#############################################################################
# 1. DEPENDENCY AUDIT
#############################################################################
echo -e "${BLUE}[1/10] RUNNING DEPENDENCY AUDIT${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "DEPENDENCY AUDIT RESULTS" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

# Check if npm exists
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm not found${NC}"
    echo "✗ npm not found" >> "$AUDIT_REPORT"
else
    echo -e "${GREEN}✓ npm found${NC}"
    npm audit 2>&1 | tee -a "$AUDIT_REPORT"

    echo ""
    echo "Vulnerable packages:"
    npm audit --json 2>/dev/null | grep -o '"vulnerable": true' | wc -l >> "$AUDIT_REPORT"
fi
echo "" >> "$AUDIT_REPORT"

#############################################################################
# 2. OUTDATED PACKAGES
#############################################################################
echo ""
echo -e "${BLUE}[2/10] CHECKING OUTDATED PACKAGES${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "OUTDATED PACKAGES" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

npm outdated 2>&1 | tee -a "$AUDIT_REPORT"
echo "" >> "$AUDIT_REPORT"

#############################################################################
# 3. SECRETS DETECTION
#############################################################################
echo ""
echo -e "${BLUE}[3/10] SCANNING FOR HARDCODED SECRETS${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "SECRETS SCAN RESULTS" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

# Check for .env file committed
echo -e "${YELLOW}⚠ Checking for .env in Git history...${NC}"
if git ls-files | grep -E "^\.env"; then
    echo -e "${RED}✗ CRITICAL: .env file is in Git version control${NC}"
    echo "✗ CRITICAL: .env file is in Git version control" >> "$AUDIT_REPORT"
    echo "  FIX: git rm --cached .env && git commit -m 'Remove .env from version control'" >> "$AUDIT_REPORT"
else
    echo -e "${GREEN}✓ .env not in Git version control${NC}"
    echo "✓ .env not in Git version control" >> "$AUDIT_REPORT"
fi

# Check for hardcoded credentials
echo ""
echo -e "${YELLOW}⚠ Scanning source code for hardcoded passwords...${NC}"
grep -r "password\s*[:=]" --include="*.js" --include="*.json" \
    --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | \
    grep -v "password.*\*" | grep -v "password.*undefined" | tee -a "$AUDIT_REPORT"

# Check for API keys
echo ""
echo -e "${YELLOW}⚠ Scanning for hardcoded API keys...${NC}"
grep -r "api[_-]*key\|secret\|token" --include="*.js" --include="*.json" \
    --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | \
    grep -v "process.env\|getenv\|^[[:space:]]*\/\/" | head -20 | tee -a "$AUDIT_REPORT"

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 4. CODE SECURITY ANALYSIS (ESLint)
#############################################################################
echo ""
echo -e "${BLUE}[4/10] RUNNING CODE SECURITY ANALYSIS${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "CODE SECURITY ANALYSIS (ESLint)" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

# Check if eslint is installed
if ! npm list eslint &> /dev/null; then
    echo -e "${YELLOW}⚠ ESLint not installed. Installing...${NC}"
    npm install --save-dev eslint eslint-plugin-security &> /dev/null
fi

# Run ESLint with security plugin
npx eslint routes/**/*.js middlewares/**/*.js --plugin security 2>&1 | tee -a "$AUDIT_REPORT"
echo "" >> "$AUDIT_REPORT"

#############################################################################
# 5. SQL INJECTION DETECTION
#############################################################################
echo ""
echo -e "${BLUE}[5/10] SCANNING FOR SQL INJECTION PATTERNS${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "SQL INJECTION RISK SCAN" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

echo -e "${YELLOW}⚠ Checking for dynamic SQL queries (string concatenation)...${NC}"
echo "Files with potential SQL injection risks:" >> "$AUDIT_REPORT"

# Pattern 1: String concatenation in queries
echo ""
echo "Pattern 1: Direct string concatenation" | tee -a "$AUDIT_REPORT"
grep -rn "query\s*(\s*['\"].*\+\|SELECT.*+.*FROM\|INSERT.*+.*VALUES" \
    --include="*.js" --exclude-dir=node_modules . 2>/dev/null | tee -a "$AUDIT_REPORT"

# Pattern 2: Template literals with unescaped variables in WHERE clause
echo ""
echo "Pattern 2: Template literals in SQL" | tee -a "$AUDIT_REPORT"
grep -rn "\`SELECT\|UPDATE\|INSERT\|DELETE" --include="*.js" --exclude-dir=node_modules . 2>/dev/null | \
    grep -v "PINNED_TABLE_NAME\|-- " | head -10 | tee -a "$AUDIT_REPORT"

# Pattern 3: Dynamic table names
echo ""
echo "Pattern 3: Dynamic table names" | tee -a "$AUDIT_REPORT"
grep -rn "\`.*\${.*TABLE\|${.*TABLE.*\`" --include="*.js" --exclude-dir=node_modules . 2>/dev/null | tee -a "$AUDIT_REPORT"

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 6. DANGEROUS FUNCTIONS
#############################################################################
echo ""
echo -e "${BLUE}[6/10] SCANNING FOR DANGEROUS FUNCTIONS${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "DANGEROUS FUNCTIONS SCAN" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

echo -e "${YELLOW}⚠ Checking for eval, exec, spawn, etc...${NC}"
echo "Lines with dangerous functions:" >> "$AUDIT_REPORT"

dangerous_patterns=(
    "eval\s*("
    "exec\s*("
    "Function\s*("
    "spawn\|execFile\|execSync"
    "child_process"
    "require\s*(\s*\['\"].*\$"
)

for pattern in "${dangerous_patterns[@]}"; do
    echo ""
    echo "Searching for: $pattern" | tee -a "$AUDIT_REPORT"
    grep -rn "$pattern" --include="*.js" --exclude-dir=node_modules --exclude-dir=client . 2>/dev/null | tee -a "$AUDIT_REPORT"
done

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 7. INPUT VALIDATION
#############################################################################
echo ""
echo -e "${BLUE}[7/10] ANALYZING INPUT VALIDATION${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "INPUT VALIDATION ANALYSIS" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

echo -e "${YELLOW}⚠ Checking for express-validator usage...${NC}"
grep -rn "express-validator\|validationResult\|body(\|query(\|param(" \
    --include="*.js" routes/ middlewares/ 2>/dev/null | wc -l | tee -a "$AUDIT_REPORT"

echo "Routes with validation:" >> "$AUDIT_REPORT"
grep -rn "validators\." --include="*.js" routes/ 2>/dev/null | tee -a "$AUDIT_REPORT"

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 8. AUTHENTICATION & JWT
#############################################################################
echo ""
echo -e "${BLUE}[8/10] AUDITING AUTHENTICATION IMPLEMENTATION${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "AUTHENTICATION AUDIT" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

echo -e "${YELLOW}⚠ Checking JWT usage...${NC}"
grep -rn "jwt\.\|jsonwebtoken\|sign\|verify" --include="*.js" middlewares/ routes/ 2>/dev/null | \
    head -20 | tee -a "$AUDIT_REPORT"

echo ""
echo -e "${YELLOW}⚠ Checking bcrypt usage...${NC}"
grep -rn "bcrypt\.\|hash\|compare" --include="*.js" routes/ 2>/dev/null | \
    head -10 | tee -a "$AUDIT_REPORT"

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 9. FILE OPERATIONS SECURITY
#############################################################################
echo ""
echo -e "${BLUE}[9/10] AUDITING FILE OPERATIONS${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "FILE OPERATIONS SECURITY" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

echo -e "${YELLOW}⚠ Checking file read/write operations...${NC}"
grep -rn "fs\.read\|fs\.write\|readFile\|writeFile" --include="*.js" \
    --exclude-dir=node_modules . 2>/dev/null | head -15 | tee -a "$AUDIT_REPORT"

echo ""
echo -e "${YELLOW}⚠ Checking for path traversal vulnerabilities...${NC}"
grep -rn "path\.join\|path\.resolve" --include="*.js" \
    --exclude-dir=node_modules . 2>/dev/null | head -10 | tee -a "$AUDIT_REPORT"

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 10. CONFIGURATION SECURITY
#############################################################################
echo ""
echo -e "${BLUE}[10/10] AUDITING CONFIGURATION SECURITY${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "CONFIGURATION SECURITY" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

echo -e "${YELLOW}⚠ Checking for secure headers (Helmet)...${NC}"
grep -rn "helmet\|contentSecurityPolicy\|hsts\|xss" --include="*.js" app.js server.js 2>/dev/null | \
    head -10 | tee -a "$AUDIT_REPORT"

echo ""
echo -e "${YELLOW}⚠ Checking CORS configuration...${NC}"
grep -rn "cors\|origin\|credentials" --include="*.js" app.js server.js socket.js 2>/dev/null | \
    head -10 | tee -a "$AUDIT_REPORT"

echo ""
echo -e "${YELLOW}⚠ Checking rate limiting...${NC}"
grep -rn "rateLimit\|rate.limit\|express-rate-limit" --include="*.js" app.js server.js 2>/dev/null | \
    head -10 | tee -a "$AUDIT_REPORT"

echo "" >> "$AUDIT_REPORT"

#############################################################################
# 11. DOCKER SECURITY
#############################################################################
echo ""
echo -e "${BLUE}[BONUS] DOCKER SECURITY CHECK${NC}"
echo "--------" >> "$AUDIT_REPORT"
echo "DOCKER SECURITY" >> "$AUDIT_REPORT"
echo "--------" >> "$AUDIT_REPORT"

if command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠ Checking Dockerfile...${NC}"
    if [ -f "Dockerfile" ]; then
        echo "Dockerfile found:" >> "$AUDIT_REPORT"
        cat Dockerfile >> "$AUDIT_REPORT"

        # Check for issues
        echo ""
        echo "Security checks:" >> "$AUDIT_REPORT"
        grep -n "USER\|RUN.*npm\|RUN.*install" Dockerfile | tee -a "$AUDIT_REPORT"
    else
        echo "No Dockerfile found" >> "$AUDIT_REPORT"
    fi

    echo ""
    echo -e "${YELLOW}⚠ Checking docker-compose.yml...${NC}"
    if [ -f "docker-compose.yml" ]; then
        echo "docker-compose.yml found" >> "$AUDIT_REPORT"
        echo "Checking for secrets management:" >> "$AUDIT_REPORT"
        grep -n "environment\|secrets\|DBPASS\|JWTKEY" docker-compose.yml 2>/dev/null | tee -a "$AUDIT_REPORT"
    fi
else
    echo "Docker not installed" >> "$AUDIT_REPORT"
fi

echo "" >> "$AUDIT_REPORT"

#############################################################################
# SUMMARY
#############################################################################
echo ""
echo "=========================================="
echo -e "${GREEN}AUDIT COMPLETE${NC}"
echo "=========================================="
echo ""
echo "Report saved to: $AUDIT_REPORT"
echo ""
echo -e "${YELLOW}SUMMARY:${NC}"
echo "1. Dependency vulnerabilities: Check npm audit output"
echo "2. Hardcoded secrets: CRITICAL if found"
echo "3. SQL injection risks: Check string concatenation patterns"
echo "4. Input validation: Ensure express-validator is used"
echo "5. Authentication: JWT and bcrypt properly implemented"
echo ""

echo "" >> "$AUDIT_REPORT"
echo "=========================================="
echo "AUDIT COMPLETED: $(date)"
echo "=========================================="

#############################################################################
# RECOMMENDATIONS
#############################################################################
echo ""
echo -e "${YELLOW}QUICK RECOMMENDATIONS:${NC}"
echo ""
echo "1. CRITICAL - Remove .env from Git:"
echo "   git rm --cached .env"
echo "   git commit -m 'Remove .env from version control'"
echo "   echo '.env' >> .gitignore"
echo ""
echo "2. CRITICAL - Update Express:"
echo "   npm update express@latest"
echo ""
echo "3. HIGH - Fix SQL Injection risks:"
echo "   Review inbox.js line 116 (table name in template literal)"
echo ""
echo "4. HIGH - Add CSRF Protection:"
echo "   npm install csrf"
echo ""
echo "5. HIGH - Implement Input Validation:"
echo "   npm install express-validator"
echo ""
echo "Full report: $AUDIT_REPORT"
echo ""
