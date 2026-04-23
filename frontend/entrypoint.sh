#!/bin/sh
# nginx:alpine has an envsubst entrypoint that substitutes ${VAR} in templates;
# this is just a no-op safety net to confirm PORT is set.
set -e
export PORT="${PORT:-8080}"
echo "[entrypoint] frontend serving on port ${PORT}"
