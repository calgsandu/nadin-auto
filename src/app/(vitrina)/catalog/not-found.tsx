import { StatusLink, StatusScreen } from "@/app/components/status-screen";
import { catalogCopy, catalogHref } from "@/lib/vitrina/i18n";
import { getRequestCatalogLocale } from "@/lib/vitrina/request-locale";

/**
 * 404-ul vitrinei: aici ajung linkurile către o piesă/marcă scoasă din catalog,
 * deci textul e în limba vizitatorului, iar antetul public rămâne pe ecran.
 */
export default async function CatalogNotFound() {
  const locale = await getRequestCatalogLocale();
  const copy = catalogCopy(locale).notFound;

  return (
    <div className="pt-24">
      <StatusScreen
        title={copy.title}
        message={copy.message}
        actions={
          <>
            <StatusLink href={catalogHref(locale)} label={copy.home} />
            <StatusLink href={catalogHref(locale, "/cauta")} label={copy.search} />
          </>
        }
      />
    </div>
  );
}
