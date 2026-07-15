import "server-only";

import { randomUUID } from "node:crypto";
import { getEFacturaConfig } from "@/lib/e-factura/config";

export type EFacturaPostResult = {
  requestId: string;
  status: number;
  totalInvoices: number | null;
  totalInvoicesPosted: number | null;
  errorMessage: string | null;
};

type PostInvoicesResponse = {
  RequestId?: unknown;
  Status?: unknown;
  TotalInvoices?: unknown;
  TotalInvoicesPosted?: unknown;
  ErrorMessage?: unknown;
  PostInvoicesResult?: unknown;
};

export async function postUnsignedInvoice(
  xml: string,
  options: { requestId?: string } = {},
): Promise<EFacturaPostResult> {
  const config = getEFacturaConfig();
  if (!config) {
    throw new Error("Integrarea e-Factura nu este configurată în .env.");
  }

  const requestId = options.requestId ?? randomUUID();
  const soap = await import("soap");
  const client = await soap.createClientAsync(config.wsdlUrl, {
    endpoint: config.endpointUrl,
  });

  client.setEndpoint(config.endpointUrl);
  client.setSecurity(new soap.WSSecurity(config.username, config.password, {
    passwordType: "PasswordText",
  }));

  const operation = client.PostInvoicesAsync;
  if (typeof operation !== "function") {
    throw new Error("WSDL-ul configurat nu expune metoda PostInvoices.");
  }

  const [raw] = await operation.call(client, {
    request: {
      RequestId: requestId,
      InvoicesXml: xml,
      ActorRole: 1,
      InvoicesXmlStatus: "0",
    },
  });
  const response = unwrapResponse(raw);
  const status = numberValue(response.Status);
  const errorMessage = stringValue(response.ErrorMessage);

  if (status === null) {
    throw new Error("SIA e-Factura a returnat un răspuns fără statut.");
  }

  return {
    requestId: stringValue(response.RequestId) ?? requestId,
    status,
    totalInvoices: numberValue(response.TotalInvoices),
    totalInvoicesPosted: numberValue(response.TotalInvoicesPosted),
    errorMessage,
  };
}

function unwrapResponse(value: unknown): PostInvoicesResponse {
  if (!value || typeof value !== "object") return {};
  const response = value as PostInvoicesResponse;
  if (response.PostInvoicesResult && typeof response.PostInvoicesResult === "object") {
    return response.PostInvoicesResult as PostInvoicesResponse;
  }
  return response;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
