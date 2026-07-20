export function resolveRootDestination(user: { id: string } | null) {
  return user ? "/crm" : "/catalog";
}
