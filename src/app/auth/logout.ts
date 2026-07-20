export const LOGOUT_REDIRECT_PATH = "/auth/sign-in";

type LogoutOptions = {
  clearSecondFactor: () => Promise<void>;
  reportCleanupError?: (error: unknown) => void;
  signOut: () => Promise<unknown>;
  redirect: (path: string) => never | void;
};

export async function performLogout({
  clearSecondFactor,
  reportCleanupError = (error) => console.error("[2fa] logout cleanup failed", error),
  signOut,
  redirect,
}: LogoutOptions) {
  try {
    await clearSecondFactor();
  } catch (error) {
    reportCleanupError(error);
  }
  await signOut();
  redirect(LOGOUT_REDIRECT_PATH);
}
