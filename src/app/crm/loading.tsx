import { WorkspaceSkeleton } from "./_components/ui";

/**
 * Rezerva secțiunilor CRM: fiecare are `loading.tsx`-ul ei, dar intrarea pe
 * `/crm` și orice secțiune nouă cădeau altfel pe un ecran gol.
 */
export default function Loading() {
  return <WorkspaceSkeleton filters={4} rows={8} />;
}
