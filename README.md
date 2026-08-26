# Project Management MVP

## Run with Docker

Ensure the root `.env` contains `OPENROUTER_API_KEY`, then run:

```bash
./scripts/start.sh
```

On Windows PowerShell:

```powershell
.\scripts\start.ps1
```

Open http://localhost:8000. Stop the service with the matching `stop` script.

## Current application

The container builds and serves the static Next.js Kanban application at `/`. The `/api/hello` endpoint remains available as a basic backend health check.
