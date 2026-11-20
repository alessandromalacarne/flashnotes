#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PGPORT:-5432}"
DATABASES=(flashnotes flashnotes_test)

# Debian and Ubuntu ship PostgreSQL as clusters owned by the postgres user, and
# expect initdb to be driven by pg_createcluster. Elsewhere (nix, brew) the data
# directory lives in the repository and is owned by the current user.
if command -v pg_createcluster >/dev/null 2>&1; then
  MODE=cluster
  CLUSTER="${PGCLUSTER:-flashnotes}"
else
  MODE=local
  PGDATA="$ROOT/.pgdata"
  PGSOCK="$ROOT/.pgsock"
fi

pg_version() {
  if [ -n "${PGVER:-}" ]; then
    printf '%s\n' "$PGVER"
    return
  fi
  ls -1 /usr/lib/postgresql 2>/dev/null | sort -V | tail -n1
}

cluster_conf() {
  printf '/etc/postgresql/%s/%s\n' "$(pg_version)" "$CLUSTER"
}

cluster_port() {
  pg_lsclusters -h "$(pg_version)" "$CLUSTER" 2>/dev/null | awk 'NR == 1 { print $3 }'
}

as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "error: managing the PostgreSQL cluster requires root" >&2
    exit 1
  fi
}

is_running() {
  if [ "$MODE" = cluster ]; then
    pg_lsclusters -h "$(pg_version)" "$CLUSTER" 2>/dev/null \
      | awk 'NR == 1 { running = ($4 ~ /online/) } END { exit !running }'
  else
    pg_ctl -D "$PGDATA" status >/dev/null 2>&1
  fi
}

ensure_cluster() {
  if [ "$MODE" = cluster ]; then
    local version conf args=()
    version="$(pg_version)"
    if [ -z "$version" ]; then
      echo "error: no PostgreSQL server found under /usr/lib/postgresql" >&2
      exit 1
    fi
    conf="/etc/postgresql/$version/$CLUSTER"
    if [ ! -d "$conf" ]; then
      if [ -n "${PGPORT:-}" ]; then
        args=(--port "$PORT")
      fi
      # --auth=trust keeps pg_createcluster from rewriting initdb's pg_hba.conf.
      as_root pg_createcluster "$version" "$CLUSTER" --start-conf=manual \
        "${args[@]}" -- --auth=trust -U postgres
    fi
  elif [ ! -s "$PGDATA/PG_VERSION" ]; then
    mkdir -p "$PGDATA"
    initdb -D "$PGDATA" --auth=trust -U postgres >/dev/null
  fi
}

resolve_port() {
  if [ "$MODE" = cluster ]; then
    local port
    port="$(cluster_port)"
    if [ -z "$port" ]; then
      echo "error: could not determine the port of cluster $CLUSTER" >&2
      exit 1
    fi
    PORT="$port"
  fi
}

ensure_databases() {
  for db in "${DATABASES[@]}"; do
    if ! psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1; then
      createdb -h 127.0.0.1 -p "$PORT" -U postgres "$db"
    fi
  done
}

start() {
  ensure_cluster
  resolve_port
  if is_running; then
    echo "postgres already running on port $PORT"
  elif [ "$MODE" = cluster ]; then
    as_root pg_ctlcluster "$(pg_version)" "$CLUSTER" start
  else
    mkdir -p "$PGSOCK"
    pg_ctl -D "$PGDATA" -o "-p $PORT -k $PGSOCK -h 127.0.0.1" -l "$PGDATA/server.log" -w start
  fi
  ensure_databases
  if [ "$MODE" = cluster ]; then
    echo "postgres ready on port $PORT (cluster: $(pg_version)/$CLUSTER)"
  fi
}

stop() {
  if is_running; then
    if [ "$MODE" = cluster ]; then
      as_root pg_ctlcluster "$(pg_version)" "$CLUSTER" stop
    else
      pg_ctl -D "$PGDATA" -m fast stop
    fi
  else
    echo "postgres not running"
  fi
}

status() {
  if is_running; then
    if [ "$MODE" = cluster ]; then
      echo "postgres running on port $(cluster_port) (cluster: $(pg_version)/$CLUSTER)"
    else
      echo "postgres running on port $PORT (data: $PGDATA)"
    fi
  else
    echo "postgres stopped"
  fi
}

case "${1:-start}" in
  start)
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
    if [ "$MODE" = cluster ]; then
      if [ -d "$(cluster_conf)" ]; then
        as_root pg_dropcluster --stop "$(pg_version)" "$CLUSTER"
      fi
    else
      rm -rf "$PGDATA"
    fi
    start
    ;;
  *)
    echo "usage: $0 {start|stop|status|reset}" >&2
    exit 1
    ;;
esac
