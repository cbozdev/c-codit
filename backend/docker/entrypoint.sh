#!/usr/bin/env bash
set -euo pipefail

cd /var/www/html

PORT="${PORT:-8080}"
echo "[entrypoint] Binding nginx to port ${PORT}"
sed -i "s/__PORT__/${PORT}/g" /etc/nginx/nginx.conf

# Generate APP_KEY if missing (only first boot in dev; production should set it).
if [ -z "${APP_KEY:-}" ] && [ ! -f .env ]; then
    echo "[entrypoint] No APP_KEY and no .env; generating one (dev only)."
    php artisan key:generate --show > /tmp/appkey
    export APP_KEY="$(cat /tmp/appkey)"
fi

# Ensure storage perms (Render mounts can reset these).
mkdir -p storage/framework/{cache/data,sessions,views,testing} storage/logs bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

# Cache config / routes / events / views.
php artisan config:clear  >/dev/null 2>&1 || true
php artisan route:clear   >/dev/null 2>&1 || true
php artisan view:clear    >/dev/null 2>&1 || true
php artisan event:clear   >/dev/null 2>&1 || true

php artisan config:cache  || echo "[entrypoint] config:cache failed (continuing)"
php artisan route:cache   || echo "[entrypoint] route:cache failed (continuing)"
php artisan event:cache   || echo "[entrypoint] event:cache failed (continuing)"

# Migrations: opt-in via RUN_MIGRATIONS=true (default true on first boot).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
    echo "[entrypoint] Running migrations..."
    php artisan migrate --force --no-interaction || {
        echo "[entrypoint] Migrations failed."
        exit 1
    }
fi

if [ "${RUN_SEEDERS:-false}" = "true" ]; then
    echo "[entrypoint] Running seeders..."
    php artisan db:seed --force --no-interaction || true
fi

echo "[entrypoint] Boot complete; starting supervisord."
exec "$@"
