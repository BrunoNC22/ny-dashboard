import { pino } from "pino";

/** Logger that discards everything (keeps test output clean). */
export const silentLogger = pino({ level: "silent" });
