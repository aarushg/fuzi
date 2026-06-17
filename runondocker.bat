@echo off
docker compose up --build -d --remove-orphans
docker compose ps
pause
