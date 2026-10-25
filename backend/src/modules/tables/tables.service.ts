import type { PrismaClient } from "@/generated/prisma/client";
import { AppError } from "@/shared/errors";

export const TABLE_NOT_FOUND_MESSAGE = "Table not found";

// Missing, inactive, other restaurant's table or unknown restaurant all
// answer the same 404 (R2.2).
export async function getActiveTable(
  prisma: PrismaClient,
  slug: string,
  tableId: number,
): Promise<{ id: number }> {
  const table = await prisma.table.findFirst({
    where: { number: tableId, active: true, restaurant: { slug } },
    select: { number: true },
  });
  if (table === null) {
    throw new AppError("NOT_FOUND", 404, TABLE_NOT_FOUND_MESSAGE);
  }
  return { id: table.number };
}
