#!/bin/bash
# ?? RetroChain Nginx Reverse Proxy Setup Script
# This script sets up nginx to proxy port 443 to your RPC (26667) and REST (1318) ports
# So Keplr wallet can connect via standard HTTPS port

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}RetroChain Nginx Proxy Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}Please run as root (use sudo)${NC}"
   exit 1
fi

# Configuration
DOMAIN_BASE="retrochain.ddns.net"
RPC_SUBDOMAIN="rpc.${DOMAIN_BASE}"
API_SUBDOMAIN="api.${DOMAIN_BASE}"
EMAIL="admin@retrochain.io" # Change this to your email

# Ports
RPC_PORT=26667
REST_PORT=1318

echo -e "${YELLOW}Configuration:${NC}"
echo -e "  RPC Subdomain: ${GREEN}${RPC_SUBDOMAIN}${NC} ? localhost:${RPC_PORT}"
echo -e "  API Subdomain: ${GREEN}${API_SUBDOMAIN}${NC} ? localhost:${REST_PORT}"
echo -e "  Email for SSL: ${GREEN}${EMAIL}${NC}"
echo ""

read -p "Continue with this configuration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Aborted${NC}"
    exit 1
fi

# Step 1: Update system
echo -e "${BLUE}Step 1: Updating system...${NC}"
apt update
apt upgrade -y

# Step 2: Install Nginx
echo -e "${BLUE}Step 2: Installing Nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt install nginx -y
    echo -e "${GREEN}? Nginx installed${NC}"
else
    echo -e "${GREEN}? Nginx already installed${NC}"
fi

# Step 3: Install Certbot
echo -e "${BLUE}Step 3: Installing Certbot (Let's Encrypt)...${NC}"
if ! command -v certbot &> /dev/null; then
    apt install certbot python3-certbot-nginx -y
    echo -e "${GREEN}? Certbot installed${NC}"
else
    echo -e "${GREEN}? Certbot already installed${NC}"
fi

# Step 4: Check if ports are available
echo -e "${BLUE}Step 4: Checking if RPC and REST ports are listening...${NC}"
if ! netstat -tuln | grep -q ":${RPC_PORT}"; then
    echo -e "${RED}? Port ${RPC_PORT} (RPC) is not listening!${NC}"
    echo -e "${YELLOW}Make sure your RetroChain node is running${NC}"
    exit 1
fi
echo -e "${GREEN}? Port ${RPC_PORT} (RPC) is listening${NC}"

if ! netstat -tuln | grep -q ":${REST_PORT}"; then
    echo -e "${RED}? Port ${REST_PORT} (REST) is not listening!${NC}"
    echo -e "${YELLOW}Make sure your RetroChain node is running${NC}"
    exit 1
fi
echo -e "${GREEN}? Port ${REST_PORT} (REST) is listening${NC}"

# Step 5: Create Nginx configuration
echo -e "${BLUE}Step 5: Creating Nginx configuration...${NC}"

