@echo off
docker compose up -d --force-recreate --remove-orphans
docker compose ps
pause
