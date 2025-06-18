#!/bin/bash

echo "Starting deployment..."


# pull the latest code
git pull origin main

# Install dependencies
echo "Installing dependencies..."
npm install --force # i have to use force otherwise it doesn't work

# Load environment variables
if [ ! -f .env ]; then
  echo ".env file not found! Please create it before deployment."
  exit 1
fi

# restart the app with pm2
echo "Restarting app with PM2..."
pm2 delete webapp || echo "PM2: 'app' not found, starting fresh"
pm2 start app.js --name webapp -f

# save the pm2 process list so it restarts on reboot
pm2 save

echo "Reloading Nginx..."
echo "Deployment finished!"