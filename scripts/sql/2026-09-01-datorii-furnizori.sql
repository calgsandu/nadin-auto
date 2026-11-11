-- Etapa 2 a modulului financiar: plățile către furnizori.
--
-- `PartnerPayment` ținea doar încasări de la clienți. Primește un sens
-- (`direction`) și contul prin care au trecut banii; recepțiile primesc
-- scadența, ca să se poată răspunde la „ce trebuie plătit săptămâna asta".
--
-- Idempotent. Se aplică întâi pe ramura de test, apoi pe live.

DO $$ BEGIN
  CREATE TYPE "PaymentDirection" AS ENUM ('IN', 'OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Rândurile existente sunt toate încasări de la clienți, deci `IN` e corect.
ALTER TABLE "PartnerPayment"
  ADD COLUMN IF NOT EXISTS "direction" "PaymentDirection" NOT NULL DEFAULT 'IN',
  ADD COLUMN IF NOT EXISTS "accountId" TEXT;

CREATE INDEX IF NOT EXISTS "PartnerPayment_direction_paidAt_idx"
  ON "PartnerPayment"("direction", "paidAt");

DO $$ BEGIN
  ALTER TABLE "PartnerPayment" ADD CONSTRAINT "PartnerPayment_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "MoneyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "StockDocument" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3);
