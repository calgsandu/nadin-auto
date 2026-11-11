-- Etapa 4 a modulului financiar: închiderea lunii.
--
-- Un rând fără `reopenedAt` blochează orice mutație de document, cheltuială sau
-- plată datată în luna lui. Idempotent.

CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
  "id"             TEXT PRIMARY KEY,
  "month"          TEXT NOT NULL,
  "closedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedById"     TEXT,
  "closedByName"   TEXT,
  "note"           TEXT,
  "reopenedAt"     TIMESTAMP(3),
  "reopenedById"   TEXT,
  "reopenedByName" TEXT,
  "reopenNote"     TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingPeriod_month_key" ON "AccountingPeriod"("month");
