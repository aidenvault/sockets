# Quick Start Guide - Testing & Verification

This guide helps you verify all the new implementations work correctly.

## Prerequisites

```bash
# Node.js 18+ required
node --version

# Install dependencies
npm install
```

## Running Tests

### 1. Run All Tests
```bash
npm test
```

Expected output:
```
Test Suites: 4 passed, 4 total
Tests:       175+ passed, 175+ total
```

### 2. Run Tests with Coverage
```bash
npm run test:coverage
```

Expected coverage:
- router.js: 70%+
- utils.js: 90%+
- broker.js: 80%+

### 3. Run Tests in Watch Mode (for development)
```bash
npm run test:watch
```

### 4. Run Specific Test File
```bash
npm test -- tests/unit/router.test.js
npm test -- tests/unit/utils.test.js
npm test -- tests/unit/broker.test.js
npm test -- tests/integration/websocket-flow.test.js
```

## Code Quality Checks

### 1. Linting
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix
```

### 2. Code Formatting
```bash
# Check formatting
npm run format -- --check

# Fix formatting
npm run format
```

## Starting the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
# Set environment variables first
export NODE_ENV=production
export JWT_SECRET="your-32-character-secret-here"
export API_KEY="your-16-character-key"

npm start
```

**Note:** Production mode will fail if secrets are not properly set (this is by design for security).

## Verifying New Features

### 1. Health Check
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": 1696723200000,
  "uptime": 123.45,
  "connections": 0,
  "broker": {
    "connected": false,
    "type": "memory"
  }
}
```

### 2. Prometheus Metrics
```bash
curl http://localhost:8080/metrics
```

Expected output: Prometheus-formatted metrics including:
- `websocket_connections_total`
- `websocket_messages_total`
- `websocket_message_latency_seconds`
- `inference_requests_total`
- And many more...

### 3. Server Statistics
```bash
curl http://localhost:8080/api/stats
```

Expected response includes circuit breaker status:
```json
{
  "connections": 0,
  "inference": {
    "pendingRequests": 0,
    "endpoints": ["default"],
    "enabled": false,
    "circuitBreakers": {
      "default": {
        "state": "closed",
        "stats": {...}
      }
    }
  },
  ...
}
```

### 4. Input Validation Test
```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Connect to server
wscat -c ws://localhost:8080/ws

# Try sending invalid message (should get error)
> {"type": "BROADCAST", "payload": {}}

# Expected response:
< {"type":"ERROR","payload":{"error":"Invalid payload: message field is required"},...}

# Try valid message
> {"type": "PING"}

# Expected response:
< {"type":"PONG","payload":{"timestamp":...},...}
```

## Testing Production Security

### 1. Test Secret Validation

```bash
# This should FAIL with error (good!)
NODE_ENV=production npm start

# Expected error:
# ❌ Production configuration validation failed:
#    - JWT_SECRET environment variable must be set in production
#    - API_KEY environment variable must be set in production
```

### 2. Test with Proper Secrets
```bash
# This should START successfully
NODE_ENV=production \
JWT_SECRET="a-very-long-secret-at-least-32-characters-long" \
API_KEY="a-secure-api-key-16chars" \
npm start

# Expected output:
# ✅ Production configuration validated successfully
```

## CI/CD Verification

### 1. GitHub Actions (if repo is on GitHub)
- Push to `main` or `develop` branch
- Check Actions tab for pipeline status
- All jobs should pass: test, security, build

### 2. Local CI Simulation
```bash
# Run the same checks as CI
npm ci
npm run lint
npm test
npm audit --audit-level=high
```

## Common Issues & Solutions

### Issue: Tests failing due to port in use
**Solution:**
```bash
# Change test port in tests/integration/websocket-flow.test.js
# Or kill process using port 8081
lsof -ti:8081 | xargs kill -9
```

### Issue: ESLint errors
**Solution:**
```bash
npm run lint:fix
```

### Issue: JWT_SECRET too short error
**Solution:**
```bash
# Make sure JWT_SECRET is at least 32 characters
export JWT_SECRET="this-is-a-very-secure-secret-key-for-production-use-32-chars"
```

### Issue: Module not found errors in tests
**Solution:**
```bash
# Make sure all dependencies are installed
npm install
```

## Performance Testing

### Basic Load Test (using Apache Bench)
```bash
# Install if needed: apt-get install apache2-utils

# Test health endpoint (10000 requests, 100 concurrent)
ab -n 10000 -c 100 http://localhost:8080/health
```

### WebSocket Load Test
For WebSocket load testing, consider using:
- Artillery: `npm install -g artillery`
- k6: For more advanced scenarios

## Monitoring Setup

### 1. View Metrics in Prometheus
```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'websocket-api-server'
    static_configs:
      - targets: ['localhost:8080']
```

Run Prometheus:
```bash
prometheus --config.file=prometheus.yml
```

### 2. Grafana Dashboard
- Add Prometheus as data source
- Import metrics from http://localhost:8080/metrics
- Create dashboards for:
  - Connection count over time
  - Message throughput
  - Latency percentiles
  - Error rates

## Next Steps

1. ✅ All tests passing? Great!
2. ✅ Metrics endpoint working? Excellent!
3. ✅ Production validation working? Perfect!

You're ready to:
- Deploy to production
- Set up monitoring (Prometheus + Grafana)
- Configure CI/CD secrets
- Scale horizontally with load balancer

## Getting Help

If you encounter issues:
1. Check logs: `tail -f logs/combined.log`
2. Run tests with verbose output: `npm test -- --verbose`
3. Check the audit reports in `/reports` for detailed architecture info
4. Review `IMPLEMENTATION_SUMMARY.md` for all changes made

---

**Quick Command Reference:**
```bash
npm test              # Run all tests
npm run lint          # Check code quality
npm run format        # Format code
npm run dev           # Start dev server
npm start             # Start prod server
curl localhost:8080/health    # Health check
curl localhost:8080/metrics   # Prometheus metrics
```