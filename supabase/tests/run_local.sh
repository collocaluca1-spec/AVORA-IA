#!/bin/bash
# Prueba las migraciones y reglas en un Postgres local (sin Supabase).
# Uso: PGURL=postgres://postgres@localhost:5432 ./supabase/tests/run_local.sh
set -e
cd "$(dirname "$0")/../.."
BASE=${PGURL:-postgres://postgres@localhost:5432}
psql "$BASE/postgres" -qc 'drop database if exists avora_test' -c 'create database avora_test'
for r in anon authenticated service_role; do psql "$BASE/postgres" -qc "drop role if exists $r" 2>/dev/null || true; done
P="psql $BASE/avora_test -v ON_ERROR_STOP=1 -q"
$P -f supabase/tests/supabase_stubs.sql
for f in supabase/migrations/*.sql; do $P -f "$f"; done
$P -f supabase/tests/workflow_test.sql
