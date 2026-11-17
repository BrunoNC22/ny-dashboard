import type { Db } from "../lib/prisma";

export interface DataCoverage {
  /** YYYY-MM-DD, null when there is no data. */
  firstDate: string | null;
  lastDate: string | null;
  backtestFrom: string | null;
  projectionUntil: string | null;
  /** YYYY-MM of the trip sample. */
  sampleMonth: string | null;
  /** Service/company pairs present in the data. */
  companies: { service: string; company: string }[];
}

export interface ZoneRow {
  id: number;
  name: string;
  borough: string;
}

/** Read-only access to the trip data loaded by the seed. */
export interface DataRepository {
  getCoverage(): Promise<DataCoverage>;
  listZones(): Promise<ZoneRow[]>;
}

export const createPrismaDataRepository = (prisma: Db): DataRepository => ({
  async getCoverage() {
    const [days] = await prisma.$queryRaw<
      { first: string | null; last: string | null }[]
    >`
      SELECT min(date)::text AS first, max(date)::text AS last FROM trip_daily`;
    const [projection] = await prisma.$queryRaw<
      { backtest_from: string | null; until: string | null }[]
    >`
      SELECT min(date) FILTER (WHERE kind = 'backtest')::text AS backtest_from,
             max(date)::text AS until
      FROM projection`;
    const [sample] = await prisma.$queryRaw<{ month: string | null }[]>`
      SELECT to_char(min(pickup_at), 'YYYY-MM') AS month FROM trip_sample`;
    const companies = await prisma.$queryRaw<
      { service: string; company: string }[]
    >`
      SELECT DISTINCT service, company FROM trip_hourly ORDER BY service, company`;
    return {
      firstDate: days?.first ?? null,
      lastDate: days?.last ?? null,
      backtestFrom: projection?.backtest_from ?? null,
      projectionUntil: projection?.until ?? null,
      sampleMonth: sample?.month ?? null,
      companies,
    };
  },
  listZones: () =>
    prisma.zone.findMany({
      select: { id: true, name: true, borough: true },
      orderBy: { id: "asc" },
    }),
});
