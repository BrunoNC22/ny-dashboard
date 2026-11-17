/**
 * Date helpers moved to `@ny-dashboard/shared` (#44) so the web computes the same compared
 * periods as the API. Re-exported here to keep the API imports stable.
 */
export {
  addDays,
  addMonths,
  bucketsOf,
  comparisonRange,
  dateRange,
  dayBucket,
  daysBetween,
  previousPeriod,
  previousYear,
  weekStart,
  wholeMonths,
} from "@ny-dashboard/shared";
