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
