import { resolveSection, type WorkspaceSectionId } from "@/lib/operations/workspace";

type QueryValue = string | number | null | undefined;

/**
 * Fiecare secțiune are ruta ei (`/crm/vanzari`), nu un parametru `?section=`.
 * Filtrele rămân în query, pentru că țin de starea paginii, nu de identitatea ei.
 */
function crmHref(section: WorkspaceSectionId, values: Record<string, QueryValue>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }

  const search = query.toString();
  return search ? `/crm/${section}?${search}` : `/crm/${section}`;
}

export function crmSectionHref(section: WorkspaceSectionId) {
  return crmHref(section, {});
}

/** Secțiunea activă dedusă din URL — folosită de nav-ul client din layout. */
export function sectionFromPathname(pathname: string): WorkspaceSectionId {
  const segment = pathname.replace(/^\/crm\/?/, "").split("/")[0];
  return resolveSection(segment || undefined);
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
  return crmHref("produse", {
    q: params.get("q"),
    brand: params.get("brand"),
    model: params.get("model"),
    type: params.get("type"),
    year: params.get("year"),
  });
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

export function crmInventoryHref(values: {
  wh?: string;
  from?: string;
  to?: string;
  ipage?: number;
}) {
  return crmHref("inventar", {
    wh: values.wh,
    from: values.from,
    to: values.to,
    ipage: values.ipage && values.ipage > 1 ? values.ipage : undefined,
  });
}

export function crmAuditHref(values: { act?: string; doc?: string }) {
  return crmHref("istoric", values);
}
