@echo off
start cmd /k "cd signaling-server && npm install && npm start"
TIMEOUT /T 2
start cmd /k "cd desktop-app && npm install && npm start"
