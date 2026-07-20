export function pendingSaleCustomerName(
  payload: { newCustomerName: string | null; partnerId: string | null },
  partnerById: ReadonlyMap<string, string>,
) {
  if (payload.newCustomerName) return payload.newCustomerName;
  if (!payload.partnerId) return "Consumator final";
  return partnerById.get(payload.partnerId) ?? "Client indisponibil";
}
