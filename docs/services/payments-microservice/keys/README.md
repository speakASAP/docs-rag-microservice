# WebPay RSA keys

**SECURITY WARNING: This directory contains sensitive cryptographic keys.**
**NEVER commit key files to git. The entire `keys/` directory is excluded from version control.**

## Setup Instructions

Verify `.gitignore` excludes `keys/` directory and all key file extensions.

## Security Checklist

- [ ] Keys are NOT in git repository
- [ ] Keys are NOT in any commit history
- [ ] `.gitignore` properly excludes `keys/` directory
- [ ] Key files have restricted file permissions (chmod 600)
- [ ] Keys are only stored on production/deployment servers
