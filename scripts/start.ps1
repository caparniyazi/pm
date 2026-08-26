$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
docker compose up --build -d
Write-Output "Project Management MVP is running at http://localhost:8000"
