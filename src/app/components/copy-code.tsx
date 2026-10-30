"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Codul piesei, copiat cu un click — pentru telefonul la furnizor sau căutarea
 * pe site-ul lui. Iconița apare la hover; după copiere, o bifă scurtă.
 */
export function CopyCode({ code, className = "" }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className={`group inline-flex items-center gap-1.5 rounded-md text-left hover:text-[#2563eb] ${className}`}
      title="Copiază codul"
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocat (http, permisiuni): codul rămâne de selectat de mână.
        }
      }}
    >
      {code}
      {copied ? (
        <Check className="size-3.5 text-[#16a34a]" aria-label="Copiat" />
      ) : (
        <Copy className="size-3.5 text-[#a1a1aa] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
      )}
    </button>
  );
}
