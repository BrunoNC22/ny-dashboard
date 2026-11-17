# ny-dashboard — CLAUDE.md

Este documento é a **fonte da verdade** do projeto. Todas as decisões tomadas com o dono do projeto estão aqui. Qualquer agente que continuar o desenvolvimento deve ler este arquivo inteiro antes de começar.

> **Regra de ouro:** não tome decisões em aberto sozinho. Se surgir uma dúvida que não esteja respondida aqui, **pergunte ao dono do projeto trazendo alternativas (com uma recomendação)**, e depois registre a decisão neste arquivo.

---

## 1. Objetivo

Repositório de demonstração que mostra como construir um **dashboard poderoso, personalizável e visualmente impressionante** com:

- **React + TypeScript** (front)
- **react-grid-layout** — o usuário monta o próprio dashboard (adicionar, mover, redimensionar, editar e remover widgets)
- **Chart.js** — gráficos, com **um arquivo único de estilo** que segue o tema/paleta da aplicação
- **Tailwind CSS** — componentização e acesso fácil às cores do sistema (tokens)
- **Express + Prisma + PostgreSQL** (back, padrão MVC)

O dashboard usa **dados reais de corridas de táxi/apps de Nova York (NYC TLC)**.

Fluxo esperado de quem clona o repo: `docker compose up` → abre o navegador → usa o dashboard (anônimo ou logado como `demo`/`demo1234`) → monta o dashboard → loga em outro navegador/dispositivo e vê o mesmo dashboard.

## 2. Idioma e convenções

| Item | Idioma |
|---|---|
| Interface (UI) | pt-BR (sem i18n) |
| CLAUDE.md, README, issues | pt-BR |
| Código (identificadores, comentários) | inglês |
| Mensagens de commit | inglês |

- Formatação de números: locale `pt-BR`. Valores monetários são em **dólar** (dados de NY) → `US$ 1.234,56`.
- Datas exibidas como `dd/MM/yyyy`. **Fuso horário: `America/New_York`** (os timestamps da TLC são horário local de NY, sem fuso).

## 3. Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node 24 LTS |
| Gerenciador | pnpm 12 (workspaces; versão fixada em `packageManager` no `package.json` raiz). Os pacotes que podem rodar scripts de instalação ficam em `allowBuilds` no `pnpm-workspace.yaml` (aprovar com `pnpm approve-builds <pkg>`) |
| Linguagem | TypeScript **6.0.x** (front, back e shared). **Não usar o TS 7**: o `typescript-eslint` só aceita versões abaixo da 6.1 |
| Front | React 19, Vite, Tailwind CSS v4, React Router, Zustand (estado), TanStack Query (dados do servidor), zod, lucide-react (ícones), fonte Inter |
| Gráficos | chart.js 4 + react-chartjs-2 + adapter de datas (date-fns) |
| Grid | react-grid-layout (`Responsive`) |
| Mapa | MapLibre GL (`react-map-gl/maplibre`) + **deck.gl** por cima; mapa de fundo **OpenFreeMap** (gratuito, sem chave) |
| Back | Express 5, Prisma (última major estável), PostgreSQL, zod, bcrypt, JWT |
| ETL | DuckDB via `@duckdb/node-api` (TypeScript) |
| Testes | Vitest (unidade), Supertest + Postgres real (integração), Playwright (E2E) |
| Lint/format | ESLint + Prettier |
| Infra | Docker (um Dockerfile por app), docker-compose na raiz, GitHub Actions (CI) |

## 4. Estrutura do monorepo

