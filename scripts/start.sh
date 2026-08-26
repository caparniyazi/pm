#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."
docker compose up --build -d
printf '%s\n' "Project Management MVP is running at http://localhost:8000"
