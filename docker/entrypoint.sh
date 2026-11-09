#!/bin/sh
# One container, batteries included.
#
# With no DATABASE_URL the image runs its own PostgreSQL on the data volume, so `docker
# run` is the whole installation. With DATABASE_URL set it uses that and starts no
# database at all, which is what a team already running Postgres wants.
set -e

PGDATA=/data/postgres
PGLOG="$PGDATA/server.log"
EMBEDDED=0

say() { echo "wizrelay-gate: $*"; }

if [ -z "$DATABASE_URL" ]; then
  EMBEDDED=1
fi

# A panel that refuses to boot without a secret is a panel nobody can try. One is made
# once and kept on the volume, so sessions survive a restart and an operator who wants to
# supply their own still can.
if [ -z "$AUTH_SECRET" ]; then
  SECRET_FILE=/data/auth-secret
  if [ ! -s "$SECRET_FILE" ]; then
    mkdir -p /data
    head -c 48 /dev/urandom | base64 | tr -d '\n' > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
    say "generated an AUTH_SECRET in $SECRET_FILE"
  fi
  AUTH_SECRET="$(cat "$SECRET_FILE")"
  export AUTH_SECRET
fi

if [ "$EMBEDDED" = "1" ]; then
  if ! command -v postgres >/dev/null 2>&1; then
    say "no DATABASE_URL and no built-in PostgreSQL in this image" >&2
    exit 1
  fi

  mkdir -p "$PGDATA" /run/postgresql
  # The log lives inside the cluster directory: everything else on /data belongs to the
  # app user, and pg_ctl writes as postgres.
  chown postgres:postgres "$PGDATA" /run/postgresql
  chmod 700 "$PGDATA"

  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    say "preparing the built-in database"
    su-exec postgres initdb -D "$PGDATA" -U postgres --auth-local=trust --auth-host=trust >/dev/null
    # Reachable from this container only; nothing is published and no password is needed
    # because nothing outside can open the socket.
    echo "listen_addresses = '127.0.0.1'" >> "$PGDATA/postgresql.conf"
  fi

  su-exec postgres pg_ctl -D "$PGDATA" -l "$PGLOG" -w -t 60 start
  su-exec postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='wizrelay_gate'" \
    | grep -q 1 || su-exec postgres createdb wizrelay_gate
  DATABASE_URL="postgresql://postgres@127.0.0.1:5432/wizrelay_gate?schema=public"
  export DATABASE_URL
  say "using the built-in database"
else
  say "using DATABASE_URL"
fi

say "applying migrations"
node /opt/prisma/node_modules/prisma/build/index.js migrate deploy --schema /app/prisma/schema.prisma

# The cluster keeps its own ownership; everything else on the volume is the app's.
find /data -mindepth 1 -maxdepth 1 ! -name postgres -exec chown -R node:node {} + 2>/dev/null || true

if [ "$EMBEDDED" = "0" ]; then
  exec su-exec node "$@"
fi

# With a database of our own to look after, the panel is supervised rather than exec'd:
# a container stop should close PostgreSQL properly instead of leaving it to recover.
su-exec node "$@" &
APP=$!

stop() {
  kill -TERM "$APP" 2>/dev/null || true
  wait "$APP" 2>/dev/null || true
  su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
  exit 0
}
trap stop TERM INT

wait "$APP"
STATUS=$?
su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true
exit "$STATUS"
