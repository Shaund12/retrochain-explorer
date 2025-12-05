#!/bin/bash
# Fix nginx configuration for Vue Router SPA

echo "?? Fixing nginx configuration for RetroChain Explorer..."

# Find your current nginx config
NGINX_CONF=$(find /etc/nginx -name "*retrochain*" -o -name "*explorer*" | head -1)

if [ -z "$NGINX_CONF" ]; then
    echo "? Could not find nginx config for explorer"
    echo "Please tell me the path to your nginx config file"
    exit 1
fi

echo "Found config: $NGINX_CONF"

# Backup current config
sudo cp "$NGINX_CONF" "$NGINX_CONF.backup.$(date +%s)"
echo "? Backup created"

# Check if try_files already exists
if grep -q "try_files.*index.html" "$NGINX_CONF"; then
    echo "? Configuration already has try_files for SPA routing"
else
    echo "??  Missing SPA routing configuration!"
    echo ""
    echo "Add this to your location / block in $NGINX_CONF:"
    echo ""
    echo "    location / {"
    echo "        try_files \$uri \$uri/ /index.html;"
    echo "    }"
    echo ""
    echo "Then run: sudo nginx -t && sudo systemctl reload nginx"
fi

# Test nginx config
echo ""
echo "Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "? Nginx config is valid"
    echo ""
    read -p "Reload nginx now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl reload nginx
        echo "? Nginx reloaded"
        echo ""
        echo "Try accessing /accounts now!"
    fi
else
    echo "? Nginx config has errors. Fix them before reloading."
fi
