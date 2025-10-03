# Security Policy

## 🔒 Reporting Security Vulnerabilities

We take the security of WebSocket API Server seriously. If you discover a security vulnerability, please follow these guidelines:

### Reporting Process

1. **DO NOT** open a public GitHub issue
2. Email security details to: [your-security-email@example.com]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment** within 48 hours
- **Assessment** within 1 week
- **Fix timeline** communicated based on severity
- **Credit** in release notes (if desired)

---

## 🛡️ Security Best Practices

### Deployment Security

#### 1. Use HTTPS/WSS in Production

**Bad:**
```javascript
const ws = new WebSocket('ws://production-server.com/ws');
```

**Good:**
```javascript
const ws = new WebSocket('wss://production-server.com/ws');
```

Configure TLS certificate:
```bash
# Using Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

#### 2. Change Default Secrets

**Critical:** Update these in `.env`:
```env
JWT_SECRET=generate-secure-random-string-here
API_KEY=generate-unique-api-key-here
```

Generate secure secrets:
```bash
# JWT Secret (32 bytes)
openssl rand -base64 32

# API Key (hex)
openssl rand -hex 32
```

#### 3. Enable Authentication

```env
# Don't run without authentication in production
JWT_SECRET=your-secret
API_KEY=your-key
```

Verify authentication is working:
```javascript
// Test that unauthenticated requests are rejected
ws.send(JSON.stringify({ type: 'BROADCAST', payload: {} }));
// Should receive AUTH_REQUIRED error
```

#### 4. Configure Firewall

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw deny 8080/tcp   # Block direct access, use nginx
sudo ufw enable
```

#### 5. Use Reverse Proxy

Run server behind Nginx/HAProxy:
```nginx
# Nginx configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        
        # Security headers
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 6. Rate Limiting

Enable and configure rate limiting:
```env
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

Consider additional rate limiting at nginx level:
```nginx
limit_req_zone $binary_remote_addr zone=ws_limit:10m rate=10r/s;

location /ws {
    limit_req zone=ws_limit burst=20 nodelay;
    proxy_pass http://localhost:8080;
}
```

#### 7. Redis Security

If using Redis:
```env
REDIS_PASSWORD=strong-redis-password
```

Configure Redis:
```bash
# /etc/redis/redis.conf
requirepass strong-redis-password
bind 127.0.0.1  # Only local connections
protected-mode yes
```

#### 8. Secure Headers

Already configured in the application. Verify headers:
```bash
curl -I https://your-domain.com/health
```

#### 9. Input Validation

Application includes basic validation. For production, consider:
- JSON schema validation
- Content length limits
- Regex-based input sanitization

#### 10. Logging & Monitoring

Monitor for suspicious activity:
```env
LOG_LEVEL=info  # Don't use 'debug' in production
```

Watch logs for:
- Failed authentication attempts
- Rate limit violations
- Unusual message patterns
- Error spikes

---

## 🔐 Authentication Security

### JWT Best Practices

1. **Use strong secrets** (32+ characters)
2. **Set appropriate expiration** (24h recommended)
3. **Include necessary claims only**
4. **Validate on every request**
5. **Rotate secrets periodically**

### API Key Best Practices

1. **Generate cryptographically secure keys**
2. **Different keys per environment**
3. **Rotate keys regularly**
4. **Store securely (environment variables)**
5. **Never commit to version control**

### Token Storage (Client-Side)

**Bad:**
```javascript
localStorage.setItem('token', token);  // Vulnerable to XSS
```

**Better:**
```javascript
// Use httpOnly cookies when possible
// Or secure storage in native apps
```

---

## 🚨 Known Security Considerations

### 1. WebSocket Connection Hijacking

**Mitigation:**
- Use WSS (TLS) in production
- Validate Origin header
- Implement CSRF tokens for web clients

### 2. DDoS Protection

**Built-in protections:**
- Rate limiting
- Connection limits
- Heartbeat timeouts

**Additional recommendations:**
- Cloudflare or similar DDoS protection
- Load balancer with connection limits
- Geographic filtering if applicable

### 3. Message Injection

**Mitigation:**
- All messages validated
- Type checking enforced
- Payload sanitization

### 4. Authentication Bypass

**Mitigations:**
- Authentication required by default
- JWT signature validation
- API key comparison

**Testing:**
```bash
# Test that unauthenticated access is blocked
wscat -c ws://localhost:8080/ws
> {"type":"BROADCAST","payload":{"message":"test"}}
# Should receive AUTH_REQUIRED error
```

### 5. Information Disclosure

**Protected information:**
- Detailed error messages (production)
- Stack traces (production)
- Internal server details

**Verify:**
```env
NODE_ENV=production  # Reduces verbose errors
LOG_LEVEL=info      # No debug info in logs
```

---

## 📋 Security Checklist

### Pre-Deployment

- [ ] Changed JWT_SECRET from default
- [ ] Changed API_KEY from default
- [ ] NODE_ENV set to production
- [ ] HTTPS/WSS configured
- [ ] Firewall configured
- [ ] Redis password set (if used)
- [ ] Rate limiting enabled
- [ ] Logs monitored
- [ ] Reverse proxy configured
- [ ] No secrets in code/git

### Post-Deployment

- [ ] SSL certificate valid
- [ ] Authentication working
- [ ] Rate limiting effective
- [ ] Logs being written
- [ ] Health checks passing
- [ ] Monitoring active
- [ ] Backups configured
- [ ] Incident response plan ready

---

## 🔄 Security Updates

### Dependency Updates

Regularly update dependencies:
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# Update all dependencies
npm update
```

### Node.js Updates

Keep Node.js updated:
```bash
# Check current version
node --version

# Update (via nvm)
nvm install 18
nvm use 18
```

---

## 📚 Security Resources

### Recommended Reading

- [OWASP WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

### Security Tools

- **npm audit** - Dependency vulnerability scanning
- **Snyk** - Continuous security monitoring
- **OWASP ZAP** - Security testing
- **nmap** - Port scanning

---

## 🆘 Incident Response

### If Security Breach Detected

1. **Isolate** affected systems
2. **Assess** scope of breach
3. **Contain** the threat
4. **Investigate** root cause
5. **Remediate** vulnerabilities
6. **Document** incident
7. **Notify** affected parties (if required)

### Emergency Contacts

- Server Admin: [admin@example.com]
- Security Team: [security@example.com]
- On-Call: [oncall@example.com]

---

## 📝 Compliance

### Data Protection

- No PII stored by default
- Logs may contain IP addresses
- Message content not persisted
- Client IDs are random UUIDs

### Recommendations

- Review local data protection laws
- Implement data retention policies
- Add privacy policy if needed
- Consider GDPR/CCPA compliance

---

## ✅ Verified Versions

Security tested on:
- Node.js 18.x, 20.x
- Ubuntu 20.04, 22.04
- Debian 11

---

## 📞 Contact

For security concerns:
- Email: [security@example.com]
- PGP Key: [Available on request]

---

**Last Updated:** 2024-01-01  
**Version:** 1.0.0
