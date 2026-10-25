import { z } from "zod";
import { restaurantSlugSchema } from "@/shared/restaurants";

export const menuQuerySchema = z.object({ restaurant: restaurantSlugSchema });

export type MenuQuery = z.infer<typeof menuQuerySchema>;
