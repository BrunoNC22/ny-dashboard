/** Response body of `GET /api/health`. */
export const healthView = (uptimeSeconds: number) => ({
  status: "ok" as const,
  uptimeSeconds: Math.round(uptimeSeconds),
});
