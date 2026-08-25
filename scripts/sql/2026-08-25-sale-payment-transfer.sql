-- Metoda de plată „transfer bancar", pentru vânzarea născută dintr-un cont de
-- plată: contul se achită prin bancă, iar banii se scriu separat ca
-- PartnerPayment. Până acum vânzarea aceea pleca fără metodă, deci cădea în
-- „Nespecificat" la închiderea de zi și nu intra în datoria clientului.
--
-- Aditiv: nu șterge și nu rescrie niciun rând. Aplică cu:
--   psql "$DATABASE_URL" -f scripts/sql/2026-08-25-sale-payment-transfer.sql
-- sau, echivalent, cu: pnpm db:push

-- AlterEnum
-- Notă: ADD VALUE nu poate fi folosit în aceeași tranzacție în care e adăugat,
-- deci rulează instrucțiunea singură, nu într-un BEGIN cu alte scrieri.
ALTER TYPE "SalePaymentMethod" ADD VALUE IF NOT EXISTS 'TRANSFER';
