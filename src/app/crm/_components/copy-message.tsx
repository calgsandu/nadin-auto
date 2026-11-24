"use client";

import { useState } from "react";
import { Check, MessageCircle } from "lucide-react";

/**
 * Mesaj gata scris (memento de plată, comandă la furnizor): îl copiază și,
 * dacă avem telefonul, deschide chatul Viber, ca operatorul doar să lipească
 * și să trimită.
 */
export function CopyMessage({
  text,
  phone,
  label,
  className = "",
}: {
  text: string;
  phone: string | null;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const viberNumber = phone ? viberPhone(phone) : null;

  const remind = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fără acces la clipboard: arătăm textul, să-l copieze de mână.
      window.prompt("Copiază mesajul:", text);
    }
    if (viberNumber) window.location.href = `viber://chat?number=${encodeURIComponent(viberNumber)}`;
  };

  return (
    <button
      type="button"
      onClick={remind}
      title={viberNumber ? "Copiază mesajul și deschide Viber" : "Copiază mesajul"}
      className={`${className} inline-flex items-center gap-1.5 rounded-full border border-(--c-line) bg-(--c-surface) px-2.5 py-1 text-xs font-medium text-(--c-ink) hover:border-(--c-line-strong)`}
    >
      {copied ? <Check className="size-3.5 text-(--c-green)" aria-hidden="true" /> : <MessageCircle className="size-3.5" aria-hidden="true" />}
      {copied ? "Copiat" : label}
    </button>
  );
}

/** „069 123 456" → „+37369123456"; numerele cu prefix rămân cum sunt. */
export function viberPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("373")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 9) return `+373${digits.slice(1)}`;
  return digits.length >= 8 ? `+373${digits}` : null;
}
