import { normalizeUsername, validateUsername } from "@/lib/auth/username";

export type BreakGlassInput =
  | { help: true }
  | { username: string; reason: string };

export function parseBreakGlassArgs(argv: string[]): BreakGlassInput {
  if (argv.length === 1 && argv[0] === "--help") return { help: true };
  if (argv.includes("--help")) {
    throw new Error("--help nu poate fi combinat cu alte argumente.");
  }

  const values = new Map<string, string>();
  const allowed = new Set(["--username", "--reason"]);

  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith("--")) {
      throw new Error(`Argument pozițional neacceptat: ${flag ?? ""}`);
    }
    if (!allowed.has(flag)) throw new Error(`Argument neacceptat: ${flag}`);
    if (values.has(flag)) throw new Error(`Argument duplicat: ${flag}`);

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Lipsește valoarea pentru ${flag}.`);
    }
    values.set(flag, value);
  }

  const username = normalizeUsername(values.get("--username")?.trim() ?? "");
  const reason = values.get("--reason")?.trim() ?? "";
  const usernameError = validateUsername(username);

  if (!username || usernameError) {
    throw new Error(usernameError ?? "Lipsește username-ul.");
  }
  if (!reason) throw new Error("Lipsește motivul resetării (reason).");

  return { username, reason };
}

export function expectedBreakGlassConfirmation(username: string) {
  return `RESET ${username}`;
}
