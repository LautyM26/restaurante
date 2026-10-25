import type { PrismaClient } from "@/generated/prisma/client";
import type { Menu } from "@/domain/types";
import { AppError } from "@/shared/errors";
import { toMenu } from "./menu.mapper";

export const RESTAURANT_NOT_FOUND_MESSAGE = "Restaurant not found";

// One nested query: the restaurant (by slug) with its whole menu, ordered by
// `position` at every level (§6.1).
export async function getMenu(
  prisma: PrismaClient,
  slug: string,
): Promise<Menu> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    select: {
      categories: {
        orderBy: { position: "asc" },
        include: {
          dishes: {
            orderBy: { position: "asc" },
            include: {
              optionGroups: {
                orderBy: { position: "asc" },
                include: { options: { orderBy: { position: "asc" } } },
              },
            },
          },
        },
      },
    },
  });
  if (restaurant === null) {
    throw new AppError("NOT_FOUND", 404, RESTAURANT_NOT_FOUND_MESSAGE);
  }
  return toMenu(restaurant.categories);
}
