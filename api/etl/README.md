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
