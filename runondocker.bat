@echo off
docker compose build --no-cache
docker compose up -d --force-recreate --remove-orphans
docker compose ps
pause
