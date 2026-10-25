import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

// §13.2 (D-078): restaurant slug.
export const restaurantSlugSchema = z
  .string()
  .max(50)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export function findRestaurantBySlug(prisma: PrismaClient, slug: string) {
  return prisma.restaurant.findUnique({ where: { slug } });
}
