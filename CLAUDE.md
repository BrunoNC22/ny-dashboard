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

| Item                                  | Idioma           |
| ------------------------------------- | ---------------- |
| Interface (UI)                        | pt-BR (sem i18n) |
| CLAUDE.md, README, issues             | pt-BR            |
| Código (identificadores, comentários) | inglês           |
| Mensagens de commit                   | inglês           |

- Formatação de números: locale `pt-BR`. Valores monetários são em **dólar** (dados de NY) → `US$ 1.234,56`.
- Datas exibidas como `dd/MM/yyyy`. **Fuso horário: `America/New_York`** (os timestamps da TLC são horário local de NY, sem fuso).

## 3. Stack

| Camada      | Tecnologia                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime     | Node 24 LTS                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Gerenciador | pnpm 12 (workspaces; versão fixada em `packageManager` no `package.json` raiz). Os pacotes que podem rodar scripts de instalação ficam em `allowBuilds` no `pnpm-workspace.yaml` (aprovar com `pnpm approve-builds <pkg>`, negar com `pnpm approve-builds '!<pkg>'`). Prefira **negar** builds nativos que não são necessários (por exemplo, `better-sqlite3` e `msgpackr-extract`, que vêm com o mapshaper). Antes de dar push, valide com uma instalação limpa `pnpm install --frozen-lockfile`, que é o que o CI roda. O pnpm 12 também aplica `minimumReleaseAge` (rejeita versões publicadas há menos de cerca de 1 dia): **não adicione exceções em `minimumReleaseAgeExclude`**, prefira uma versão um pouco mais antiga |
| Linguagem   | TypeScript **6.0.x** (front, back e shared). **Não usar o TS 7**: o `typescript-eslint` só aceita versões abaixo da 6.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Front       | React 19, Vite, Tailwind CSS v4, React Router, Zustand (estado), TanStack Query (dados do servidor), zod, lucide-react (ícones), fonte Inter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Gráficos    | chart.js 4 + react-chartjs-2 + adapter de datas (date-fns)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Grid        | react-grid-layout (`Responsive`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Mapa        | MapLibre GL (`react-map-gl/maplibre`) + **deck.gl** por cima; mapa de fundo **OpenFreeMap** (gratuito, sem chave)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Back        | Express 5, Prisma (última major estável), PostgreSQL, zod, bcrypt, JWT                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ETL         | DuckDB via `@duckdb/node-api` (TypeScript)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Testes      | Vitest (unidade), Supertest + Postgres real (integração), Playwright (E2E)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Lint/format | ESLint 10 (flat config na raiz, `eslint.config.js`): `typescript-eslint` strict + stylistic **type-checked**, `@eslint-react` (o `eslint-plugin-react` clássico não suporta ESLint 10) + `react-hooks` + `react-refresh` no web, `simple-import-sort` para a ordem dos imports e `eslint-config-prettier`. Prettier com a configuração padrão (`.prettierrc.json` vazio)                                                                                                                                                                                                                                                                                                                                                        |
| Infra       | Docker (um Dockerfile por app), docker-compose na raiz, GitHub Actions (CI)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

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

1. `pnpm etl` (em `api/`) **baixa cada parquet com um único GET, um arquivo por vez** (com retry e backoff exponencial), e o DuckDB normaliza, limpa e agrega localmente. Cada arquivo é **apagado depois de processado** (`--keep-cache` mantém). A leitura remota com requisições paralelas por faixa de bytes fez o CloudFront da TLC bloquear o IP, por isso não é usada.
   Os agregados se acumulam em `api/etl/.cache/etl.duckdb` (fora do git). Cada etapa substitui as linhas do mês × serviço que processa, então reexecutar é idempotente.
2. O resultado é um **snapshot agregado versionado no repo**, em `api/data/snapshot/` (CSV gzip, em chunks de **≤ 45 MB** cada, por causa do limite de 100 MB por arquivo do GitHub), com um `manifest.json` contendo o período, contagens de linhas, checksums e a data de geração.
3. O **seed** carrega o snapshot no Postgres (via `COPY`, por desempenho). O seed funciona **offline**, sem baixar nada.
   **Snapshot atual (gerado em 17/11/2026, out/2024 → set/2026): 58,9 MB.** Em detalhe: `agg_daily_zone` 626.634 linhas (21,5 MB), `agg_hourly` 70.027 (3,0 MB), `agg_od_monthly` 230.805 (3,8 MB) e `trip_sample` 1.000.000 (30,5 MB). Passou um pouco dos ~50 MB previstos na decisão 47A, mas o dono do projeto decidiu **versionar assim mesmo**: o seed fica offline e cada arquivo tem menos de 45 MB. Cada atualização mensal acrescenta ~59 MB ao histórico. Parquet com zstd daria 46,6 MB, mas o seed precisaria de um leitor de Parquet. A execução completa do ETL (24 meses × 3 serviços, ~14 GB) leva ~16 min, e a exportação ~16 s.
4. **Atualização mensal: manual.** Rodar `pnpm etl` e commitar o snapshot novo. (Sem GitHub Action agendado.)

### 5.4 Normalização entre serviços

| Métrica base (somável)                     | Yellow / Green                                                                        | FHVHV                                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `trips`                                    | contagem                                                                              | contagem                                                                                                         |
| `passengers`                               | `passenger_count`                                                                     | **não se aplica**                                                                                                |
| `revenue` (**total pago pelo passageiro**) | `total_amount`                                                                        | `base_passenger_fare + tolls + bcf + sales_tax + congestion_surcharge + airport_fee + tips + cbd_congestion_fee` |
| `fare`                                     | `fare_amount`                                                                         | `base_passenger_fare`                                                                                            |
| `tips`                                     | `tip_amount` (obs.: só gorjeta em cartão é registrada)                                | `tips`                                                                                                           |
| `distance_mi`                              | `trip_distance`                                                                       | `trip_miles`                                                                                                     |
| `duration_s`                               | dropoff − pickup                                                                      | `trip_time`                                                                                                      |
| `airport_trips`                            | PU ou DO nas zonas 1 (EWR), 132 (JFK), 138 (LGA)                                      | idem                                                                                                             |
| `card_trips` / `cash_trips`                | `payment_type` 1 / 2 (0 = Flex Fare, preço fixo pelo app: ~31% do Yellow em set/2026) | **não se aplica**                                                                                                |
| `cbd_fee`                                  | `cbd_congestion_fee` (existe a partir de jan/2025)                                    | idem                                                                                                             |
| `wait_s`                                   | **não se aplica**                                                                     | pickup − request                                                                                                 |
| `driver_pay`                               | **não se aplica**                                                                     | `driver_pay`                                                                                                     |
| `shared_trips`                             | **não se aplica**                                                                     | `shared_match_flag = 'Y'`                                                                                        |

Métricas que não existem num serviço aparecem na UI como **"não se aplica"**.

### 5.5 Regras de limpeza (no ETL)

Descartar corridas com: zona de embarque inválida (NULL ou fora de 1–265; 264/265 são mantidas); pickup fora do mês do arquivo; tarifa negativa; **tarifa > US$ 1.000**; distância ≤ 0; duração ≤ 0 ou > 3h; **velocidade implícita > 80 mph**. As duas regras em negrito foram adicionadas na #7, depois de medir set/2026: distâncias absurdas (até 232.644 mi) faziam a velocidade média do Yellow ir de 11,7 para 16,6 mph, e a do Green de 12,3 para 32,6 mph. Também havia uma tarifa de US$ 9.999 numa corrida de 1 minuto. O schema normalizado completo está em `api/etl/README.md`.

### 5.6 Tabelas agregadas (snapshot)

1. **Diário × zona de embarque × serviço × empresa** → todas as métricas base somáveis.
2. **Hora × serviço × empresa** → métricas base (séries horárias e cortes por hora do dia × dia da semana). São ~17,5 mil pontos por série em 24 meses.
3. **Mês × origem → destino × serviço × empresa** → apenas as **top N rotas** por mês (para os arcos do mapa e a tabela de rotas).
4. **Amostra de corridas individuais:** ~**1 milhão** de corridas de **set/2026** (último mês), dos 3 serviços (proporcional ao volume, com piso por serviço). Alimenta os widgets scatter/bubble e a camada de pontos do mapa.
5. **Zonas:** GeoJSON WGS84 simplificado + lookup (zona, distrito, `service_zone`). Gerado por `etl:zones` com o **mapshaper**, que simplifica preservando as fronteiras entre zonas (15% dos vértices; cerca de 500 KB, 263 zonas). Cada feature tem `id` = LocationID e as properties em camelCase (`locationId`, `zone`, `borough`, `boroughId`, `serviceZone`, `centroid`). O `centroid` é um ponto garantidamente dentro do polígono. Detalhes em `api/etl/README.md`.

**A TLC não publica coordenadas** (só os IDs das zonas). Na amostra, cada corrida recebe uma **posição aleatória determinística (com seed fixa) dentro do polígono da sua zona de embarque**. A UI deve **avisar que a posição é aproximada**.

### 5.7 Catálogo de métricas

- **Volume:** corridas, passageiros.
- **Financeiro:** receita total, tarifa média, gorjeta média, % de gorjeta, receita por milha, taxa de congestionamento (CBD) arrecadada.
- **Operação:** distância média, duração média, velocidade média, % de corridas de aeroporto, % cartão × dinheiro (**% cartão = cartão ÷ (cartão + dinheiro)**; Flex Fare, contestação e outros ficam de fora do denominador).
- **FHVHV:** tempo médio de espera, % da tarifa que vai para o motorista, % de corridas compartilhadas.
- **Cortes (dimensões):** serviço, empresa, distrito (borough), zona, hora do dia, dia da semana.

As **métricas derivadas são calculadas a partir das somas** (por exemplo: tarifa média = Σfare / Σtrips; % gorjeta = Σtips / Σfare; velocidade = Σdistance / Σduration). Nunca calcule média de médias. O catálogo (id, rótulo, unidade, fórmula, serviços aplicáveis, direção "maior é melhor/menor é melhor", ícone) mora em `shared`.

### 5.8 Projeção (esperado × real)

- Modelo: **Holt-Winters aditivo com tendência amortecida** (φ entre 0,8 e 1), sazonalidade **semanal** (m = 7), em `api/src/lib/holtWinters.ts`. Os parâmetros α, β, γ e φ minimizam o erro quadrático da previsão um passo à frente, via Nelder-Mead (3 pontos de partida) numa parametrização sigmoide, o que mantém os limites sem restrições explícitas. A inicialização usa as duas primeiras semanas. Séries com menos de 2 semanas caem para o **seasonal naive**. As previsões são truncadas em ≥ 0. Desempenho: ~4 ms por ajuste numa série de ~650 dias.
- Calculada **no seed**, a partir dos dados carregados, e guardada no banco.
- Granularidade: **diária, por serviço × distrito**, só para **métricas somáveis**. Médias e percentuais da projeção são derivados das somas projetadas.
- **Backtest mensal:** para cada mês M, a projeção é feita **só com dados até o fim de M−1** → permite "esperado × real" em qualquer período. O primeiro mês com backtest é **nov/2024** (out/2024 é aquecimento).
- **Projeção futura:** out/2026 → dez/2026 (feita com os dados até set/2026).
- **Implementação (#19, `api/src/seed/projections.ts`):**
  - Roda dentro da transação do seed, depois da carga.
  - Monta séries diárias por serviço × distrito a partir de `trip_daily` ⨝ `zones`, com dias sem corridas valendo 0.
  - Projeta **todas as colunas-base aplicáveis ao serviço** (as outras ficam NULL), então qualquer métrica derivada também tem projeção.
  - Resultado: 16.611 linhas (21 séries; backtest de 699 dias + previsão de 92 dias).
  - Qualidade do backtest de corridas por dia: MAPE de 8,2% (FHVHV), 11,7% (Green) e 13,1% (Yellow); viés no total entre −2,6% e +1%. Feriados não são modelados.

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
- **6 paletas prontas** (Aurora, Sunset, Ocean, Neon, Forest, Mono), cada uma com variante clara e escura.
- **Cores dos gráficos seguem o método de dataviz (validadas por script, nunca "no olho")** (#30):
  - As 8 matizes categóricas são a paleta documentada de dataviz, com um degrau claro e um escuro.
  - **Cada paleta é uma ORDEM diferente dessas 8 matizes** (um "tema"). Ela foi escolhida entre as 160 de 40.320 ordens que passam em todos os testes do validador **nos dois modos**, contra as superfícies do app (`#ffffff` / `#111827`):
    - separação para daltonismo ΔE ≥ 8 entre vizinhos;
    - visão normal ΔE ≥ 15;
    - faixa de luminosidade e croma.
  - Os 3 primeiros slots também passam o teste "todos os pares", o que **limita scatter, bubble e mapa a 3 séries**; acima disso, agrupar em "Outros" ou usar facetas.
  - Ordens:
    - Aurora: verde, violeta, magenta…
    - Sunset: laranja, violeta, aqua…
    - Ocean: azul, verde, magenta…
    - Neon: magenta, verde, azul…
    - Forest: verde, azul, magenta…
    - Mono: a ordem de referência, com interface em cinzas.
  - No tema claro, 3 matizes ficam abaixo de 3:1 sobre o branco. A regra de alívio vale: rótulos/tooltips ou a visualização em tabela.
  - **Status** (bom/atenção/ruim), **sequencial** (azul 100→700) e **divergente** são fixos e não mudam com a paleta. O status aparece sempre com ícone + texto.
- **Exceções às recomendações de dataviz, decididas pelo dono do projeto (17/11/2026):**
  - **Escala divergente vermelho ↔ verde** no mapa (a decisão 45A foi mantida mesmo com o alerta de daltonismo). Para mitigar, ela é **sensível à direção da métrica** (verde = melhorou, vermelho = piorou), o meio é cinza e o valor aparece sempre como texto ±% (legenda "piora / melhora" + tooltip).
  - **Scatter, bubble e pontos no mapa podem ter 4 cores** (colorBy empresa: Uber, Lyft, Yellow, Green), mas **com forma como segundo canal** (`POINT_STYLES`: círculo, quadrado, triângulo, losango…). No mapa (deck.gl), a forma vira um ícone por categoria.
- **Pipeline dos tokens:**
  - `web/src/styles/tokens.ts` é a fonte única.
  - `pnpm --filter @ny-dashboard/web tokens` gera `tokens.generated.css`, com variáveis `--nyd-*` por `[data-theme][data-palette]` no `<html>`. Um teste falha se o arquivo estiver desatualizado.
  - O Tailwind mapeia as cores (`bg-surface`, `text-ink`, `bg-series-1`, `bg-accent-gradient`…) via `@theme inline`.
  - Utilitários: `glass`, `border-gradient`, `glow`, `text-accent-gradient` e `page-backdrop`.
  - Os contrastes são testados: texto ≥ AA em todas as superfícies, texto sobre o gradiente de destaque ≥ 4,5:1 e séries escuras ≥ 3:1.
- **Estilo dos gráficos (#31, `web/src/charts/chartTheme.ts`, arquivo único):**
  - Registra os controllers e escalas do Chart.js usados, o adapter de datas (date-fns, pt-BR) e os plugins **glow** (brilho na cor da série; desligado em traços tracejados e barras) e **crosshair** (linha vertical no hover).
  - `applyChartDefaults` aplica os tokens a `Chart.defaults`, sempre **alterando campos, nunca substituindo objetos**. Substituir `defaults.animation` quebrou o Chart.js com `this._fn is not a function`. As escalas cartesianas compartilham `Chart.defaults.scale` (no singular).
  - Helpers:
    - `areaFill` (gradiente vertical), `comparisonStyle` (tracejado), `projectionStyle` (pontilhado);
    - `stackedBarStyle` (2 px de espaço entre segmentos), `seriesColor` (ordem fixa; acima do 8º slot vira "Outros");
    - `pointStyle` (forma por categoria), `timeScale` (formatos pt-BR) e `largeDataOptions` (acima de 1.000 pontos: sem animação, `parsing: false` e decimação LTTB).
  - `useChartTheme()` acompanha `<html data-theme data-palette>` (via `useThemeAttributes`, com MutationObserver) e reaplica os defaults. A `/_ds` tem uma seção que mostra todos os estilos.
- **Componentes base** (`web/src/components/ui`): Button, IconButton, Card, Modal (foco preso, Escape, devolve o foco), Input, Select (nativo), SegmentedControl (radiogroup), Tabs (WAI-ARIA), Badge, Tooltip, Toast (Zustand), Skeleton e Spinner. A página `/_ds` (só em desenvolvimento; aceita `?theme=&palette=`) mostra todos.
- **Tokens no Tailwind v4 (`@theme`)** como fonte única das cores. Tanto o `chartTheme.ts` (Chart.js) quanto o `mapTheme.ts` (MapLibre/deck.gl) **leem os mesmos tokens** (variáveis CSS), então mudar o tema ou a paleta atualiza gráficos e mapas.
- `web/src/charts/chartTheme.ts` é **o único lugar** com estilo do Chart.js: defaults globais, fontes, grid, tooltips, helpers de gradiente e um plugin de glow.

## 8. Desempenho com muitos dados

- **A API manda todos os pontos** pedidos, sem reduzir no servidor. Quem decide como desenhar é o Chart.js: o plugin de **decimação (LTTB)** fica ligado em gráficos de linha (o que exige `parsing: false`, eixo de tempo/linear e animação desligada em séries grandes).
- **Comportamento esperado e documentado:** um scatter com a amostra de 1 milhão de corridas manda ~12,5 MB de JSON (3,7 MB com gzip; ~5 s na API) e **vai ficar lento ou travar o Chart.js**. Isso é proposital, para demonstrar os limites. O mapa usa deck.gl (GPU), que aguenta esse volume.

## 9. API (visão geral)

| Método  | Rota                                        | Descrição                                                                                      |
| ------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| POST    | `/api/auth/register` · `/login` · `/logout` | autenticação                                                                                   |
| GET     | `/api/auth/me`                              | usuário atual                                                                                  |
| GET/PUT | `/api/dashboard`                            | estado completo (widgets + layouts desktop/mobile)                                             |
| GET/PUT | `/api/preferences`                          | tema e paleta                                                                                  |
| GET     | `/api/meta`                                 | período disponível, serviços, empresas, distritos, catálogo de métricas                        |
| GET     | `/api/zones`                                | GeoJSON das zonas (com cache/ETag)                                                             |
| POST    | `/api/query/timeseries`                     | série temporal (métrica, granularidade, intervalo, filtros, agrupamento, comparação, projeção) |
| POST    | `/api/query/kpi`                            | valor, valor comparado, variação, meta, status                                                 |
| POST    | `/api/query/breakdown`                      | agregação por dimensão (pizza, radar, barras, tabela)                                          |
| POST    | `/api/query/map`                            | valores por zona (com variação), fluxos origem→destino, pontos da amostra                      |
| POST    | `/api/query/trips`                          | pontos da amostra de corridas para scatter/bubble                                              |

Todos os payloads são validados com schemas zod de `shared`. Fluxo MVC: `routes → controllers → services → models`, e a resposta passa por `views` (serializers).

## 10. Testes e qualidade

- **Unidade (Vitest):** `shared`, `api` (services, Holt-Winters, transformações do ETL) e `web` (componentes com Testing Library + jsdom, stores, chartTheme).
- **Configuração:**
  - Cada pacote tem o seu `vitest.config.ts`: `node` em api e shared, `jsdom` no web, com setup em `web/src/test/setup.ts` (matchers do jest-dom).
  - Os testes ficam em `src/**/*.test.ts(x)`, normalmente em `__tests__/`.
  - Scripts `test`, `test:watch` e `test:coverage` (cobertura v8: relatórios text, html e lcov em `coverage/`).
  - O `@testing-library/react` entra junto com o React, na #29.
- **Integração (Vitest + Supertest):** a API contra um **Postgres real**, com um conjunto pequeno de dados de teste.
- **E2E (Playwright):** contra o stack do docker compose. Cobre: login como demo; adicionar, editar, mover, redimensionar e remover widget; persistência entre dois contextos de navegador; independência entre desktop e mobile; tema e paleta.
- **CI (GitHub Actions):** lint, typecheck, testes de unidade e integração (com um service Postgres), build das imagens e E2E.
- **Lint/format:** ESLint + Prettier.

## 11. Infraestrutura

- `docker-compose.yml` na raiz sobe **db** (Postgres, com healthcheck e volume), **api** e **web**.
- **api:** imagem multi-stage. O entrypoint roda `prisma migrate deploy`, depois o **seed com `--if-empty`** (só popula se o banco estiver vazio, idempotente) e por fim sobe o servidor.
- **web:** build estático servido por **nginx**, que repassa `/api` para a api e faz o fallback de SPA.
- **Desenvolvimento local:** `docker compose up -d db` + `pnpm --filter @ny-dashboard/api db:migrate` + `pnpm dev` (api e web com hot reload, fora do Docker). Passo a passo no README.

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
- **Contratos em `shared` (#3):**
  - Filtros de serviço, empresa e distrito aceitam vários valores; uma lista vazia significa "todos". IDs em minúsculas: empresas `yellow`, `green`, `uber`, `lyft`, `other`; distritos `manhattan`, `brooklyn`, `queens`, `bronx`, `staten_island`, `ewr`, `unknown`.
  - O estado do dashboard (`DashboardState`, `version: 1`) guarda também os filtros globais. Tem no máximo 50 widgets, e cada widget aparece exatamente uma vez em cada layout, dentro das colunas daquele breakpoint.
  - Novo tipo de widget `bar_horizontal` (ranking por categoria). `bar` e `stacked_bar` são séries temporais, e `stacked_bar` exige `groupBy`.
  - Avaliação de KPI: em `comparison`, uma variação menor que `neutralBandPct` vira "atenção". Em `target`, atingir a meta é "bom" e ficar até `warningBandPct` abaixo dela é "atenção".
  - As respostas de séries, mapa e amostra usam formato **colunar** (`{ t: [...], v: [...] }`), para reduzir o tamanho do payload.
  - Os timestamps das respostas são **horário de parede de NY sem offset**: `YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm`.
  - Projeção (sobreposta ou como comparação) só para granularidade diária ou maior.
  - Usuário: 3 a 32 caracteres `[a-z0-9._-]`, convertido para minúsculas. Senha: de 8 caracteres a 72 bytes (o bcrypt ignora o que passa disso).
- **Rotas origem → destino (#10):** são guardadas as **500 rotas mais frequentes por mês × serviço × empresa × distrito de embarque** (não um top N global). Os pares do FHVHV são muito dispersos (o top 1.000 global cobre só ~33% das corridas da Uber), e um ranking global apagaria as rotas de distritos pequenos quando o filtro de distrito fosse usado. Isso dá umas 250 mil linhas em 24 meses.
- **Amostra de corridas (#11):** o piso por serviço é **50 mil corridas** (o Green tem só ~44 mil em set/2026 e entra inteiro), e o restante é proporcional (resultado: Yellow ~176 mil, FHVHV ~780 mil). A seleção é determinística, por hash da corrida. As corridas com embarque nas zonas 264/265, que não têm geometria, ficam com coordenadas NULL, e o mapa as ignora.
- **API base (#13):**
  - Logs com **pino** + `pino-http`: JSON em produção, `pino-pretty` em desenvolvimento.
  - Erros: lançar `AppError(status, code, message, details?)` (há helpers em `src/lib/errors.ts`). O `errorHandler` converte os erros no corpo padrão `{ error: { code, message, details } }`:
    - erros do zod → 400 `VALIDATION_ERROR` (com `path`/`message`);
    - JSON inválido → 400 `INVALID_JSON`;
    - erros inesperados → 500 `INTERNAL_ERROR`, sem vazar a mensagem.
  - Validação com o middleware `validate({ body, query, params })`, que guarda os valores validados em `res.locals.validated` (o Express 5 não deixa sobrescrever `req.query`). O controller lê com `validated(res, schemas)`.
  - `app.ts` monta o app sem escutar porta (os testes usam supertest); `server.ts` sobe o servidor.
  - Fora de produção, o `.env` da raiz é carregado com `process.loadEnvFile`.
- **jsdom fixado em 29.1.1:** o 30.x e o 31.x exigem Node ≥ 24.15, e a máquina de desenvolvimento usa 24.14.1. Quando atualizar o Node local, dá para subir o jsdom.
- **Banco (#14):**
  - **Prisma 7**, com o gerador `prisma-client` (saída em `api/src/generated/prisma`, ignorada pelo git e gerada no `postinstall`) e o driver adapter `@prisma/adapter-pg`.
  - A URL do banco vem do `prisma.config.ts`, que carrega o `.env` da raiz fora de produção.
  - **Postgres 18** (`postgres:18-alpine`). O volume fica montado em `/var/lib/postgresql`, que é o caminho novo a partir da versão 18.
  - IDs de usuário e dashboard: UUID v7.
  - `Dashboard.state` é um **JSON** com o `DashboardState` inteiro.
  - `theme`/`palette` são strings, validadas pelo zod na API (sem enum no banco).
  - As tabelas de dados espelham o snapshot (`trip_daily`, `trip_hourly`, `od_flow_monthly`, `trip_sample`, `zones`).
  - `projection` usa formato **largo**: uma linha por dia × serviço × distrito, com as mesmas colunas de métricas somáveis. A projeção **não separa por empresa**.
  - Scripts: `db:migrate`, `db:deploy`, `db:generate` e `db:studio`.
- **Catálogo de métricas (#15, `shared/src/catalog`):**
  - Cada métrica é `escala × Σnumerador ÷ Σdenominador` sobre as 16 colunas-base (`BASE_COLUMNS`). API e front usam o mesmo `computeMetric`.
  - Um teste garante que `BASE_COLUMNS` bate com as colunas do ETL e com as do Prisma.
  - **Uma métrica só é calculada sobre os serviços onde existe** (`applicableServices`). Exemplo: % compartilhadas com Yellow + FHVHV selecionados usa só as corridas do FHVHV. Se nenhum serviço selecionado tiver a métrica, o resultado é "não se aplica".
  - **Direção padrão dos KPIs** na perspectiva do negócio/operação:
    - menor é melhor: duração média, espera média, % dinheiro;
    - maior é melhor: todas as outras.
    - Cada KPI pode inverter a direção.
  - Dia da semana segue a ISO (1 = segunda … 7 = domingo).
  - Rótulos de serviço: "Yellow Taxi", "Green Taxi" e "Apps (Uber/Lyft)".
  - Valores ausentes aparecem como "—".
  - Os ícones são nomes do lucide (kebab-case).
- **Dashboard padrão (#16, `shared/src/defaults`):**
  - Período de set/2026 × ago/2026, com 14 widgets:
    - 6 KPIs (corridas, receita com meta de US$ 900 mi, tarifa média, % gorjeta, espera no app com meta de 5 min, velocidade);
    - corridas reais × projeção;
    - participação por empresa;
    - receita do mês atual × anterior;
    - radar por hora do dia;
    - mapa de zonas;
    - tabela das zonas com mais corridas;
    - mapa de rotas;
    - scatter da amostra **filtrado a embarques no JFK**, para a primeira tela não carregar 1 milhão de pontos.
  - Layouts: desktop com KPIs de 2 colunas × 3 linhas e gráficos de 4 a 8 colunas; mobile com KPIs lado a lado e o resto em largura total.
  - `DATA_COVERAGE` concentra o período do snapshot. Um teste da api compara com o `manifest.json`.
- **Seed (#18, `api/src/seed`, `pnpm --filter @ny-dashboard/api db:seed [--if-empty] [--force]`):**
  - Valida o `manifest.json` e o sha256 de cada arquivo.
  - Carrega `zones` (lookup + centróide) e as tabelas do snapshot via **`COPY ... FROM STDIN`** (`pg` + `pg-copy-streams`, lendo o gzip em stream), numa **única transação** que primeiro faz `TRUNCATE` nas tabelas de dados. Confere a contagem de linhas contra o manifest e roda `ANALYZE` no fim.
  - **Idempotência:** `seed_meta.snapshot_sha256` guarda o checksum do manifest carregado. Com `--if-empty` (padrão), a carga só é pulada se o banco já tiver **este mesmo snapshot**; um snapshot diferente (atualização mensal) é recarregado. `--force` sempre recarrega.
  - Usuários, preferências e dashboards nunca são apagados. O usuário `demo` só é criado se não existir, com preferências padrão e o dashboard padrão.
  - Tempo: **~80 s** no Postgres local, sendo ~35 s de COPY de ~1,9 milhão de linhas e ~44 s de projeções.
  - Senhas com **`bcryptjs`** (bcrypt em JS puro, custo 10), que evita build nativo no Docker e no CI.
  - `findApiRoot()` localiza a pasta `api/` tanto em `src/` (tsx) quanto em `dist/` (bundle de produção).
- **Autenticação (#20):**
  - JWT HS256 com **`jose`**, em cookie `nyd_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`). `Secure` depende de `COOKIE_SECURE` (padrão `false`, porque a demo roda em `http://localhost`).
  - `JWT_SECRET` precisa ter ≥ 16 caracteres, e o valor do `.env.example` é recusado em produção. `JWT_EXPIRES_IN` vale 7 dias por padrão.
  - O login responde 401 `INVALID_CREDENTIALS` sem revelar se o usuário existe: quando ele não existe, compara mesmo assim com um hash fictício, para o tempo de resposta ser parecido.
  - Usuário repetido → 409 `CONFLICT`.
  - O cadastro cria o usuário com as preferências padrão e o dashboard padrão.
  - **Injeção de dependências:** os services dependem de interfaces de repositório (`UserRepository` etc.). `server.ts` liga a implementação Prisma, e os testes de unidade usam a implementação em memória de `__tests__/helpers.ts` (`createTestApp`).
- **Dashboard e preferências (#21):**
  - `GET`/`PUT /api/dashboard` com o corpo `{ state }` e resposta `{ state, updatedAt }`.
  - `GET`/`PUT /api/preferences` com o corpo `Preferences` e resposta `{ preferences, updatedAt }`.
  - Os contratos ficam em `shared` (`saveDashboardRequestSchema`, `dashboardResponseSchema`, `preferencesResponseSchema`).
  - Todas as rotas exigem sessão e só acessam os dados do próprio usuário.
  - Se o estado salvo ficar inválido (mudança futura de schema), o `GET` devolve o dashboard padrão e registra um aviso no log. Na falta de registro, o padrão é criado.
- **Metadados (#22):**
  - `GET /api/meta` e `GET /api/zones` são **públicos**, porque visitantes sem conta também usam o dashboard.
  - O `/api/meta` lê a cobertura real do banco (período, início do backtest, fim da projeção, mês da amostra, pares serviço/empresa presentes) e devolve também os rótulos, as 265 zonas e o catálogo de métricas. Ele é calculado uma vez e fica em memória (os dados só mudam com o seed). Antes do seed, responde 503 `NO_DATA`.
  - O `/api/zones` serve o GeoJSON (~500 KB) com `ETag` (sha1) e `Cache-Control: max-age=86400, must-revalidate`, e responde 304 quando o `If-None-Match` bate. A compressão gzip fica com o nginx em produção.
- **Série temporal (#23, `POST /api/query/timeseries`, pública):**
  - Dia, semana (ISO, a partir da segunda) e mês saem de `trip_daily`. Hora sai de `trip_hourly`, que **não tem zona**: filtro ou agrupamento por distrito/zona com granularidade horária → 400.
  - A métrica só é calculada sobre os serviços onde existe. Se nenhum serviço selecionado tiver a métrica, `notApplicable: true`.
  - **Linha do tempo completa:** um bucket sem dados em nenhum grupo vale `null` (fora da cobertura). Se faltar só para um grupo, vale 0 nas somas e `null` nas razões.
  - **Período anterior:** meses inteiros comparam com os meses inteiros anteriores (set → ago, de 1 a 31); outros intervalos usam o mesmo número de dias imediatamente antes.
  - **Ano anterior:** mesmas datas, 12 meses antes.
  - Os pontos da comparação mantêm os timestamps originais, e o front alinha pelo deslocamento. `totals` traz o atual, o comparado e a variação %.
  - **Projeção** (sobreposta ou como comparação): vem da tabela `projection`, que existe só por serviço × distrito. Com filtro de empresa ou zona, não vem projeção e é incluído um aviso em `notices`. Com `groupBy: company`, a projeção vem no total, também com aviso.
  - A resposta inclui `unit` e `notices`.
  - O SQL é montado com identificadores de whitelist e valores parametrizados (`models/queryRepository.ts`). Nos testes de unidade, `__tests__/memoryQueries.ts` replica a semântica em memória.
  - Desempenho no banco local: mês × mês anterior com projeção em ~0,16 s; 24 meses por hora para 4 empresas (70 mil pontos, 2 MB) em ~0,5 s.
- **KPI (#24, `POST /api/query/kpi`, pública):**
  - Devolve valor, comparação (`range`, `value`, `deltaAbs`, `deltaPct`), meta, status e sparkline.
  - A sparkline é diária em períodos de até 124 dias e semanal acima disso.
  - **Status** (`api/src/lib/kpiStatus.ts`):
    - comparação: uma melhora, já com o sinal da direção, ≥ `neutralBandPct` é **bom**; uma piora desse tamanho é **ruim**; o que fica no meio é **atenção** (estável);
    - meta: atingir é **bom**; errar por até `warningBandPct` é **atenção**; mais que isso é **ruim**;
    - com as duas regras, vale **a pior**. Sem regras ou sem dados, o status é **neutro**.
  - A comparação com projeção fica indisponível com filtro de empresa ou zona (`comparison: null`).
  - Com os dados reais, o dashboard padrão mostra 2 KPIs bons, 2 em atenção e 2 ruins em set/2026.
- **Breakdown (#25, `POST /api/query/breakdown`, pública):**
  - Fonte escolhida pelas dimensões:
    - `route` → `od_flow_monthly`, agregado por **meses inteiros** (um aviso informa quando o período foi ampliado);
    - `hour_of_day` → `trip_hourly` (sem distrito/zona → 400);
    - as demais → `trip_daily` (dia da semana ISO).
  - Rotas só têm corridas, receita, distância e duração. As outras métricas viram "não se aplica", com aviso.
  - `sortBy: "value" | "key"` (o contrato ganhou o campo): `key` ordena numericamente quando a chave é número, como as horas 0 → 23.
  - Top N + **"Outros"**, com a métrica recalculada a partir das somas das linhas cortadas.
  - Comparação linha a linha por chave, com período anterior, ano anterior ou intervalo custom. Contra a projeção, só com uma dimensão `service` ou `borough` e sem filtro de empresa ou zona.
  - Rótulos em pt-BR. Zonas e rotas usam os nomes da tabela `zones`, carregados uma vez, por exemplo "JFK Airport → Midtown Center".
- **Mapa (#26, `POST /api/query/map`, pública):**
  - `zones`: valor por zona de embarque, reaproveitando o breakdown por zona. Traz a variação % contra o período comparado; contra a projeção não há comparação, porque ela não existe por zona.
  - `flows`: rotas principais, reaproveitando o breakdown por rota. Ficam de fora as rotas com as zonas 264/265, que não têm geometria. A resposta traz só os IDs das zonas: **o front pega os centróides do GeoJSON** (`properties.centroid`).
  - `points`: corridas da amostra com posição, em formato colunar, com a categoria (serviço ou empresa) codificada como índice em `categories`. O SQL agrega tudo em `array_agg`, então ~1 milhão de pontos chegam numa única linha.
  - Medido no local: 1 milhão de pontos = 20,8 MB de JSON em ~3 s (≈5,3 MB com o gzip do nginx); só os pontos do JFK = 435 KB em 0,09 s; zonas = 9 KB em 0,19 s.
- **Corridas da amostra (#27, `POST /api/query/trips`, pública):**
  - Eixos `x`/`y` (e `r` no bubble) escolhidos entre os campos da amostra (`TRIP_FIELDS_CATALOG` no `shared`: rótulo, unidade e coluna).
  - O contrato ganhou `hours: { from, to }`, a faixa de horário do embarque; `from > to` cruza a meia-noite.
  - Ficam de fora os serviços que não têm algum dos campos pedidos (ex.: espera só existe no FHVHV).
  - **A API manda todos os pontos**, em formato colunar.
  - **gzip** na API inteira (middleware `compression`).
  - Medido no local:
    - scatter de 1 milhão de pontos: **12,5 MB (3,7 MB com gzip) em ~4,5–5 s**;
    - bubble de 1 milhão: 4,5 MB com gzip em ~6,3 s;
    - scatter padrão (JFK): 87 KB em 0,22 s.
- **Testes de integração (#28, `pnpm --filter @ny-dashboard/api test:integration`):**
  - Rodam com Postgres real, num banco separado: `TEST_DATABASE_URL`, ou o `DATABASE_URL` com o sufixo `_test`. O nome **precisa terminar em `_test`**, porque o setup faz `DROP DATABASE ... WITH (FORCE)` e recria o banco a cada execução.
  - O `globalSetup` aplica as migrations (`prisma migrate deploy`) e carrega um **mini-snapshot determinístico** (ago–set/2026, gerado em `__integration__/snapshotFixture.ts`) **pelo seed de verdade**: COPY, checksums, projeções e usuário demo.
  - Os testes usam `createDependencies` (`src/container.ts`), a mesma ligação de produção do `server.ts`.
  - Os arquivos `*.int.test.ts` ficam fora do `pnpm test`.
  - Cobrem auth, dashboard, preferências, meta/zones e todas as queries (incluindo comparação, projeção e granularidade horária), em ~5 s.
  - O primeiro teste achou um bug: o `/api/meta` lia as empresas de `trip_hourly`; agora lê de `trip_daily`.
- **Web base (#29):**
  - Vite 8 + React 19 + Tailwind v4 (`@tailwindcss/vite`).
  - **React Router 8 em modo biblioteca** (`createBrowserRouter`, SPA), com as rotas `/`, `/login`, `/cadastro` e 404.
  - TanStack Query (`staleTime` de 5 min e sem refetch no foco por padrão; dashboard e preferências ligam o refetch no foco) e Zustand.
  - Fonte **Inter auto-hospedada** via `@fontsource-variable/inter`, sem requisição externa.
  - O dev server roda na :5173 e repassa `/api` para a API (`VITE_API_PROXY`, padrão `http://localhost:3000`). `pnpm dev` na raiz sobe API e web juntos.
  - Os testes de componentes usam Testing Library + `user-event`, com rotas via `createMemoryRouter`.

## 14. Roteiro

O backlog completo está nas [issues do GitHub](https://github.com/BrunoNC22/ny-dashboard/issues), em 6 milestones. Cada issue lista as issues de que depende.

| Milestone        | Issues  | Conteúdo                                                                                                   |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------- |
| M0 — Fundação    | #1–#5   | monorepo, lint, shared, vitest, CI básico                                                                  |
| M1 — Dados (ETL) | #6–#12  | zonas, ETL DuckDB, agregados, amostra, snapshot                                                            |
| M2 — API         | #13–#28 | Express MVC, Prisma, catálogo, dashboard padrão, Holt-Winters, seed, auth, endpoints, integração           |
| M3 — Web base    | #29–#39 | bootstrap, design system, chartTheme, mapTheme, client, auth UI, store, grid, shell, filtros, preferências |
| M4 — Widgets     | #40–#49 | infra de widgets, galeria, editor, gráficos, KPI, tabela, mapa                                             |
| M5 — Entrega     | #50–#55 | Dockerfiles, compose, E2E, CI completo, README                                                             |

As trilhas M1 (dados) e M3 (web base) podem andar em paralelo depois do M0.

## 15. Histórico de decisões

| Data       | Decisão                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17 | Snapshot (#12): 58,9 MB versionado no repo mesmo acima dos ~50 MB previstos (decisão do dono). Cache de parquets apagado ao fim da #12; `etl.duckdb` mantido localmente para atualizações mensais.                                                            |
| 2026-11-17 | Projeções (#19): backtest mensal e previsão até dez/2026 para todas as colunas-base aplicáveis, por serviço × distrito.                                                                                                                                       |
| 2026-11-17 | Seed (#18): COPY em transação, idempotente pelo checksum do snapshot; bcryptjs em vez de bcrypt nativo.                                                                                                                                                       |
| 2026-11-17 | Banco (#14): Prisma 7 + adapter pg, Postgres 18, estado do dashboard em JSON, projeção em formato largo por serviço × distrito.                                                                                                                               |
| 2026-11-17 | Design system (#30): as paletas são ordens validadas das 8 matizes documentadas; tokens em TS geram o CSS; lucide-react fixado em 1.73.0 (a 1.74.0 tinha 1 h).                                                                                                |
| 2026-11-17 | API (#13): Express 5 + pino; padrão de erros e de validação descritos na §13.                                                                                                                                                                                 |
| 2026-11-17 | ETL (#8): agregados acumulados em `etl.duckdb`. Durante as #8 a #12, os parquets dos 24 meses (~14 GB) ficam em cache (`--keep-cache`) para reprocessar sem baixar de novo. **O cache deve ser apagado ao fim da #12.**                                       |
| 2026-11-17 | ETL (#7): download sequencial com retry e remoção depois do processamento (sem leitura remota); novas regras de limpeza (tarifa > US$ 1.000, velocidade > 80 mph); % cartão = cartão ÷ (cartão + dinheiro).                                                   |
| 2026-11-17 | Zonas: mapshaper (0.7.x) em vez de DuckDB spatial para gerar o GeoJSON (#6), porque simplifica preservando a topologia.                                                                                                                                       |
| 2026-11-17 | Contratos zod do `shared` (#3), com as decisões derivadas listadas na §13.                                                                                                                                                                                    |
| 2026-11-17 | Lint: ESLint 10 + `@eslint-react` (em vez do `eslint-plugin-react`) e `simple-import-sort` (em vez do `import-x`). `typescript-eslint` fixado em 8.72.2 por causa do `minimumReleaseAge`.                                                                     |
| 2026-11-16 | `shared` exporta o TS direto (sem build); a api usa tsx em dev e tsup em produção; TypeScript fixado em 6.0.x por compatibilidade com o typescript-eslint.                                                                                                    |
| 2026-11-16 | Definição inicial completa (seções 1 a 12), feita com o dono do projeto antes de escrever qualquer código. Fonte de dados escolhida: NYC TLC (as alternativas avaliadas foram Olist, UCI Online Retail II, Contoso, BCB/Focus, ONS, OWID e dados sintéticos). |
