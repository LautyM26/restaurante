import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { RESTAURANT_NOT_FOUND_MESSAGE } from "@/modules/menu/menu.service";
import { createTestApp } from "../helpers/app";
import {
  createCategory,
  createDish,
  createOption,
  createOptionGroup,
  createRestaurant,
} from "../helpers/factories";

const { app, deps } = createTestApp();
const { prisma } = deps;
afterAll(() => prisma.$disconnect());

describe("GET /api/menu", () => {
  it("returns the ordered menu with the Menu shape and no auth", async () => {
    const restaurant = await createRestaurant(prisma);
    // Created out of order on purpose: positions decide the output.
    const catB = await prisma.category.create({
      data: {
        restaurantId: restaurant.id,
        position: 2,
        nameEs: "Postres",
        nameEn: "Desserts",
        visual: "dessert",
      },
    });
    const catA = await createCategory(prisma, restaurant.id, 1);
    const dishB = await createDish(prisma, catB.id, { position: 1 });
    const dishA2 = await createDish(prisma, catA.id, { position: 2 });
    const dishA1 = await prisma.dish.create({
      data: {
        categoryId: catA.id,
        position: 1,
        nameEs: "Milanesa",
        nameEn: "Schnitzel",
        descriptionEs: "Con papas",
        descriptionEn: "With fries",
        priceCents: 2500,
        imageUrl: "https://img.test/m.jpg",
        tags: ["spicy", "gluten_free"],
        featured: true,
      },
    });
    const group = await createOptionGroup(prisma, dishA1.id, {
      type: "single",
      min: 1,
      max: 1,
    });
    const opt2 = await createOption(prisma, group.id, { position: 2 });
    const opt1 = await createOption(prisma, group.id, {
      position: 1,
      priceDeltaCents: 150,
    });

    const res = await request(app).get(
      `/api/menu?restaurant=${restaurant.slug}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual([
      catA.id,
      catB.id,
    ]);
    expect(res.body.categories[1]).toEqual({
      id: catB.id,
      name: { es: "Postres", en: "Desserts" },
      order: 2,
      visual: "dessert",
    });
    expect(res.body.dishes.map((d: { id: string }) => d.id)).toEqual([
      dishA1.id,
      dishA2.id,
      dishB.id,
    ]);
    expect(res.body.dishes[0]).toEqual({
      id: dishA1.id,
      categoryId: catA.id,
      order: 1,
      name: { es: "Milanesa", en: "Schnitzel" },
      description: { es: "Con papas", en: "With fries" },
      priceCents: 2500,
      imageUrl: "https://img.test/m.jpg",
      tags: ["spicy", "gluten_free"],
      available: true,
      featured: true,
      optionGroups: [
        {
          id: group.id,
          name: { es: "Grupo" },
          type: "single",
          min: 1,
          max: 1,
          options: [
            {
              id: opt1.id,
              name: { es: "Opcion" },
              priceDeltaCents: 150,
              available: true,
            },
            {
              id: opt2.id,
              name: { es: "Opcion" },
              priceDeltaCents: 0,
              available: true,
            },
          ],
        },
      ],
    });
  });

  it("omits en and imageUrl when they are null", async () => {
    const restaurant = await createRestaurant(prisma);
    const cat = await createCategory(prisma, restaurant.id);
    await createDish(prisma, cat.id);

    const res = await request(app).get(
      `/api/menu?restaurant=${restaurant.slug}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.categories[0].name).toEqual({ es: "Categoria 0" });
    const dish = res.body.dishes[0];
    expect(dish.name).toEqual({ es: "Plato 0" });
    expect(dish.description).toEqual({ es: "Descripcion" });
    expect("imageUrl" in dish).toBe(false);
  });

  it("includes unavailable dishes and options with available false", async () => {
    const restaurant = await createRestaurant(prisma);
    const cat = await createCategory(prisma, restaurant.id);
    const dish = await createDish(prisma, cat.id, { available: false });
    const group = await createOptionGroup(prisma, dish.id);
    await prisma.option.create({
      data: {
        groupId: group.id,
        position: 0,
        nameEs: "Agotada",
        priceDeltaCents: 0,
        available: false,
      },
    });

    const res = await request(app).get(
      `/api/menu?restaurant=${restaurant.slug}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.dishes[0].available).toBe(false);
    expect(res.body.dishes[0].optionGroups[0].options[0].available).toBe(false);
  });

  it("returns an empty menu for a restaurant without categories", async () => {
    const restaurant = await createRestaurant(prisma);
    const res = await request(app).get(
      `/api/menu?restaurant=${restaurant.slug}`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ categories: [], dishes: [] });
  });

  it("does not leak data from another restaurant", async () => {
    const one = await createRestaurant(prisma);
    const two = await createRestaurant(prisma);
    const catOne = await createCategory(prisma, one.id);
    const catTwo = await createCategory(prisma, two.id);
    const dishOne = await createDish(prisma, catOne.id);
    const dishTwo = await createDish(prisma, catTwo.id);

    const res = await request(app).get(`/api/menu?restaurant=${one.slug}`);

    expect(res.body.categories.map((c: { id: string }) => c.id)).toEqual([
      catOne.id,
    ]);
    expect(res.body.dishes.map((d: { id: string }) => d.id)).toEqual([
      dishOne.id,
    ]);
    expect(JSON.stringify(res.body)).not.toContain(dishTwo.id);
  });

  it("returns 400 VALIDATION when restaurant is missing", async () => {
    const res = await request(app).get("/api/menu");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
    expect(res.body.details.issues).toEqual([
      { path: "query.restaurant", code: "invalid_type" },
    ]);
  });

  it.each([
    ["uppercase", "Fogon"],
    ["double hyphen", "a--b"],
    ["leading hyphen", "-a"],
    ["empty", ""],
    ["too long", "a".repeat(51)],
    ["with spaces", "a%20b"],
  ])("returns 400 VALIDATION for an invalid slug (%s)", async (_n, slug) => {
    const res = await request(app).get(`/api/menu?restaurant=${slug}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("returns 400 VALIDATION when restaurant is repeated", async () => {
    const res = await request(app).get("/api/menu?restaurant=a&restaurant=b");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION");
  });

  it("returns 404 NOT_FOUND for an unknown restaurant", async () => {
    const res = await request(app).get("/api/menu?restaurant=no-such-place");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "NOT_FOUND",
      message: RESTAURANT_NOT_FOUND_MESSAGE,
    });
  });
});
