import type {
  Category as DbCategory,
  Dish as DbDish,
  Option as DbOption,
  OptionGroup as DbOptionGroup,
} from "@/generated/prisma/client";
import type {
  Category,
  Dish,
  LocalizedText,
  Menu,
  Option,
  OptionGroup,
} from "@/domain/types";

type DbOptionGroupWithOptions = DbOptionGroup & { options: DbOption[] };
type DbDishWithGroups = DbDish & {
  optionGroups: DbOptionGroupWithOptions[];
};
type DbCategoryWithDishes = DbCategory & { dishes: DbDishWithGroups[] };

function localized(es: string, en: string | null): LocalizedText {
  return en === null ? { es } : { es, en };
}

function mapOption(option: DbOption): Option {
  return {
    id: option.id,
    name: localized(option.nameEs, option.nameEn),
    priceDeltaCents: option.priceDeltaCents,
    available: option.available,
  };
}

function mapGroup(group: DbOptionGroupWithOptions): OptionGroup {
  return {
    id: group.id,
    name: localized(group.nameEs, group.nameEn),
    type: group.type,
    min: group.min,
    max: group.max,
    options: group.options.map(mapOption),
  };
}

function mapDish(dish: DbDishWithGroups): Dish {
  return {
    id: dish.id,
    categoryId: dish.categoryId,
    order: dish.position,
    name: localized(dish.nameEs, dish.nameEn),
    description: localized(dish.descriptionEs, dish.descriptionEn),
    priceCents: dish.priceCents,
    ...(dish.imageUrl !== null && { imageUrl: dish.imageUrl }),
    tags: dish.tags,
    available: dish.available,
    featured: dish.featured,
    optionGroups: dish.optionGroups.map(mapGroup),
  };
}

function mapCategory(category: DbCategory): Category {
  return {
    id: category.id,
    name: localized(category.nameEs, category.nameEn),
    order: category.position,
    visual: category.visual,
  };
}

// Expects categories already sorted by position; dishes follow the category
// order, then their own position (§5.2).
export function toMenu(categories: DbCategoryWithDishes[]): Menu {
  return {
    categories: categories.map(mapCategory),
    dishes: categories.flatMap((category) => category.dishes.map(mapDish)),
  };
}
