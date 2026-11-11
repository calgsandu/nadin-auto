-- Etapa 3 a modulului financiar: mișcările de bani fără alt document în spate.
--
-- Soldul unui cont NU se ține aici: se derivă din vânzări, încasări, plăți și
-- cheltuieli, plus rândurile din acest tabel. Dublarea lor ar da două adevăruri
-- care se pot contrazice.
--
-- Idempotent. Se aplică întâi pe ramura de test, apoi pe live.

DO $$ BEGIN
  CREATE TYPE "MoneyMovementKind" AS ENUM (
    'DEPUNERE', 'RETRAGERE', 'TRANSFER', 'ALTA_INCASARE', 'ALTA_PLATA'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MoneyMovement" (
  "id"               TEXT PRIMARY KEY,
  "accountId"        TEXT NOT NULL,
  "date"             TIMESTAMP(3) NOT NULL,
  "amountLei"        DECIMAL(12,2) NOT NULL,
  "kind"             "MoneyMovementKind" NOT NULL,
  "counterAccountId" TEXT,
  "transferGroupId"  TEXT,
  "notes"            TEXT,
  "idempotencyKey"   TEXT,
  "createdById"      TEXT,
  "createdByName"    TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "MoneyMovement_idempotencyKey_key" ON "MoneyMovement"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "MoneyMovement_accountId_date_idx" ON "MoneyMovement"("accountId", "date");
CREATE INDEX IF NOT EXISTS "MoneyMovement_transferGroupId_idx" ON "MoneyMovement"("transferGroupId");

DO $$ BEGIN
  ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MoneyMovement" ADD CONSTRAINT "MoneyMovement_counterAccountId_fkey"
    FOREIGN KEY ("counterAccountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
