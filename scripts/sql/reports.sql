-- Report DB objects (AS10 — viziuni & proceduri stocate).
-- Apply with: psql "$DATABASE_URL" -f scripts/sql/reports.sql

-- View: total stock quantity per warehouse.
CREATE OR REPLACE VIEW v_warehouse_stock AS
SELECT w.id,
       w.name,
       COALESCE(SUM(ws.quantity), 0)::int AS total_quantity
FROM "Warehouse" w
LEFT JOIN "WarehouseStock" ws ON ws."warehouseId" = w.id
GROUP BY w.id, w.name;

-- Stored function: products at or below a stock threshold (NULL stock = critical).
CREATE OR REPLACE FUNCTION f_low_stock(threshold int)
RETURNS TABLE(id text, description text, stock int, code text)
LANGUAGE sql STABLE AS $$
  SELECT p.id, p.description, p.stock, p."externalCode"
  FROM "Product" p
  WHERE p.stock IS NULL OR p.stock <= threshold
  ORDER BY p.stock ASC NULLS FIRST
  LIMIT 50;
$$;
