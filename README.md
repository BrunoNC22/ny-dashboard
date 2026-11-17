# ny-dashboard

[![CI](https://github.com/BrunoNC22/ny-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/BrunoNC22/ny-dashboard/actions/workflows/ci.yml)

Dashboard personalizável e visualmente rico construído com **React, react-grid-layout, Chart.js, Tailwind CSS, deck.gl/MapLibre**, e backend **Express + Prisma + PostgreSQL**, usando dados reais de corridas de táxi e apps de Nova York (NYC TLC, out/2024 → set/2026).

> 🚧 Em construção — veja as [issues](../../issues) e os [milestones](../../milestones). Contexto e decisões completas em [CLAUDE.md](./CLAUDE.md).

## Rodar com Docker

Requisito: Docker com Compose v2.

```sh
docker compose up --build
```

Abra http://localhost:8080 e use o dashboard como visitante ou entre com **`demo` / `demo1234`**.

- Na primeira vez, a api aplica as migrations e carrega o snapshot de dados no Postgres (~2 min; acompanhe com `docker compose logs -f api`). Nas próximas, ela detecta que o snapshot já está no banco e sobe em segundos.
- Nada precisa ser configurado. Sem `JWT_SECRET` (ou com o valor de exemplo), a api gera um segredo aleatório e o guarda no volume `api-secrets`.

| Serviço | Porta                  | O que é                                               |
| ------- | ---------------------- | ----------------------------------------------------- |
| `web`   | `8080` (WEB_PORT)      | nginx com o app e o proxy de `/api`                   |
| `api`   | interna (`3000`)       | Express; acessível pelo nginx em `/api`               |
| `db`    | `5432` (POSTGRES_PORT) | PostgreSQL 18, publicado para o desenvolvimento local |

Variáveis opcionais (no ambiente ou num `.env`; veja o [`.env.example`](./.env.example)): `WEB_PORT`, `POSTGRES_PORT`, `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_SECURE` (use `true` atrás de HTTPS), `LOG_LEVEL` e `SEED_FLAGS` (`--force` recarrega o snapshot).

Para começar do zero: `docker compose down -v` (apaga o banco, as contas e os dashboards salvos).

## Desenvolvimento

Requisitos: Node 24, pnpm (a versão vem do `packageManager`) e Docker.

```sh
cp .env.example .env              # variáveis locais (o git ignora este arquivo)
pnpm install                      # também gera o Prisma Client (postinstall)
docker compose up -d db           # Postgres 18 em localhost:5432
pnpm --filter @ny-dashboard/api db:migrate   # aplica as migrations
pnpm --filter @ny-dashboard/api db:seed      # carrega o snapshot (~1,5 min; só na primeira vez)
pnpm dev                          # API (:3000) + web (http://localhost:5173, proxy /api → API)
```

Checagens: `pnpm lint`, `pnpm format:check`, `pnpm typecheck` e `pnpm test`.

Testes de integração da API (precisam do Postgres rodando; usam um banco separado `<DATABASE>_test`, recriado a cada execução):

```sh
pnpm --filter @ny-dashboard/api test:integration
```

## Atribuições

- Dados: [NYC Taxi & Limousine Commission — TLC Trip Record Data](https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page)
- Mapa de fundo: [OpenFreeMap](https://openfreemap.org) / © OpenStreetMap contributors

## Licença

[MIT](./LICENSE)
