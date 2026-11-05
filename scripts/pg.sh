#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT/.pgdata"
PGSOCK="$ROOT/.pgsock"
PORT="${PGPORT:-5432}"
DATABASES=(flashnotes flashnotes_test)

pg() { nix shell nixpkgs#postgresql --command "$@"; }

is_running() { pg pg_ctl -D "$PGDATA" status >/dev/null 2>&1; }

ensure_cluster() {
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    pg initdb -D "$PGDATA" --auth=trust -U postgres >/dev/null
  fi
}

ensure_databases() {
  for db in "${DATABASES[@]}"; do
    if ! pg psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
      pg createdb -h 127.0.0.1 -p "$PORT" -U postgres "$db"
    fi
  done
}

start() {
  mkdir -p "$PGSOCK"
  if is_running; then
    echo "postgres already running on port $PORT"
  else
    pg pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -h 127.0.0.1" -l "$PGDATA/server.log" -w start
  fi
  ensure_databases
}

stop() {
  if is_running; then
    pg pg_ctl -D "$PGDATA" -m fast stop
  else
    echo "postgres not running"
  fi
}

status() {
  if is_running; then
    echo "postgres running on port $PORT (data: $PGDATA)"
  else
    echo "postgres stopped"
  fi
}

case "${1:-start}" in
  start)
    ensure_cluster
    start
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  reset)
    stop || true
    rm -rf "$PGDATA"
    ensure_cluster
    start
    ;;
  *)
    echo "usage: $0 {start|stop|status|reset}" >&2
    exit 1
    ;;
esac
