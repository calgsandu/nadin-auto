type SessionResult<T> = { data: T; error: null } | { data: null; error: { status?: number } };

/**
 * `auth.getSession()` cu o a doua încercare, pentru cele două eșecuri
 * trecătoare care ajungeau pe ecran ca „Ceva n-a mers" după un cod 2FA corect:
 *
 * - Neon Auth reîmprospătează sesiunea și vrea să scrie cookie-ul, dar suntem
 *   într-o pagină (Server Component), unde Next.js interzice scrierea și
 *   aruncă. Sesiunea e deja reîmprospătată pe server, deci a doua cerere nu mai
 *   scrie nimic și trece.
 * - Serviciul de autentificare pornit la rece / rețea căzută (eroare 5xx sau
 *   fără status). Un 4xx e un răspuns real și nu se repetă.
 */
export async function getSessionWithRetry<T>(
  getSession: () => Promise<SessionResult<T>>,
  pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 300)),
): Promise<SessionResult<T>> {
  try {
    const first = await getSession();
    if (!first.error || (first.error.status != null && first.error.status < 500)) return first;
    console.warn("[auth] getSession a eșuat, reîncerc", first.error);
  } catch (error) {
    console.warn("[auth] getSession a aruncat, reîncerc", error);
  }
  await pause();
  return getSession();
}
