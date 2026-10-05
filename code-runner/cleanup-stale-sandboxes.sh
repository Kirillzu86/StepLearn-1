#!/bin/sh
set -eu

max_age_seconds="${MAX_SANDBOX_AGE_SECONDS:-90}"
case "$max_age_seconds" in
    ''|*[!0-9]*)
        echo "MAX_SANDBOX_AGE_SECONDS must be a positive integer" >&2
        exit 2
        ;;
esac
if [ "$max_age_seconds" -lt 60 ]; then
    echo "MAX_SANDBOX_AGE_SECONDS must be at least 60" >&2
    exit 2
fi

now="$(date +%s)"
docker ps -q --filter 'label=steplearn.sandbox=true' --filter 'status=running' |
while IFS= read -r container_id; do
    [ -n "$container_id" ] || continue
    created_at="$(docker inspect --format '{{.Created}}' "$container_id")"
    created_epoch="$(date --date="$created_at" +%s)"
    age="$((now - created_epoch))"
    if [ "$age" -gt "$max_age_seconds" ]; then
        echo "Removing stale StepLearn sandbox $container_id (age ${age}s)"
        docker rm --force "$container_id"
    fi
done
