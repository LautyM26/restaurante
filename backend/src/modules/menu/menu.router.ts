import { Router } from "express";
import type { PrismaClient } from "@/generated/prisma/client";
import { validate } from "@/shared/validate";
import { menuQuerySchema, type MenuQuery } from "./menu.schemas";
import { getMenu } from "./menu.service";

export function createMenuRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    "/menu",
    validate({ query: menuQuerySchema }),
    async (_req, res) => {
      const { query } = res.locals["input"] as { query: MenuQuery };
      res.status(200).json(await getMenu(prisma, query.restaurant));
    },
  );

  return router;
}
