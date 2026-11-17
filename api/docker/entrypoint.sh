#!/bin/sh
# API container entrypoint (CLAUDE.md §11): migrations → seed (only if this snapshot is not
# loaded yet) → server. `prisma migrate deploy` doubles as the wait for the database.
set -eu

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
