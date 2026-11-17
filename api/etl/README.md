# ETL

Scripts que baixam os dados oficiais da NYC TLC e geram os arquivos versionados em `api/data/`, que o seed carrega offline. Visão geral e decisões: [CLAUDE.md §5](../../CLAUDE.md).

Os downloads ficam em cache em `api/etl/.cache/` (ignorado pelo git). Para baixar de novo, use `--refresh`.

## Zonas (`etl:zones`)

```sh
pnpm --filter @ny-dashboard/api etl:zones [--refresh]
```

|            |                                                                                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entrada    | `taxi_zones.zip` (shapefile, EPSG:2263) e `taxi_zone_lookup.csv`, de `https://d37ci6vzurychx.cloudfront.net/misc/`                                                                                                         |
| Saída      | `api/data/zones/taxi_zones.geojson` e uma cópia de `taxi_zone_lookup.csv`                                                                                                                                                  |
| Ferramenta | [mapshaper](https://github.com/mbloch/mapshaper): reprojeta para WGS84 e simplifica preservando as fronteiras compartilhadas entre zonas (15% dos vértices, ponderado, `keep-shapes`). Precisão de 5 casas decimais (~1 m) |

Cada feature tem `id` = `LocationID`, e as `properties` são:

| Campo         | Exemplo                 | Observação                                                                              |
| ------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| `locationId`  | `132`                   | ID da zona TLC (1–263)                                                                  |
| `zone`        | `"JFK Airport"`         | nome oficial (o lookup é a fonte da verdade)                                            |
| `borough`     | `"Queens"`              | nome TLC do distrito                                                                    |
| `boroughId`   | `"queens"`              | ID do distrito no `shared`                                                              |
| `serviceZone` | `"Airports"`            | `Yellow Zone`, `Boro Zone`, `Airports` ou `EWR`                                         |
| `centroid`    | `[-73.78598, 40.64796]` | ponto garantidamente **dentro** do polígono (`-points inner`), usado por bolhas e arcos |

O script falha se:

- alguma zona do lookup (exceto 264 "Unknown" e 265 "Outside of NYC", que não têm geometria) ficar sem polígono;
- houver geometria repetida;
- alguma coordenada cair fora de NYC (sinal de reprojeção errada);
- o arquivo passar de 1 MB.

Divergências de nome entre o shapefile e o lookup são só avisadas.

## Corridas (`etl`)

```sh
pnpm --filter @ny-dashboard/api etl [--from 2024-10] [--to 2026-09] \
  [--services yellow,green,fhvhv] [--keep-cache] [--refresh]
```

O ETL processa cada mês × serviço em sequência:

1. **Download:** baixa `{service}_tripdata_{YYYY-MM}.parquet` de `https://d37ci6vzurychx.cloudfront.net/trip-data/`.
   - É **um único GET por arquivo, um arquivo de cada vez**. A leitura remota do DuckDB (muitas requisições paralelas por faixa de bytes) fez o CloudFront da TLC **bloquear o IP** temporariamente ("403 Request blocked").
   - Em caso de erro, tenta de novo com backoff exponencial (30 s, 1, 2, 4 e 8 min). HTTP 404 não é repetido.
   - Cada arquivo é **apagado depois de processado** (no máximo ~600 MB em disco por vez), a menos que se use `--keep-cache`.
2. **Normalização e limpeza:** o DuckDB cria duas views:
   - `normalized`: todas as linhas + `discard_reason`;
   - `trips`: só as linhas mantidas, nas colunas abaixo.
3. **Etapas de agregação** (#8–#11) leem a view `trips`.
4. **Relatório:** as contagens de linhas lidas, mantidas e descartadas por motivo vão para o console e para `api/etl/.cache/etl-report.json`.

### Diferenças entre os schemas de origem

| Coluna               | Observação                                              |
| -------------------- | ------------------------------------------------------- |
| `cbd_congestion_fee` | só existe a partir de **jan/2025** (antes disso vale 0) |
| `airport_fee`        | Yellow (`Airport_fee`) e FHVHV; o Green não tem         |
| `request_source`     | nova em 2026 no Yellow e no Green; não é usada          |

### Schema normalizado (view `trips`)

| Coluna                     | Tipo      | Yellow / Green                                                                       | FHVHV                                                                                                                                       |
| -------------------------- | --------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `service`                  | VARCHAR   | `yellow` / `green`                                                                   | `fhvhv`                                                                                                                                     |
| `company`                  | VARCHAR   | igual ao serviço                                                                     | `HV0003` → `uber`, `HV0005` → `lyft`, outros → `other`                                                                                      |
| `pickup_at`, `dropoff_at`  | TIMESTAMP | `tpep_*` / `lpep_*` (horário de NY, sem fuso)                                        | `pickup_datetime`, `dropoff_datetime`                                                                                                       |
| `pu_zone_id`, `do_zone_id` | INTEGER   | `PULocationID`, `DOLocationID`                                                       | idem                                                                                                                                        |
| `passengers`               | DOUBLE    | `passenger_count` (0 → NULL)                                                         | NULL (não se aplica)                                                                                                                        |
| `revenue`                  | DOUBLE    | `total_amount`                                                                       | soma de `base_passenger_fare`, `tolls`, `bcf`, `sales_tax`, `congestion_surcharge`, `airport_fee`, `tips` e `cbd_congestion_fee` (NULL → 0) |
| `fare`                     | DOUBLE    | `fare_amount`                                                                        | `base_passenger_fare`                                                                                                                       |
| `tips`                     | DOUBLE    | `tip_amount`                                                                         | `tips`                                                                                                                                      |
| `distance_mi`              | DOUBLE    | `trip_distance`                                                                      | `trip_miles`                                                                                                                                |
| `duration_s`               | DOUBLE    | dropoff − pickup                                                                     | `trip_time`                                                                                                                                 |
| `is_airport`               | BOOLEAN   | embarque ou desembarque em 1 (EWR), 132 (JFK) ou 138 (LGA)                           | idem                                                                                                                                        |
| `payment`                  | VARCHAR   | `payment_type` 1 → `card`, 2 → `cash`, 0 → `flex` (Flex Fare), demais/NULL → `other` | NULL                                                                                                                                        |
| `cbd_fee`                  | DOUBLE    | `cbd_congestion_fee` (0 antes de 2025)                                               | idem                                                                                                                                        |
| `wait_s`                   | DOUBLE    | NULL                                                                                 | pickup − request (NULL se o request faltar ou vier depois do pickup)                                                                        |
| `driver_pay`               | DOUBLE    | NULL                                                                                 | `driver_pay`                                                                                                                                |
| `is_shared`                | BOOLEAN   | NULL                                                                                 | `shared_match_flag = 'Y'`                                                                                                                   |

### Regras de limpeza (`discard_reason`, avaliadas em ordem)

| Motivo                  | Regra                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid_pickup_zone`   | zona de embarque NULL ou fora de 1–265. As zonas 264 e 265 ("Unknown", "Outside of NYC") **são mantidas**                                     |
| `outside_month`         | embarque fora do mês do arquivo                                                                                                               |
| `negative_fare`         | tarifa NULL ou negativa                                                                                                                       |
| `fare_over_limit`       | tarifa > US$ 1.000                                                                                                                            |
| `non_positive_distance` | distância NULL ou ≤ 0                                                                                                                         |
| `invalid_duration`      | duração ≤ 0 ou > 3 h                                                                                                                          |
| `speed_over_limit`      | velocidade implícita > 80 mph. Pega leituras de distância quebradas (até 232.644 mi em set/2026) sem cortar viagens longas legítimas do FHVHV |

## Armazenamento intermediário (`api/etl/.cache/etl.duckdb`)

Os agregados se acumulam num banco DuckDB persistente, fora do git. Cada etapa **substitui as linhas do mês × serviço** que processa, dentro de uma transação. Por isso reexecutar um mês, ou uma faixa de meses, não duplica dados e não mexe nos outros meses. O snapshot (#12) é exportado desse banco.

| Tabela           | Conteúdo                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `etl_meta`       | versão do schema (se mudar, as tabelas são recriadas e precisam ser preenchidas de novo) |
| `etl_sources`    | contagens lidas, mantidas e descartadas por motivo, para cada mês × serviço              |
| `agg_daily_zone` | agregado diário (abaixo)                                                                 |

### `agg_daily_zone`: dia × zona de embarque × serviço × empresa

Só guarda **somas e contagens**. As métricas derivadas (médias e percentuais) são calculadas a partir delas na API. Colunas que não se aplicam a um serviço ficam NULL.

| Coluna                                                            | Conteúdo                                                                             | NULL em      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------ |
| `date`                                                            | data do embarque (horário de NY)                                                     | —            |
| `service`, `company`, `pu_zone_id`                                | chaves                                                                               | —            |
| `trips`                                                           | corridas                                                                             | —            |
| `passengers`, `passenger_trips`                                   | soma de passageiros e quantas corridas informaram passageiros (denominador da média) | FHVHV        |
| `revenue`, `fare`, `tips`, `distance_mi`, `duration_s`, `cbd_fee` | somas                                                                                | —            |
| `airport_trips`                                                   | corridas com embarque ou desembarque em EWR/JFK/LGA                                  | —            |
| `card_trips`, `cash_trips`                                        | corridas pagas com cartão / dinheiro                                                 | FHVHV        |
| `wait_s`, `wait_trips`                                            | soma do tempo de espera e quantas corridas têm esse tempo                            | Yellow/Green |
| `driver_pay`                                                      | soma do pagamento ao motorista                                                       | Yellow/Green |
| `shared_trips`                                                    | corridas compartilhadas                                                              | Yellow/Green |

### `agg_hourly`: hora × serviço × empresa

`hour` é a hora cheia do embarque no horário de NY (`date_trunc('hour', pickup_at)`). As colunas de métricas são as mesmas do `agg_daily_zone` (definidas em `etl/lib/metrics.ts`). Os testes garantem que a soma das horas de um dia bate com o agregado diário em todas as métricas.

### `agg_od_monthly`: rotas mês × serviço × empresa × distrito de embarque

Guarda as **500 rotas mais frequentes** (`OD_TOP_N`, em `etl/lib/sources.ts`) de cada grupo mês × serviço × empresa × distrito de embarque. As colunas são `trips`, `revenue`, `distance_mi` e `duration_s`. Corridas com zona de desembarque inválida são ignoradas.

**Por que um ranking por distrito:** os pares origem → destino do FHVHV são muito dispersos. Em nov/2024, a Uber teve ~59 mil pares distintos, e o top 1.000 global cobria só 33% das corridas (no Yellow, cobria 69%). Com um ranking global, as rotas de distritos pequenos (Staten Island, Bronx) sumiriam quando o dashboard filtrasse por distrito.

### `trip_sample`: amostra de ~1 milhão de corridas de set/2026

As configurações ficam em `SAMPLE`, em `etl/lib/sources.ts`.

1. **Candidatos (`run`):** no mês da amostra, cada serviço guarda até 1 milhão de corridas mantidas, **ordenadas por um hash determinístico** da corrida (`hash(...)` do DuckDB com o sufixo fixo `ny-dashboard-sample-v1`). Pegar as primeiras N dessa ordem dá uma amostra uniforme e reprodutível, que não depende do paralelismo.
2. **Cotas (`finalize`):** depois de processar todos os serviços, as cotas por serviço são calculadas a partir das contagens em `etl_sources`. Cada serviço recebe primeiro um **piso de 50 mil** (ou todas as suas corridas, se tiver menos; o Green tem ~44 mil). O restante é dividido proporcionalmente. Em set/2026 isso dá: Green ~44 mil, Yellow ~176 mil e FHVHV ~780 mil.
3. **Posição aproximada:** a TLC não publica coordenadas. Cada corrida recebe um **ponto aleatório dentro do polígono da zona de embarque**, por amostragem por rejeição na bounding box. O gerador (mulberry32) usa como semente os 32 bits baixos do hash da corrida, então a posição é sempre a mesma. Se a zona for estreita demais e não aceitar ponto depois de 1.000 tentativas, usa-se o `centroid` da zona. As zonas sem geometria (264/265) ficam com `lon`/`lat` NULL.

Colunas: `sample_id` (1..N), `service`, `company`, `pickup_at`, `pu_zone_id`, `do_zone_id`, `distance_mi`, `duration_s`, `fare`, `tips`, `revenue`, `wait_s`, `lon` e `lat`.

A reprodutibilidade depende da versão do DuckDB (a função `hash`), que está fixada no `package.json`.

## Snapshot (`etl:snapshot`)

```sh
pnpm --filter @ny-dashboard/api etl:snapshot [--from YYYY-MM] [--to YYYY-MM]
```

Exporta o armazenamento (`etl.duckdb`) para `api/data/snapshot/`, o diretório **versionado no git** que o seed carrega offline. Por padrão, o período são os **24 meses mais recentes** do armazenamento. O comando falha se faltar algum mês do período.

- Cada tabela (`agg_daily_zone`, `agg_hourly`, `agg_od_monthly`, `trip_sample`) vira CSV com cabeçalho e gzip, no formato `{tabela}.{000}.csv.gz`.
- Se um arquivo passar de **45 MB**, a tabela é dividida em chunks de ~35 MB (o limite do GitHub é 100 MB por arquivo).
- As linhas saem em ordem determinística, e os valores são arredondados (dinheiro e milhas com 2 casas, segundos inteiros, lon/lat com 5 casas). Assim, os mesmos dados geram os mesmos arquivos (mesmo `sha256`).
- O `manifest.json` traz:
  - `formatVersion`, `generatedAt`, `period` e `sampleMonth`;
  - as contagens por mês × serviço (`sources`);
  - por tabela: colunas e tipos, número de linhas e os arquivos com `bytes` e `sha256`;
  - `totalBytes`.

## Atualização mensal (manual)

A TLC publica cada mês com ~2 meses de atraso. Para incluir um mês novo (por exemplo, out/2026):

```sh
cd api
pnpm etl --from 2026-10 --to 2026-10   # baixa e processa só o mês novo; a amostra passa a ser deste mês
pnpm etl:snapshot                      # exporta os 24 meses mais recentes (nov/2024 → out/2026)
git add data/snapshot && git commit -m "data: add 2026-10 trip records"
```

Isso depende do `etl.duckdb` local, que já tem os meses anteriores. Num clone novo, sem esse arquivo, rode o período completo: `pnpm etl --from 2024-11 --to 2026-10`, e depois `pnpm etl:snapshot`.

Depois, atualize o CLAUDE.md (período dos dados) e, se precisar, os textos da interface que citam o período.
