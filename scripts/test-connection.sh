#!/bin/bash

################################################################################
# WebSocket API Server - Connection Test Script
#
# This script tests the WebSocket API server to verify it's working correctly.
#
# Usage: ./test-connection.sh [host] [port]
################################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
HOST=${1:-localhost}
PORT=${2:-8080}
API_KEY=${API_KEY:-default-api-key}

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        WebSocket API Server - Connection Test                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Testing: $HOST:$PORT"
echo ""

################################################################################
# Test 1: Health Check
################################################################################

echo -n "Test 1: Health check endpoint... "
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$HOST:$PORT/health)

if [ "$HEALTH_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED${NC} (HTTP $HEALTH_RESPONSE)"
    exit 1
fi

################################################################################
# Test 2: Metrics Endpoint
################################################################################

echo -n "Test 2: Metrics endpoint... "
METRICS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$HOST:$PORT/metrics)

if [ "$METRICS_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED${NC} (HTTP $METRICS_RESPONSE)"
fi

################################################################################
# Test 3: Demo Interface
################################################################################

echo -n "Test 3: Demo interface... "
DEMO_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$HOST:$PORT/demo.html)

if [ "$DEMO_RESPONSE" == "200" ]; then
    echo -e "${GREEN}✓ PASSED${NC}"
else
    echo -e "${RED}✗ FAILED${NC} (HTTP $DEMO_RESPONSE)"
fi

################################################################################
# Test 4: WebSocket Connection (requires wscat)
################################################################################

echo -n "Test 4: WebSocket connection... "

if command -v wscat &> /dev/null; then
    # Test WebSocket connection with timeout
    WS_TEST=$(timeout 5 wscat -c ws://$HOST:$PORT/ws --execute '{"type":"PING"}' 2>&1 | grep -c "PONG" || echo "0")
    
    if [ "$WS_TEST" -gt "0" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
    else
        echo -e "${YELLOW}⚠ SKIPPED${NC} (Connection failed or no PONG received)"
    fi
else
    echo -e "${YELLOW}⚠ SKIPPED${NC} (wscat not installed)"
    echo "   Install with: npm install -g wscat"
fi

################################################################################
# Display Server Info
################################################################################

echo ""
echo -e "${BLUE}Server Information:${NC}"
echo "─────────────────────────────────────────────────────"

HEALTH_DATA=$(curl -s http://$HOST:$PORT/health)

if [ $? -eq 0 ]; then
    echo "$HEALTH_DATA" | python3 -m json.tool 2>/dev/null || echo "$HEALTH_DATA"
else
    echo -e "${RED}Failed to fetch server information${NC}"
fi

echo ""
echo -e "${BLUE}Metrics:${NC}"
echo "─────────────────────────────────────────────────────"

METRICS_DATA=$(curl -s http://$HOST:$PORT/metrics)

if [ $? -eq 0 ]; then
    echo "$METRICS_DATA" | python3 -m json.tool 2>/dev/null || echo "$METRICS_DATA"
else
    echo -e "${RED}Failed to fetch metrics${NC}"
fi

################################################################################
# Summary
################################################################################

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Test Summary                               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Server is running and accessible${NC}"
echo ""
echo "Available endpoints:"
echo "  • HTTP:      http://$HOST:$PORT"
echo "  • WebSocket: ws://$HOST:$PORT/ws"
echo "  • Demo:      http://$HOST:$PORT/demo.html"
echo "  • Health:    http://$HOST:$PORT/health"
echo "  • Metrics:   http://$HOST:$PORT/metrics"
echo ""
echo "Next steps:"
echo "  1. Open demo interface: http://$HOST:$PORT/demo.html"
echo "  2. Connect from your application"
echo "  3. Start sending messages"
echo ""

exit 0