```
.
├── api/                     # backend (Express + Prisma, MVC)
│   ├── Dockerfile
│   ├── prisma/              # schema.prisma + migrations
│   ├── data/
│   │   ├── snapshot/        # dados agregados versionados (CSV gz em chunks) + manifest.json
│   │   └── zones/           # taxi_zones.geojson (WGS84, simplificado) + taxi_zone_lookup.csv
│   ├── etl/                 # scripts de ETL (DuckDB) — `pnpm etl`
│   ├── src/
│   │   ├── routes/          # definição das rotas
│   │   ├── controllers/     # entrada HTTP, validação (zod), chama services
│   │   ├── services/        # regras de negócio e queries
│   │   ├── models/          # acesso a dados (Prisma client / repositórios / SQL agregado)
│   │   ├── views/           # serializers/DTOs de resposta (o "V" do MVC numa API JSON)
│   │   ├── middlewares/     # auth, erro, validação
│   │   ├── lib/             # utilitários (holt-winters, datas, env)
│   │   ├── seed/            # seed idempotente
│   │   └── server.ts
│   └── tests/
├── web/                     # frontend (React + Vite)
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── src/
│   │   ├── charts/chartTheme.ts   # ÚNICO arquivo de estilo do Chart.js
│   │   ├── map/mapTheme.ts        # estilo do mapa (MapLibre/deck.gl) derivado dos mesmos tokens
│   │   ├── styles/                # Tailwind v4 (@theme), tokens, paletas
│   │   ├── components/            # componentes base (Button, Card, Modal, ...)
│   │   ├── widgets/               # registro e implementação dos tipos de widget
│   │   ├── stores/                # Zustand
│   │   ├── api/                   # cliente HTTP + hooks TanStack Query
│   │   └── pages/
│   └── e2e/                       # Playwright
├── shared/                  # pacote @ny-dashboard/shared: schemas zod, tipos, catálogo de métricas, dashboard padrão
├── docker-compose.yml
├── pnpm-workspace.yaml
└── .github/workflows/
```

- Os Dockerfiles ficam em `api/` e `web/`, mas o **contexto de build é a raiz** (para incluir `shared/` e o lockfile).
- `shared` é consumido como pacote de workspace (`@ny-dashboard/shared`, `workspace:*`) pelos dois apps. Ele **não tem etapa de build**: o `exports` aponta direto para `./src/index.ts`.
  - **web:** o Vite compila o TS do shared.
  - **api:** em dev roda com `tsx watch`. Para produção, é empacotada com **tsup**, que já inclui o shared no bundle, e roda com `node dist/server.js`.
  - Os `tsconfig` de todos os pacotes estendem o `tsconfig.base.json` (strict, `module: preserve`, `moduleResolution: bundler`, `noEmit`). Como o TS 6 usa `types: []` por padrão, cada pacote declara os tipos que usa (por exemplo, `types: ["node"]` na api).

## 5. Dados — NYC TLC Trip Records

### 5.1 Fonte

- Arquivos parquet mensais: `https://d37ci6vzurychx.cloudfront.net/trip-data/{service}_tripdata_{YYYY-MM}.parquet`
- Zonas: `https://d37ci6vzurychx.cloudfront.net/misc/taxi_zones.zip` (shapefile, EPSG:2263) e `.../misc/taxi_zone_lookup.csv`
- A TLC publica com ~2 meses de atraso. Em 16/11/2026, o último mês disponível era **set/2026** (out/2026 ainda retornava 403).
- **Atribuição obrigatória na UI e no README:** NYC Taxi & Limousine Commission (dados), OpenStreetMap contributors / OpenFreeMap (mapa de fundo).

### 5.2 Escopo

- **Serviços:** Yellow, Green e **FHVHV** (Uber/Lyft). (~60–70 MB/mês yellow, ~1 MB/mês green, ~500 MB/mês FHVHV.) O volume grande é intencional: queremos ver o desempenho com muitos dados.
- **Período:** 24 meses, **out/2024 → set/2026**. **As datas NÃO são deslocadas** — são as datas reais.
- **Empresa** (FHVHV): `HV0003` = Uber, `HV0005` = Lyft (outros códigos, se aparecerem, viram "Outra"). Empresa é **filtro e dimensão**. Para Yellow/Green a empresa é o próprio serviço.

### 5.3 Pipeline (ETL → snapshot → seed)