cat > /etc/nginx/sites-available/retrochain << 'NGINX_CONFIG'
# RPC Proxy (for Keplr Wallet)
server {
    listen 80;
    server_name RPC_SUBDOMAIN_PLACEHOLDER;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name RPC_SUBDOMAIN_PLACEHOLDER;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/RPC_SUBDOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/RPC_SUBDOMAIN_PLACEHOLDER/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy settings
    location / {
        proxy_pass http://localhost:RPC_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept, Authorization' always;
        
        # Handle OPTIONS
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}

# REST API Proxy (for Explorer)
server {
    listen 80;
    server_name API_SUBDOMAIN_PLACEHOLDER;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name API_SUBDOMAIN_PLACEHOLDER;

    # SSL certificates (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/API_SUBDOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/API_SUBDOMAIN_PLACEHOLDER/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Proxy settings
    location / {
        proxy_pass http://localhost:REST_PORT_PLACEHOLDER;
        proxy_http_version 1.1;
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept, Authorization' always;
        
        # Handle OPTIONS
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
}
NGINX_CONFIG

# Replace placeholders
sed -i "s|RPC_SUBDOMAIN_PLACEHOLDER|${RPC_SUBDOMAIN}|g" /etc/nginx/sites-available/retrochain
sed -i "s|API_SUBDOMAIN_PLACEHOLDER|${API_SUBDOMAIN}|g" /etc/nginx/sites-available/retrochain
sed -i "s|RPC_PORT_PLACEHOLDER|${RPC_PORT}|g" /etc/nginx/sites-available/retrochain
sed -i "s|REST_PORT_PLACEHOLDER|${REST_PORT}|g" /etc/nginx/sites-available/retrochain

echo -e "${GREEN}? Nginx configuration created${NC}"

# Step 6: Enable the site
echo -e "${BLUE}Step 6: Enabling Nginx site...${NC}"
ln -sf /etc/nginx/sites-available/retrochain /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t
if [ $? -ne 0 ]; then
    echo -e "${RED}? Nginx configuration test failed${NC}"
    exit 1
fi
echo -e "${GREEN}? Nginx configuration is valid${NC}"

# Step 7: Get SSL certificates
echo -e "${BLUE}Step 7: Getting SSL certificates from Let's Encrypt...${NC}"
echo -e "${YELLOW}Note: Make sure your DNS records are pointing to this server!${NC}"
echo -e "  ${RPC_SUBDOMAIN} ? $(curl -s ifconfig.me)"
echo -e "  ${API_SUBDOMAIN} ? $(curl -s ifconfig.me)"
echo ""

# First, start nginx without SSL to pass certbot challenges
cat > /etc/nginx/sites-available/retrochain-temp << NGINX_TEMP
server {
    listen 80;
    server_name ${RPC_SUBDOMAIN} ${API_SUBDOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 200 "OK";
    }
}
NGINX_TEMP

ln -sf /etc/nginx/sites-available/retrochain-temp /etc/nginx/sites-enabled/retrochain
systemctl reload nginx

# Get certificates
certbot certonly --webroot -w /var/www/html \
    -d ${RPC_SUBDOMAIN} \
    -d ${API_SUBDOMAIN} \
    --email ${EMAIL} \
    --agree-tos \
    --non-interactive

if [ $? -eq 0 ]; then
    echo -e "${GREEN}? SSL certificates obtained${NC}"
    
    # Now switch back to the full config
    ln -sf /etc/nginx/sites-available/retrochain /etc/nginx/sites-enabled/
    systemctl reload nginx
else
    echo -e "${RED}? Failed to obtain SSL certificates${NC}"
    echo -e "${YELLOW}You may need to verify your DNS settings and try again${NC}"
    exit 1
fi

# Step 8: Configure firewall
echo -e "${BLUE}Step 8: Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp
    ufw allow 443/tcp
    echo -e "${GREEN}? Firewall configured (UFW)${NC}"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    echo -e "${GREEN}? Firewall configured (firewalld)${NC}"
else
    echo -e "${YELLOW}! No firewall detected (ufw/firewalld)${NC}"
    echo -e "${YELLOW}  Make sure ports 80 and 443 are open${NC}"
fi

# Step 9: Enable nginx and set up auto-renewal
echo -e "${BLUE}Step 9: Enabling services...${NC}"
systemctl enable nginx
systemctl restart nginx

# Test certbot renewal
certbot renew --dry-run
if [ $? -eq 0 ]; then
    echo -e "${GREEN}? SSL auto-renewal configured${NC}"
else
    echo -e "${YELLOW}! SSL auto-renewal test failed${NC}"
fi

# Step 10: Test endpoints
echo -e "${BLUE}Step 10: Testing endpoints...${NC}"

sleep 2

# Test RPC
echo -e "Testing RPC endpoint..."
if curl -k -s "https://${RPC_SUBDOMAIN}/status" > /dev/null; then
    echo -e "${GREEN}? RPC endpoint working: https://${RPC_SUBDOMAIN}${NC}"
else
    echo -e "${RED}? RPC endpoint failed${NC}"
fi

# Test REST
echo -e "Testing REST endpoint..."
if curl -k -s "https://${API_SUBDOMAIN}/cosmos/base/tendermint/v1beta1/blocks/latest" > /dev/null; then
    echo -e "${GREEN}? REST endpoint working: https://${API_SUBDOMAIN}${NC}"
else
    echo -e "${RED}? REST endpoint failed${NC}"
fi

# Final summary
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete! ??${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "${YELLOW}Your RPC and REST endpoints are now accessible via HTTPS on port 443:${NC}"
echo ""
echo -e "  ?? RPC:  ${GREEN}https://${RPC_SUBDOMAIN}${NC}"
echo -e "  ?? REST: ${GREEN}https://${API_SUBDOMAIN}${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "  1. Update your Keplr button to use these URLs"
echo -e "  2. Update your Vercel environment variables:"
echo -e "     REST_API_URL=${GREEN}https://${API_SUBDOMAIN}${NC}"
echo -e "  3. Test Keplr connection with the updated button"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  View nginx logs:     ${BLUE}sudo tail -f /var/log/nginx/error.log${NC}"
echo -e "  Restart nginx:       ${BLUE}sudo systemctl restart nginx${NC}"
echo -e "  Check nginx status:  ${BLUE}sudo systemctl status nginx${NC}"
echo -e "  Renew SSL manually:  ${BLUE}sudo certbot renew${NC}"
echo ""
echo -e "${GREEN}Your RetroChain node is now Keplr-ready! ??${NC}"
