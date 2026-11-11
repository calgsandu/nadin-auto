-- Etapa 1 a modulului financiar: casa/contul bancar + cheltuielile.
--
-- Se aplică ÎNTÂI pe o ramură Neon temporară forkată din `br-rough-block-allnrhvi`
-- (ramura implicită a proiectului e veche — testul pe ea nu dovedește nimic),
-- abia apoi pe ramura live.
--
-- Idempotent: se poate rula de două ori fără să cadă.

DO $$ BEGIN
  CREATE TYPE "MoneyAccountKind" AS ENUM ('CASH', 'BANK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM (
    'CHIRIE', 'SALARII', 'UTILITATI', 'COMBUSTIBIL', 'TRANSPORT',
    'AMBALAJE', 'COMISION_CARD', 'TAXE', 'SERVICII', 'ALTELE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MoneyAccount" (
  "id"                TEXT PRIMARY KEY,
  "name"              TEXT NOT NULL,
  "kind"              "MoneyAccountKind" NOT NULL,
  "iban"              TEXT,
  "openingBalanceLei" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "openingDate"       TIMESTAMP(3) NOT NULL,
  "active"            BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "MoneyAccount_name_key" ON "MoneyAccount"("name");

CREATE TABLE IF NOT EXISTS "Expense" (
  "id"             TEXT PRIMARY KEY,
  "number"         INTEGER NOT NULL,
  "date"           TIMESTAMP(3) NOT NULL,
  "category"       "ExpenseCategory" NOT NULL,
  "amountLei"      DECIMAL(10,2) NOT NULL,
  "description"    TEXT NOT NULL,
  "partnerId"      TEXT,
  "accountId"      TEXT NOT NULL,
  "notes"          TEXT,
  "idempotencyKey" TEXT,
  "createdById"    TEXT,
  "createdByName"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_number_key" ON "Expense"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_idempotencyKey_key" ON "Expense"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");
CREATE INDEX IF NOT EXISTS "Expense_category_date_idx" ON "Expense"("category", "date");
CREATE INDEX IF NOT EXISTS "Expense_accountId_date_idx" ON "Expense"("accountId", "date");
CREATE INDEX IF NOT EXISTS "Expense_partnerId_idx" ON "Expense"("partnerId");

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