1. `pnpm etl` (em `api/`) usa DuckDB para ler os parquets via HTTP (lendo só as colunas necessárias), normalizar, limpar e agregar.
2. O resultado é um **snapshot agregado versionado no repo**, em `api/data/snapshot/` (CSV gzip, em chunks de **≤ 45 MB** cada, por causa do limite de 100 MB por arquivo do GitHub), com um `manifest.json` contendo o período, contagens de linhas, checksums e a data de geração.
3. O **seed** carrega o snapshot no Postgres (via `COPY`, por desempenho). O seed funciona **offline**, sem baixar nada.
4. **Atualização mensal: manual.** Rodar `pnpm etl` e commitar o snapshot novo. (Sem GitHub Action agendado.)

### 5.4 Normalização entre serviços

| Métrica base (somável) | Yellow / Green | FHVHV |
|---|---|---|
| `trips` | contagem | contagem |
| `passengers` | `passenger_count` | **não se aplica** |
| `revenue` (**total pago pelo passageiro**) | `total_amount` | `base_passenger_fare + tolls + bcf + sales_tax + congestion_surcharge + airport_fee + tips + cbd_congestion_fee` |
| `fare` | `fare_amount` | `base_passenger_fare` |
| `tips` | `tip_amount` (obs.: só gorjeta em cartão é registrada) | `tips` |
| `distance_mi` | `trip_distance` | `trip_miles` |
| `duration_s` | dropoff − pickup | `trip_time` |
| `airport_trips` | PU ou DO nas zonas 1 (EWR), 132 (JFK), 138 (LGA) | idem |
| `card_trips` / `cash_trips` | `payment_type` 1 / 2 | **não se aplica** |
| `cbd_fee` | `cbd_congestion_fee` (existe a partir de jan/2025) | idem |
| `wait_s` | **não se aplica** | pickup − request |
| `driver_pay` | **não se aplica** | `driver_pay` |
| `shared_trips` | **não se aplica** | `shared_match_flag = 'Y'` |

Métricas que não existem num serviço aparecem na UI como **"não se aplica"**.

### 5.5 Regras de limpeza (no ETL)

Descartar corridas com: tarifa negativa; distância ≤ 0; duração ≤ 0 ou > 3h; pickup fora do mês do arquivo; zona de embarque inválida.

### 5.6 Tabelas agregadas (snapshot)

1. **Diário × zona de embarque × serviço × empresa** → todas as métricas base somáveis.
2. **Hora × serviço × empresa** → métricas base (séries horárias e cortes por hora do dia × dia da semana). São ~17,5 mil pontos por série em 24 meses.
3. **Mês × origem → destino × serviço × empresa** → apenas as **top N rotas** por mês (para os arcos do mapa e a tabela de rotas).
4. **Amostra de corridas individuais:** ~**1 milhão** de corridas de **set/2026** (último mês), dos 3 serviços (proporcional ao volume, com piso por serviço). Alimenta os widgets scatter/bubble e a camada de pontos do mapa.
5. **Zonas:** GeoJSON WGS84 simplificado + lookup (zona, distrito, `service_zone`).

**A TLC não publica coordenadas** (só os IDs das zonas). Na amostra, cada corrida recebe uma **posição aleatória determinística (com seed fixa) dentro do polígono da sua zona de embarque**. A UI deve **avisar que a posição é aproximada**.

### 5.7 Catálogo de métricas

- **Volume:** corridas, passageiros.
- **Financeiro:** receita total, tarifa média, gorjeta média, % de gorjeta, receita por milha, taxa de congestionamento (CBD) arrecadada.
- **Operação:** distância média, duração média, velocidade média, % de corridas de aeroporto, % cartão × dinheiro.
- **FHVHV:** tempo médio de espera, % da tarifa que vai para o motorista, % de corridas compartilhadas.
- **Cortes (dimensões):** serviço, empresa, distrito (borough), zona, hora do dia, dia da semana.

As **métricas derivadas são calculadas a partir das somas** (por exemplo: tarifa média = Σfare / Σtrips; % gorjeta = Σtips / Σfare; velocidade = Σdistance / Σduration). Nunca calcule média de médias. O catálogo (id, rótulo, unidade, fórmula, serviços aplicáveis, direção "maior é melhor/menor é melhor", ícone) mora em `shared`.

