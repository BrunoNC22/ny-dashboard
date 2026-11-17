# ny-dashboard

[![CI](https://github.com/BrunoNC22/ny-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/BrunoNC22/ny-dashboard/actions/workflows/ci.yml)

Dashboard personalizável e visualmente rico construído com **React, react-grid-layout, Chart.js, Tailwind CSS, deck.gl/MapLibre**, e backend **Express + Prisma + PostgreSQL**, usando dados reais de corridas de táxi e apps de Nova York (NYC TLC, out/2024 → set/2026).

> 🚧 Em construção — veja as [issues](../../issues) e os [milestones](../../milestones). Contexto e decisões completas em [CLAUDE.md](./CLAUDE.md).

## Desenvolvimento

Requisitos: Node 24, pnpm (a versão vem do `packageManager`) e Docker.

```sh
cp .env.example .env              # variáveis locais (o git ignora este arquivo)
pnpm install                      # também gera o Prisma Client (postinstall)
docker compose up -d db           # Postgres 18 em localhost:5432
pnpm --filter @ny-dashboard/api db:migrate   # aplica as migrations
pnpm --filter @ny-dashboard/api dev          # API em http://localhost:3000/api/health
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
