import type { OperationsData } from "@/lib/operations/queries";
import type { SupplierOption, WarehouseOption } from "@/app/operations/stock-document-dialog";

export function toWarehouseOptions(
  warehouses: OperationsData["warehouses"],
): WarehouseOption[] {
  return warehouses.map((warehouse) => ({ id: warehouse.id, name: warehouse.name }));
}

export function toSupplierOptions(
  suppliers: OperationsData["suppliers"],
): SupplierOption[] {
  return suppliers.map((supplier) => ({ id: supplier.id, name: supplier.name }));
}

export function toCustomerOptions(
  customers: OperationsData["customers"],
): SupplierOption[] {
  return customers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    balanceLei: customer.balanceLei,
    discountPercent: customer.discountPercent,
  }));
}
