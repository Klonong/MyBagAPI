CREATE TABLE "shipping_methods" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "fee" DECIMAL(15,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipping_methods_code_key" ON "shipping_methods"("code");

INSERT INTO "shipping_methods" ("code", "name", "fee")
VALUES
    ('standard', 'Standard Shipping', 0),
    ('express', 'Express Shipping', 25)
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "orders" ADD COLUMN "shipping_method_id" INTEGER;

UPDATE "orders" AS orders
SET "shipping_method_id" = shipping_methods."id"
FROM "shipping_methods" AS shipping_methods
WHERE shipping_methods."code" = orders."delivery_method";

UPDATE "orders"
SET "shipping_method_id" = (SELECT "id" FROM "shipping_methods" WHERE "code" = 'standard')
WHERE "shipping_method_id" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "shipping_method_id" SET NOT NULL;

CREATE INDEX "idx_orders_shipping_method_id" ON "orders"("shipping_method_id");

ALTER TABLE "orders"
ADD CONSTRAINT "orders_shipping_method_id_fkey"
FOREIGN KEY ("shipping_method_id") REFERENCES "shipping_methods"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;
