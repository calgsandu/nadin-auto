export function needsPasswordCredential(providerIds: string[]) {
  return !providerIds.includes("credential");
}
