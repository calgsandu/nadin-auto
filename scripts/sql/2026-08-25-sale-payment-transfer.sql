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

-- DropIndex: indexul servea o coadă de aprobare care nu s-a produs niciodată
-- (fluxul real e PendingOperation + /crm/aprobari). Coloanele rămân.
DROP INDEX IF EXISTS "AuditLog_reviewStatus_idx";

-- AddColumn: urma comenzii externe către vânzarea creată la livrare.
-- Comenzile livrate ÎNAINTE de această schimbare rămân fără vânzare (null);
-- nu se poate reconstrui retroactiv metoda de plată.
ALTER TABLE "ExternalOrder" ADD COLUMN IF NOT EXISTS "saleDocumentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalOrder_saleDocumentId_key"
    ON "ExternalOrder"("saleDocumentId");
ALTER TABLE "ExternalOrder" DROP CONSTRAINT IF EXISTS "ExternalOrder_saleDocumentId_fkey";
ALTER TABLE "ExternalOrder" ADD CONSTRAINT "ExternalOrder_saleDocumentId_fkey"
    FOREIGN KEY ("saleDocumentId") REFERENCES "StockDocument"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterEnum: statutul 1 de la SIA („acceptat spre execuție") nu e același lucru
-- cu statutul 2 („procesat”). Amândouă erau scrise ca SUBMITTED, iar interfața
-- rămânea pe „necesită semnare" la infinit.
ALTER TYPE "EFacturaSubmissionStatus" ADD VALUE IF NOT EXISTS 'PROCESSED';
