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

The container builds and serves the static Next.js Kanban application at `/`. The `/api/hello` endpoint is the container health check.

## Configuration

- `OPENROUTER_API_KEY` (required for the AI chat feature): an OpenRouter key with credits. Without credits, chat requests fail with HTTP 402 from the provider.
- `OPENROUTER_MODEL` (optional): defaults to `openai/gpt-oss-120b`.
- `DATABASE_PATH` (optional): defaults to `data/pm.sqlite3`.

## Security model

This is a local, single-user demo. There is no authentication: the backend
trusts the `X-User-Id` request header, and sign-in is a hardcoded
`user` / `password` check in the browser. Do not expose this service beyond
localhost. Adding a real session mechanism is a prerequisite for any deployment.
