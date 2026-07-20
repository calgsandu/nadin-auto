export type PendingOperationKind =
  | "SALE"
  | "PAYMENT_ACCOUNT_FULFILLMENT";

export type PendingSaleLine = {
  /// null = linie externă (piesă de la furnizor, fără produs în catalog).
  productId: string | null;
  externalName: string | null;
  externalCode: string | null;
  externalSupplierId: string | null;
  unitCostLei: number | null;
  quantity: number;
  unitPriceLei: number;
};

export type PendingSalePayload = {
  warehouseId: string;
  documentDate: string;
  partnerId: string | null;
  newCustomerName: string | null;
  notes: string | null;
  cashRegistered: boolean;
  paymentMethod: "CASH" | "CARD";
  lines: PendingSaleLine[];
};

export type PendingPaymentFulfillmentPayload = {
  paymentAccountId: string;
};

export type ParsedPendingOperation =
  | { kind: "SALE"; payload: PendingSalePayload }
  | {
      kind: "PAYMENT_ACCOUNT_FULFILLMENT";
      payload: PendingPaymentFulfillmentPayload;
    };
