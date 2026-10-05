# StepLearn frontends

StepLearn has two independent React applications that use the same Django API
and PostgreSQL database:

- Student website: `frontend`
- Teacher website: `frontend-teacher`

## Local development

Start Django on `http://localhost:8000`, then run each frontend in a separate
terminal from the repository root:

```powershell
npm --prefix frontend run dev
npm --prefix frontend-teacher run dev
```

The student website uses Vite on port `5173`; the teacher website uses port
`3001`. Both development servers proxy API requests to Django. The teacher
proxy target can be changed with `VITE_BACKEND_PROXY_TARGET`.

## Docker Compose

Configure the root `.env` file using `.env.example`, then run from the
repository root:

```powershell
docker compose up --build
```

The student website is available on `FRONTEND_PORT` (default `80`), and the
teacher website on `TEACHER_FRONTEND_PORT` (default `3001`). Each frontend is
its own service; both Nginx instances forward API routes to the same `backend`
service. Django and both frontends use the single PostgreSQL service and volume
configured in the root Compose file.

Set `VITE_TEACHER_APP_URL` to the externally reachable teacher website URL to
show teacher sign-in links on the student website. For separate production
domains, configure each domain in Django's `CORS_ALLOWED_ORIGINS` and
`CSRF_TRUSTED_ORIGINS`, or keep the provided same-origin Nginx API proxy.
