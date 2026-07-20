import type { WorkspaceSectionId } from "@/lib/operations/workspace";

type QueryValue = string | number | null | undefined;

function crmHref(
  section: WorkspaceSectionId,
  values: Record<string, QueryValue>,
) {
  const query = new URLSearchParams({ section });

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  return `/crm?${query.toString()}`;
}

export function crmSectionHref(section: WorkspaceSectionId) {
  return crmHref(section, {});
}

export function crmCatalogPageHref(values: {
  q?: string;
  brand?: string;
  model?: string;
  type?: string;
  year?: string;
  page?: number;
}) {
  return crmHref("produse", {
    q: values.q,
    brand: values.brand,
    model: values.model,
    type: values.type,
    year: values.year,
    page: values.page && values.page > 1 ? values.page : undefined,
  });
}

export function crmCatalogFilterHref(params: URLSearchParams) {
  const query = new URLSearchParams({ section: "produse" });

  for (const key of ["q", "brand", "model", "type", "year"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }

  return `/crm?${query.toString()}`;
}

export function crmDocumentsHref(values: {
  dtype?: string;
  partner?: string;
  from?: string;
  to?: string;
  dpage?: number;
}) {
  return crmHref("documente", {
    dtype: values.dtype,
    partner: values.partner,
    from: values.from,
    to: values.to,
    dpage: values.dpage && values.dpage > 1 ? values.dpage : undefined,
  });
}

export function crmAuditHref(values: { act?: string; doc?: string }) {
  return crmHref("istoric", values);
}
