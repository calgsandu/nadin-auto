import { StatusLink, StatusScreen } from "@/app/components/status-screen";

export default function NotFound() {
  return (
    <StatusScreen
      title="Pagina nu există"
      message="Adresa e greșită sau pagina a fost mutată."
      actions={
        <>
          <StatusLink href="/" label="Înapoi la început" />
          <StatusLink href="/catalog" label="Catalogul public" />
        </>
      }
    />
  );
}