### 5.8 Projeção (esperado × real)

- Modelo: **Holt-Winters** (aditivo, sazonalidade **semanal**, m = 7, com parâmetros otimizados por erro), implementado em TS (`api/src/lib`).
- Calculada **no seed**, a partir dos dados carregados, e guardada no banco.
- Granularidade: **diária, por serviço × distrito**, só para **métricas somáveis**. Médias e percentuais da projeção são derivados das somas projetadas.
- **Backtest mensal:** para cada mês M, a projeção é feita **só com dados até o fim de M−1** → permite "esperado × real" em qualquer período. O primeiro mês com backtest é **nov/2024** (out/2024 é aquecimento).
- **Projeção futura:** out/2026 → dez/2026 (feita com os dados até set/2026).

## 6. Funcionalidades do dashboard

### 6.1 Widgets

Tipos:
- **Gráficos:** line, bar, área, barras empilhadas, doughnut/pie, radar, polar area, scatter, bubble.
- **KPI:** card com ícone, valor, variação e status.
- **Tabela:** por exemplo top zonas e top rotas.
- **Mapa:** zonas coloridas por métrica, bolhas por zona, heatmap de densidade, arcos de fluxo origem→destino, pontos (amostra; posição aproximada) e hexágonos 3D. Feito com MapLibre + deck.gl.

Operações: **adicionar** (pela **galeria de modelos prontos**, que depois podem ser customizados), **editar** (**modal** com prévia ao vivo), **mover**, **redimensionar**, **duplicar** e **remover**.

### 6.2 Período, filtros e comparações

- **Filtros globais** no topo: **período, serviço, empresa e distrito**. Cada widget pode **sobrescrever** os filtros globais.
- Período padrão: **último mês disponível × mês anterior** (ex.: 09/2026 × 08/2026).
- Modos de comparação: período anterior, mesmo período do ano anterior, intervalo personalizado e **projeção × real**.
- **Comparação em gráficos:** as **séries sobrepostas** no mesmo gráfico (atual sólida, comparada tracejada), alinhadas pelo deslocamento do início do período (dia 1 com dia 1), com a **variação %**.
- **Comparação no mapa:** zonas coloridas pela **variação %**, com escala divergente vermelho ↔ verde.

### 6.3 KPIs

Status **bom / atenção / ruim** com ícone e cor. Configurável **por KPI**:
- **comparação com o período anterior**, respeitando a direção da métrica (maior é melhor / menor é melhor), **e/ou**
- **comparação com uma meta**, com faixas verde/amarelo/vermelho.

### 6.4 Layouts desktop e mobile

- `react-grid-layout` `Responsive`, com **dois breakpoints**: **desktop ≥ 768px (12 colunas)** e **mobile < 768px (2 colunas)**.
- **O conjunto de widgets é o mesmo nos dois layouts.** Adicionar ou remover um widget vale para os dois. **Posição e tamanho são independentes:** mexer no desktop não afeta o mobile, e vice-versa.
- O grid é **sempre editável**, sem modo de edição. Para não brigar com a rolagem no toque, o arraste acontece **pelo cabeçalho do widget** (drag handle) e o redimensionamento pelo canto.
- Um dashboard por usuário.
- **Desfazer/refazer** (histórico no cliente, ~50 passos) e **"voltar ao padrão"** (o dashboard padrão fica em `shared`, e é o mesmo usado pelo seed).

### 6.5 Persistência

- **Autosave com debounce de ~800ms** e indicador "salvando… / salvo". O front envia o estado completo (`PUT /api/dashboard`: widgets + layout desktop + layout mobile). Se dois dispositivos editarem ao mesmo tempo, **a última gravação vence**.
- Ao voltar o foco para a janela, o front busca o estado de novo (TanStack Query), para refletir mudanças feitas em outro dispositivo.
- **Visitante sem conta:** o estado fica no `localStorage`. Ao **entrar ou criar conta**, se houver estado local modificado, o app oferece **importá-lo para a conta**.
- **Tema** (claro/escuro, **padrão escuro**) e **paleta** ficam salvos na conta, valem igual no desktop e no mobile, e sincronizam entre dispositivos. Para visitantes, ficam no `localStorage`.

