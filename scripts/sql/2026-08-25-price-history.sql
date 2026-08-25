-- Istoric prețuri + indexul compus pentru rapoarte.
-- Aditiv: nu șterge nimic. Aplică cu:
--   psql "$DATABASE_URL" -f scripts/sql/2026-08-25-price-history.sql
-- sau, echivalent, cu: pnpm db:push

-- CreateTable
CREATE TABLE "PriceChange" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "costLeiBefore" DECIMAL(10,2),
    "costLeiAfter" DECIMAL(10,2),
    "salePriceLeiBefore" DECIMAL(10,2),
    "salePriceLeiAfter" DECIMAL(10,2),
    "priceEuroBefore" DECIMAL(10,2),
    "priceEuroAfter" DECIMAL(10,2),
    "changedById" TEXT,
    "changedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceChange_productId_createdAt_idx" ON "PriceChange"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceChange_createdAt_idx" ON "PriceChange"("createdAt");

-- CreateIndex
CREATE INDEX "StockDocument_type_documentDate_idx" ON "StockDocument"("type", "documentDate");

-- AddForeignKey
ALTER TABLE "PriceChange" ADD CONSTRAINT "PriceChange_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

