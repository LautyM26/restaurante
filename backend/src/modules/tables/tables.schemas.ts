import { z } from "zod";
import { restaurantSlugSchema } from "@/shared/restaurants";

const MAX_TABLE_ID = 2_147_483_647;

// §13.2: positive integer up to the column maximum. Canonical decimal digits
// only (no sign, no leading zeros, no decimals).
export const tableIdSchema = z
  .string()
  .regex(/^[1-9][0-9]*$/)
  .transform(Number)
  .pipe(z.number().max(MAX_TABLE_ID));

export const tableParamsSchema = z.object({ tableId: tableIdSchema });
export const tableQuerySchema = z.object({ restaurant: restaurantSlugSchema });

export type TableParams = z.infer<typeof tableParamsSchema>;
export type TableQuery = z.infer<typeof tableQuerySchema>;
