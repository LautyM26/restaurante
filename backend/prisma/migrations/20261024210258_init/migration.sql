-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "OptionGroupType" AS ENUM ('single', 'multiple');

-- CreateEnum
CREATE TYPE "CategoryVisual" AS ENUM ('starter', 'main', 'grill', 'pasta', 'dessert', 'drink');

-- CreateEnum
CREATE TYPE "DietaryTag" AS ENUM ('vegetarian', 'vegan', 'gluten_free', 'spicy');

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(50) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Table" (
    "restaurantId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Table_pkey" PRIMARY KEY ("restaurantId","number")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "visual" "CategoryVisual" NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "descriptionEs" TEXT NOT NULL,
    "descriptionEn" TEXT,
    "priceCents" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "tags" "DietaryTag"[] DEFAULT ARRAY[]::"DietaryTag"[],
    "available" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionGroup" (
    "id" UUID NOT NULL,
    "dishId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "type" "OptionGroupType" NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,

    CONSTRAINT "OptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "priceDeltaCents" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "userId" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "restaurantId" UUID NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "code" CHAR(4) NOT NULL,
    "clientRequestId" UUID NOT NULL,
    "requestFingerprint" CHAR(64) NOT NULL,
    "note" TEXT,
    "totalCents" BIGINT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "lineId" VARCHAR(4096) NOT NULL,
    "dishId" UUID NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemOption" (
    "id" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "groupId" UUID NOT NULL,
    "optionId" UUID NOT NULL,
    "nameEs" TEXT NOT NULL,
    "nameEn" TEXT,
    "priceDeltaCents" INTEGER NOT NULL,

    CONSTRAINT "OrderItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusChange" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrderStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Category_restaurantId_position_idx" ON "Category"("restaurantId", "position");

-- CreateIndex
CREATE INDEX "Dish_categoryId_position_idx" ON "Dish"("categoryId", "position");

-- CreateIndex
CREATE INDEX "OptionGroup_dishId_position_idx" ON "OptionGroup"("dishId", "position");

-- CreateIndex
CREATE INDEX "Option_groupId_position_idx" ON "Option"("groupId", "position");

-- CreateIndex
CREATE INDEX "StaffMember_restaurantId_idx" ON "StaffMember"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_createdAt_idx" ON "Order"("restaurantId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Order_restaurantId_updatedAt_idx" ON "Order"("restaurantId", "updatedAt");

-- CreateIndex
CREATE INDEX "Order_restaurantId_tableNumber_createdAt_idx" ON "Order"("restaurantId", "tableNumber", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_restaurantId_clientRequestId_key" ON "Order"("restaurantId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItem_orderId_position_key" ON "OrderItem"("orderId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemOption_orderItemId_position_key" ON "OrderItemOption"("orderItemId", "position");

-- CreateIndex
CREATE INDEX "OrderStatusChange_orderId_at_idx" ON "OrderStatusChange"("orderId", "at");

-- AddForeignKey
ALTER TABLE "Table" ADD CONSTRAINT "Table_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_dishId_fkey" FOREIGN KEY ("dishId") REFERENCES "Dish"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Option" ADD CONSTRAINT "Option_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "OptionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_tableNumber_fkey" FOREIGN KEY ("restaurantId", "tableNumber") REFERENCES "Table"("restaurantId", "number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemOption" ADD CONSTRAINT "OrderItemOption_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusChange" ADD CONSTRAINT "OrderStatusChange_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security (design 5.3, D-106): enabled on every table, no policies
ALTER TABLE "Restaurant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Table" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Category" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Dish" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OptionGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Option" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItemOption" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderStatusChange" ENABLE ROW LEVEL SECURITY;
-- "_prisma_migrations" does not exist in the shadow database, hence the guard (D-180)
DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- CHECK constraints (design 5.4, D-120, D-125). Naming: <Table>_<column>_<rule>_check
ALTER TABLE "Table" ADD CONSTRAINT "Table_number_min_check" CHECK ("number" >= 1);
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_priceCents_nonnegative_check" CHECK ("priceCents" >= 0);
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_min_nonnegative_check" CHECK ("min" >= 0);
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_max_gte_min_check" CHECK ("max" >= "min");
ALTER TABLE "OptionGroup" ADD CONSTRAINT "OptionGroup_single_max_one_check" CHECK ("type" <> 'single' OR "max" = 1);
ALTER TABLE "Option" ADD CONSTRAINT "Option_priceDeltaCents_nonnegative_check" CHECK ("priceDeltaCents" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_range_check" CHECK ("quantity" BETWEEN 1 AND 20);
