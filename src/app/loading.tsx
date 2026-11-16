/**
 * Feedback la navigare, cât timp layoutul cerut încă își face treaba pe
 * server. Layoutul CRM așteaptă sesiunea și contorul de aprobări ÎNAINTE de a
 * randa ceva, iar `crm/loading.tsx` nu acoperă asta: un `loading.tsx` acoperă
 * copiii segmentului, nu layoutul din același folder. Fără ăsta, click pe CRM
 * lăsa ecranul vechi înghețat până răspundea serverul.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="min-h-[100dvh] bg-[#f1f4f9]">
      <span className="sr-only">Se încarcă</span>
      <div className="h-14 border-b border-[#e5e9f0] bg-white" />
      <div className="mx-auto grid max-w-6xl gap-3 p-4 lg:p-6">
        <div className="skeleton-pulse h-8 w-48 rounded-md bg-[#edf0f5]" />
        <div className="skeleton-pulse h-64 rounded-xl bg-[#eef1f6]" />
      </div>
    </div>
  );
}
