import { type DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";

/** Converts BigInt values returned by DuckDB into numbers (counts fit in 2^53). */
const toPlain = (value: unknown): unknown =>
  typeof value === "bigint" ? Number(value) : value;

/** Thin wrapper over a DuckDB connection. */
export class Duck {
  private constructor(
    private readonly instance: DuckDBInstance,
    private readonly connection: DuckDBConnection,
  ) {}

  static async open(path = ":memory:"): Promise<Duck> {
    const instance = await DuckDBInstance.create(path);
    return new Duck(instance, await instance.connect());
  }

  async run(sql: string): Promise<void> {
    await this.connection.run(sql);
  }

  async all<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
    const reader = await this.connection.runAndReadAll(sql);
    return reader
      .getRowObjectsJS()
      .map(
        (row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [k, toPlain(v)]),
          ) as T,
      );
  }

  /** Column names of a parquet file (reads only the footer). */
  async parquetColumns(path: string): Promise<Set<string>> {
    const rows = await this.all<{ column_name: string }>(
      `DESCRIBE SELECT * FROM read_parquet(${sqlString(path)})`,
    );
    return new Set(rows.map((row) => row.column_name));
  }

  close(): void {
    this.connection.closeSync();
    this.instance.closeSync();
  }
}

/** SQL string literal. */
export const sqlString = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`;
