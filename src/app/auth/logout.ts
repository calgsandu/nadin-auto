export const LOGOUT_REDIRECT_PATH = "/auth/sign-in";

type LogoutOptions = {
  signOut: () => Promise<unknown>;
  redirect: (path: string) => never | void;
};

export async function performLogout({ signOut, redirect }: LogoutOptions) {
  await signOut();
  redirect(LOGOUT_REDIRECT_PATH);
}
