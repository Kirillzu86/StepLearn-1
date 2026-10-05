#!/bin/sh
set -e

if [ -n "$POSTGRES_HOST" ] && [ "$POSTGRES_HOST" != "sqlite" ]; then
    echo "Waiting for postgres at $POSTGRES_HOST:${POSTGRES_PORT:-5432}..."
    while ! nc -z "$POSTGRES_HOST" "${POSTGRES_PORT:-5432}"; do
        sleep 0.5
    done
    echo "PostgreSQL started"
fi

echo "Applying database migrations..."
python manage.py migrate --noinput

if [ "${SEED_DEMO_DATA:-0}" = "1" ]; then
    echo "Seeding explicitly requested demo data..."
    python manage.py seed_demo
else
    echo "Skipping demo data seeding (set SEED_DEMO_DATA=1 to opt in)."
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput || true

exec "$@"
