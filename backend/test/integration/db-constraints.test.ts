import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaClient } from "../../src/shared/db";
import {
  createOptionGroup,
  createOrder,
  createRestaurant,
  createTestRestaurant,
} from "../helpers/factories";

const prisma = createPrismaClient(process.env.DATABASE_URL!, 2);

let ctx: Awaited<ReturnType<typeof createTestRestaurant>>;
let optionGroupId: string;
let orderId: string;
let nextPosition = 0;

beforeAll(async () => {
  ctx = await createTestRestaurant(prisma);
  optionGroupId = (await createOptionGroup(prisma, ctx.dish.id)).id;
  orderId = (await createOrder(prisma, ctx.restaurant.id, 1)).id;
});

afterAll(() => prisma.$disconnect());

const createItem = (quantity: number) =>
  prisma.orderItem.create({
    data: {
      orderId,
      position: nextPosition++,
      lineId: randomUUID(),
      dishId: ctx.dish.id,
      nameEs: "Plato",
      quantity,
      unitPriceCents: 1000,
    },
  });

describe("CHECK constraints (D-120)", () => {
  it("Table_number_min_check", async () => {
    const r = await createRestaurant(prisma);
    await expect(
      prisma.table.create({ data: { restaurantId: r.id, number: 0 } }),
    ).rejects.toThrow(/Table_number_min_check/);
  });

  it("Dish_priceCents_nonnegative_check", async () => {
    await expect(
      prisma.dish.create({
        data: {
          categoryId: ctx.category.id,
          position: 9,
          nameEs: "x",
          descriptionEs: "x",
          priceCents: -1,
        },
      }),
    ).rejects.toThrow(/Dish_priceCents_nonnegative_check/);
  });

  it("OptionGroup_min_nonnegative_check", async () => {
    await expect(
      createOptionGroup(prisma, ctx.dish.id, { min: -1, max: 2 }),
    ).rejects.toThrow(/OptionGroup_min_nonnegative_check/);
  });

  it("OptionGroup_max_gte_min_check", async () => {
    await expect(
      createOptionGroup(prisma, ctx.dish.id, { min: 2, max: 1 }),
    ).rejects.toThrow(/OptionGroup_max_gte_min_check/);
  });

  it("OptionGroup_single_max_one_check", async () => {
    await expect(
      createOptionGroup(prisma, ctx.dish.id, {
        type: "single",
        min: 0,
        max: 2,
      }),
    ).rejects.toThrow(/OptionGroup_single_max_one_check/);
  });

  it("Option_priceDeltaCents_nonnegative_check", async () => {
    await expect(
      prisma.option.create({
        data: {
          groupId: optionGroupId,
          position: 0,
          nameEs: "x",
          priceDeltaCents: -1,
        },
      }),
    ).rejects.toThrow(/Option_priceDeltaCents_nonnegative_check/);
  });

  it.each([0, 21])("OrderItem_quantity_range_check (%i)", async (quantity) => {
    await expect(createItem(quantity)).rejects.toThrow(
      /OrderItem_quantity_range_check/,
    );
  });

  it("accepts boundary values", async () => {
    await expect(createItem(1)).resolves.toBeDefined();
    await expect(createItem(20)).resolves.toBeDefined();
  });
});
