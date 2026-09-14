-- ── Home page content ─────────────────────────────────────────────────────
-- Single-row store for the editable home page. The whole page config lives in
-- one JSONB document so new sections don't need a migration; the app merges it
-- over built-in defaults, so an empty/missing row still renders the page.

CREATE TABLE IF NOT EXISTS "home_content" (
    "id"         integer PRIMARY KEY DEFAULT 1,
    "content"    jsonb NOT NULL DEFAULT '{}'::jsonb,
    "updated_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "home_content_singleton" CHECK ("id" = 1)
);

INSERT INTO "home_content" ("id", "content") VALUES (1, '{}'::jsonb)
ON CONFLICT ("id") DO NOTHING;
