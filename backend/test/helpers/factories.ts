import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

type OptionGroupType = "single" | "multiple";

export function randomSlug(): string {
  return `t-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function createRestaurant(prisma: PrismaClient, slug = randomSlug()) {
  return prisma.restaurant.create({ data: { slug } });
}

export function createTable(
  prisma: PrismaClient,
  restaurantId: string,
  number: number,
  active = true,
) {
  return prisma.table.create({ data: { restaurantId, number, active } });
}

export function createCategory(
  prisma: PrismaClient,
  restaurantId: string,
  position = 0,
) {
  return prisma.category.create({
    data: {
      restaurantId,
      position,
      nameEs: `Categoria ${position}`,
      visual: "main",
    },
  });
}

export function createDish(
  prisma: PrismaClient,
  categoryId: string,
  overrides: {
    position?: number;
    priceCents?: number;
    available?: boolean;
  } = {},
) {
  const position = overrides.position ?? 0;
  return prisma.dish.create({
    data: {
      categoryId,
      position,
      nameEs: `Plato ${position}`,
      descriptionEs: "Descripcion",
      priceCents: overrides.priceCents ?? 1000,
      available: overrides.available,
    },
  });
}

export function createOptionGroup(
  prisma: PrismaClient,
  dishId: string,
  overrides: { type?: OptionGroupType; min?: number; max?: number } = {},
) {
  return prisma.optionGroup.create({
    data: {
      dishId,
      position: 0,
      nameEs: "Grupo",
      type: overrides.type ?? "multiple",
      min: overrides.min ?? 0,
      max: overrides.max ?? 2,
    },
  });
}

export function createOption(
  prisma: PrismaClient,
  groupId: string,
  overrides: { position?: number; priceDeltaCents?: number } = {},
) {
  return prisma.option.create({
    data: {
      groupId,
      position: overrides.position ?? 0,
      nameEs: "Opcion",
      priceDeltaCents: overrides.priceDeltaCents ?? 0,
    },
  });
}

/** Restaurant with a random slug, one category, one dish and tables 1..n. */
export async function createTestRestaurant(
  prisma: PrismaClient,
  options: { tables?: number } = {},
) {
  const restaurant = await createRestaurant(prisma);
  const tableCount = options.tables ?? 3;
  for (let n = 1; n <= tableCount; n++) {
    await createTable(prisma, restaurant.id, n);
  }
  const category = await createCategory(prisma, restaurant.id);
  const dish = await createDish(prisma, category.id);
  return { restaurant, category, dish };
}

/** Pending order on an existing table. */
export function createOrder(
  prisma: PrismaClient,
  restaurantId: string,
  tableNumber: number,
) {
  const now = new Date();
  return prisma.order.create({
    data: {
      restaurantId,
      tableNumber,
      // Fixed placeholder: these tests do not exercise short-code generation.
      code: "AB12",
      clientRequestId: randomUUID(),
      requestFingerprint: "0".repeat(64),
      totalCents: 1000n,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    },
  });
}
