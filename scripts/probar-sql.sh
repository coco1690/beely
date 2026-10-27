#!/usr/bin/env bash
# Corre todas las pruebas de supabase/tests/*.sql contra la base local.
# Falla si psql da error o si alguna prueba imprime "FALLO".
# Uso: pnpm db:probar   (requiere `pnpm db:iniciar` o `supabase db start`)
set -euo pipefail

cd "$(dirname "$0")/.."

DB_URL="${DB_URL:-$(pnpm exec supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')}"
if [ -z "$DB_URL" ]; then
  echo "No encontré DB_URL. ¿Está corriendo Supabase local? (pnpm db:iniciar)" >&2
  exit 1
fi

fallidas=0
for prueba in supabase/tests/*.sql; do
  echo "▶ $prueba"
  if ! salida=$(psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f "$prueba" 2>&1); then
    echo "$salida"
    echo "✗ $prueba: error de psql" >&2
    fallidas=$((fallidas + 1))
    continue
  fi
  if grep -q "FALLO" <<<"$salida"; then
    echo "$salida"
    echo "✗ $prueba: alguna comprobación imprimió FALLO" >&2
    fallidas=$((fallidas + 1))
    continue
  fi
  grep -E "NOTICE:  OK" <<<"$salida" | sed 's/^.*NOTICE:  /  /' || true
  echo "✓ $prueba"
done

if [ "$fallidas" -gt 0 ]; then
  echo "$fallidas archivo(s) de pruebas fallaron." >&2
  exit 1
fi
echo "Todas las pruebas SQL pasaron."
