#!/bin/sh
# API container entrypoint (CLAUDE.md §11): migrations → seed (only if this snapshot is not
# loaded yet) → server. `prisma migrate deploy` doubles as the wait for the database.
set -eu

# JWT secret: a real one from the environment wins. Unset or the .env.example placeholder →
# generate a random secret once and keep it in the /app/secrets volume (sessions survive
# restarts; a clean `docker compose up` needs no configuration and never runs with a known
# secret).
if [ -z "${JWT_SECRET:-}" ] || [ "${JWT_SECRET}" = "change-me-in-production" ]; then
  secret_file=/app/secrets/jwt_secret
  if [ ! -s "$secret_file" ]; then
    node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))" > "$secret_file"
    chmod 600 "$secret_file"
    echo "entrypoint: generated a JWT secret in $secret_file"
  fi
  JWT_SECRET=$(cat "$secret_file")
  export JWT_SECRET
fi

tries=0
until node_modules/.bin/prisma migrate deploy; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "entrypoint: database not reachable after $tries attempts" >&2
    exit 1
  fi
  echo "entrypoint: database not ready, retrying in 2 s ($tries/30)"
  sleep 2
done

# SEED_FLAGS: --if-empty (default) skips a snapshot already loaded; --force reloads it.
node dist/seed.js ${SEED_FLAGS:---if-empty}

exec node dist/server.js