### 6.6 Autenticação (simples de propósito)

- Login com **usuário + senha** (sem e-mail). Senha com **bcrypt**.
- **JWT em cookie httpOnly** (`SameSite=Lax`). Endpoints: `register`, `login`, `logout`, `me`.
- Em produção, front e API ficam na mesma origem (o nginx repassa `/api`). Em desenvolvimento, o Vite faz o proxy. Não precisa de CORS.
- Usuário do seed: **`demo` / `demo1234`**, já com o dashboard padrão.

## 7. Visual

- Estilo **"glass"**: cards translúcidos com `backdrop-blur`, bordas com gradiente, **brilho (glow)** na cor de destaque, gradientes nos fundos e nas áreas dos gráficos, e muitos ícones (lucide).
- **6 paletas prontas** (nomes provisórios: Aurora, Sunset, Ocean, Neon, Forest, Mono), cada uma com variante clara e escura.
- **Tokens no Tailwind v4 (`@theme`)** como fonte única das cores. Tanto o `chartTheme.ts` (Chart.js) quanto o `mapTheme.ts` (MapLibre/deck.gl) **leem os mesmos tokens** (variáveis CSS), então mudar o tema ou a paleta atualiza gráficos e mapas.
- `web/src/charts/chartTheme.ts` é **o único lugar** com estilo do Chart.js: defaults globais, fontes, grid, tooltips, helpers de gradiente e um plugin de glow.

## 8. Desempenho com muitos dados

- **A API manda todos os pontos** pedidos, sem reduzir no servidor. Quem decide como desenhar é o Chart.js: o plugin de **decimação (LTTB)** fica ligado em gráficos de linha (o que exige `parsing: false`, eixo de tempo/linear e animação desligada em séries grandes).
- **Comportamento esperado e documentado:** um scatter com a amostra de 1 milhão de corridas manda dezenas de MB em JSON e **vai ficar lento ou travar o Chart.js**. Isso é proposital, para demonstrar os limites. O mapa usa deck.gl (GPU), que aguenta esse volume.

## 9. API (visão geral)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` | autenticação |
| GET | `/api/auth/me` | usuário atual |
| GET/PUT | `/api/dashboard` | estado completo (widgets + layouts desktop/mobile) |
| GET/PUT | `/api/preferences` | tema e paleta |
| GET | `/api/meta` | período disponível, serviços, empresas, distritos, catálogo de métricas |
| GET | `/api/zones` | GeoJSON das zonas (com cache/ETag) |
| POST | `/api/query/timeseries` | série temporal (métrica, granularidade, intervalo, filtros, agrupamento, comparação, projeção) |
| POST | `/api/query/kpi` | valor, valor comparado, variação, meta, status |
| POST | `/api/query/breakdown` | agregação por dimensão (pizza, radar, barras, tabela) |
| POST | `/api/query/map` | valores por zona (com variação), fluxos origem→destino, pontos da amostra |
| POST | `/api/query/trips` | pontos da amostra de corridas para scatter/bubble |

Todos os payloads são validados com schemas zod de `shared`. Fluxo MVC: `routes → controllers → services → models`, e a resposta passa por `views` (serializers).

## 10. Testes e qualidade

- **Unidade (Vitest):** `shared`, `api` (services, Holt-Winters, transformações do ETL) e `web` (componentes com Testing Library + jsdom, stores, chartTheme).
- **Integração (Vitest + Supertest):** a API contra um **Postgres real**, com um conjunto pequeno de dados de teste.
- **E2E (Playwright):** contra o stack do docker compose. Cobre: login como demo; adicionar, editar, mover, redimensionar e remover widget; persistência entre dois contextos de navegador; independência entre desktop e mobile; tema e paleta.
- **CI (GitHub Actions):** lint, typecheck, testes de unidade e integração (com um service Postgres), build das imagens e E2E.
- **Lint/format:** ESLint + Prettier.

