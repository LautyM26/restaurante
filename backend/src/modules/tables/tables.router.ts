import { Router } from "express";
import type { PrismaClient } from "@/generated/prisma/client";
import { validate } from "@/shared/validate";
import {
  tableParamsSchema,
  tableQuerySchema,
  type TableParams,
  type TableQuery,
} from "./tables.schemas";
import { getActiveTable } from "./tables.service";

export function createTablesRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get(
    "/tables/:tableId",
    validate({ params: tableParamsSchema, query: tableQuerySchema }),
    async (_req, res) => {
      const { params, query } = res.locals["input"] as {
        params: TableParams;
        query: TableQuery;
      };
      res
        .status(200)
        .json(await getActiveTable(prisma, query.restaurant, params.tableId));
    },
  );

  return router;
}
