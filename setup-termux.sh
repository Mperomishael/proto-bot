#!/bin/bash
pkg update && pkg upgrade
pkg install nodejs-lts git ffmpeg libwebp build-essential python
npm install
echo "Setup complete. Edit your .env file and run 'npm start'."
