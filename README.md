# Beely 🐝

Plataforma de fidelización multi-negocio. Reglas del proyecto y stack en [CLAUDE.md](CLAUDE.md); modelo de datos en [docs/modelo-datos.md](docs/modelo-datos.md).

## Requisitos

- Node 22 (`.nvmrc`) y pnpm 10 (`corepack enable`)
- Docker (para Supabase local)
- `psql` (cliente de Postgres) para las pruebas SQL

## Primeros pasos

```bash
pnpm install
pnpm db:iniciar      # levanta Supabase local y aplica supabase/migrations
pnpm db:probar       # corre supabase/tests/*.sql
pnpm dev:panel       # http://localhost:5173
pnpm dev:club        # http://localhost:5174
```

Para las apps, copia `apps/<app>/.env.example` a `apps/<app>/.env.local` y pon la `anon key` que muestra `pnpm exec supabase status`. Todas las variables están en [.env.example](.env.example).

Para el panel también necesitas las Edge Functions: `pnpm exec supabase functions serve`. La semilla local (`supabase/seed.sql`) crea `superadmin@hibeely.test`, `dueno@hibeely.test` y `cajero@hibeely.test` con clave `beely1234`. Detalles en [docs/sprint-1.md](docs/sprint-1.md).

## Comandos

| Comando | Qué hace |
|--------|---------|
| `pnpm db:iniciar` / `pnpm db:detener` | Levanta / detiene Supabase local |
| `pnpm db:reset` | Borra la base local, reaplica todas las migraciones y carga `supabase/seed.sql` |
| `pnpm db:probar` | Corre las pruebas SQL; falla si psql da error o si alguna imprime `FALLO` |
| `pnpm db:tipos` | Regenera `packages/tipos/src/database.ts` desde la base local |
| `pnpm typecheck` / `pnpm build` | TypeScript y build de todos los paquetes |

## CI

`.github/workflows/ci.yml` corre en cada push a `main` y en cada PR:

1. **Migraciones y pruebas SQL**: `supabase db start` (aplica las migraciones), `supabase db lint`, `pnpm db:probar` y verifica que los tipos generados estén al día.
2. **Edge Functions**: `deno check` de cada función.
3. **Typecheck y build** de apps y paquetes.

## Pruebas SQL

- `supabase/tests/0001_nucleo.sql`: recorrido legible de las reglas de la migración 0001 (imprime resultados).
- `supabase/tests/0002_nucleo_aserciones.sql`: las mismas reglas como aserciones; cualquier resultado inesperado lanza error y pone CI en rojo.
- `supabase/tests/0003_panel_aserciones.sql`: reglas del Sprint 1 (alta de negocios, equipo, sede y estado al sumar sellos).
