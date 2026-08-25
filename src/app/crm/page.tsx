import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** `/crm` e doar intrarea: fiecare secțiune are ruta ei. */
export default function CrmIndexPage() {
  redirect("/crm/produse");
}