## 11. Infraestrutura

- `docker-compose.yml` na raiz sobe **db** (Postgres, com healthcheck e volume), **api** e **web**.
- **api:** imagem multi-stage. O entrypoint roda `prisma migrate deploy`, depois o **seed com `--if-empty`** (só popula se o banco estiver vazio, idempotente) e por fim sobe o servidor.
- **web:** build estático servido por **nginx**, que repassa `/api` para a api e faz o fallback de SPA.
- **Desenvolvimento local:** `docker compose up db` + `pnpm dev` (api e web com hot reload, fora do Docker).

## 12. Fluxo de trabalho

- Repositório GitHub: **`ny-dashboard`**, público, licença **MIT**.
- As tarefas são **issues**, organizadas em **milestones** (fases) e **labels**: `api`, `web`, `infra`, `docs`, `test`, `data`.
- **Commits direto na `main`** (sem PR). A mensagem do commit referencia a issue (`closes #N`).
- Antes de commitar: lint, typecheck e testes passando.
- Toda decisão nova vai para este arquivo.

## 13. Decisões técnicas derivadas (sujeitas a veto)

Detalhes de implementação decididos pelo agente a partir das decisões acima. Não foram perguntados um a um. Se o dono do projeto discordar, mude aqui e nas issues.

- Contexto de build dos Dockerfiles é a raiz do monorepo, para incluir `shared/` e o lockfile.
- O snapshot e o GeoJSON das zonas ficam em `api/data/`, e o ETL em `api/etl/`, porque o seed roda dentro do container da api.
- O snapshot é dividido em chunks de até 45 MB (o limite do GitHub é 100 MB por arquivo).
- A amostra de corridas é proporcional ao volume de cada serviço, com um piso por serviço (para o Green não sumir).
- O "V" do MVC numa API JSON são os serializers/DTOs em `src/views/`.
- O Holt-Winters é aditivo, com α/β/γ otimizados por erro (SSE).
- O drag acontece pelo cabeçalho do widget (para não brigar com a rolagem no toque); o resize é pelo canto.
- Não existe widget de "heatmap hora × dia da semana" no Chart.js, porque não estava na lista aprovada. Cortes por hora e dia usam radar ou barras.
- A label extra `data` foi criada para as issues de ETL, snapshot e projeção.

## 14. Roteiro

O backlog completo está nas [issues do GitHub](https://github.com/BrunoNC22/ny-dashboard/issues), em 6 milestones. Cada issue lista as issues de que depende.

| Milestone | Issues | Conteúdo |
|---|---|---|
| M0 — Fundação | #1–#5 | monorepo, lint, shared, vitest, CI básico |
| M1 — Dados (ETL) | #6–#12 | zonas, ETL DuckDB, agregados, amostra, snapshot |
| M2 — API | #13–#28 | Express MVC, Prisma, catálogo, dashboard padrão, Holt-Winters, seed, auth, endpoints, integração |
| M3 — Web base | #29–#39 | bootstrap, design system, chartTheme, mapTheme, client, auth UI, store, grid, shell, filtros, preferências |
| M4 — Widgets | #40–#49 | infra de widgets, galeria, editor, gráficos, KPI, tabela, mapa |
| M5 — Entrega | #50–#55 | Dockerfiles, compose, E2E, CI completo, README |

As trilhas M1 (dados) e M3 (web base) podem andar em paralelo depois do M0.

## 15. Histórico de decisões

| Data | Decisão |
|---|---|
| 2026-11-16 | `shared` exporta o TS direto (sem build); a api usa tsx em dev e tsup em produção; TypeScript fixado em 6.0.x por compatibilidade com o typescript-eslint. |
| 2026-11-16 | Definição inicial completa (seções 1 a 12), feita com o dono do projeto antes de escrever qualquer código. Fonte de dados escolhida: NYC TLC (as alternativas avaliadas foram Olist, UCI Online Retail II, Contoso, BCB/Focus, ONS, OWID e dados sintéticos). |
