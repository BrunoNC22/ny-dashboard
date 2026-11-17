import { describe, expect, it } from "vitest";

import { Prisma } from "../generated/prisma/client";
import { createPrisma } from "../lib/prisma";

describe("prisma client", () => {
  it("is generated with every model of the schema", () => {
    expect(Object.values(Prisma.ModelName).sort()).toEqual([
      "Dashboard",
      "OdFlowMonthly",
      "Preferences",
      "Projection",
      "SeedMeta",
      "TripDaily",
      "TripHourly",
      "TripSample",
      "User",
      "Zone",
    ]);
  });

  it("can be created without connecting (connection is lazy)", async () => {
    const prisma = createPrisma("postgresql://user:pass@127.0.0.1:1/none");
    expect(typeof prisma.user.findUnique).toBe("function");
    await prisma.$disconnect();
  });
});
