CREATE TABLE "order_statuses" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_statuses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_statuses_code_key" ON "order_statuses"("code");

INSERT INTO "order_statuses" ("code", "name")
SELECT DISTINCT "status", INITCAP(REPLACE("status", '_', ' '))
FROM "orders"
WHERE "status" IS NOT NULL
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "order_statuses" ("code", "name")
VALUES ('pending', 'Pending')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "orders" ADD COLUMN "status_id" INTEGER;

UPDATE "orders" AS orders
SET "status_id" = statuses."id"
FROM "order_statuses" AS statuses
WHERE statuses."code" = orders."status";

UPDATE "orders"
SET "status_id" = (SELECT "id" FROM "order_statuses" WHERE "code" = 'pending')
WHERE "status_id" IS NULL;

ALTER TABLE "orders" ALTER COLUMN "status_id" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "status_id" SET DEFAULT 1;
ALTER TABLE "orders" DROP COLUMN "status";

ALTER TABLE "orders"
ADD CONSTRAINT "orders_status_id_fkey"
FOREIGN KEY ("status_id") REFERENCES "order_statuses"("id")
ON DELETE NO ACTION ON UPDATE NO ACTION;
