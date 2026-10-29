import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** `/crm` e doar intrarea: pornește din pagina Azi; fiecare secțiune are ruta ei. */
export default function CrmIndexPage() {
  redirect("/crm/azi");
}
