CREATE TABLE "discounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "starts_at" TIMESTAMP(6) NOT NULL,
    "ends_at" TIMESTAMP(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "discounts_code_key" ON "discounts"("code");
CREATE INDEX "idx_discounts_is_active" ON "discounts"("is_active");
CREATE INDEX "idx_discounts_dates" ON "discounts"("starts_at", "ends_at");

CREATE TABLE "store_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "store_name" VARCHAR(255) NOT NULL DEFAULT 'Pioma',
    "support_email" VARCHAR(255),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'IDR',
    "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "store_settings" ("id", "store_name", "currency")
VALUES (1, 'Pioma', 'IDR')
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "categories" ADD COLUMN "updated_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
