"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Câte panouri cer în acest moment pagina blocată. */
let locks = 0;
/** Valoarea de dinaintea PRIMEI blocări — singura care trebuie pusă la loc. */
let restore = "";

/**
 * Blocarea scrollului e numărată, nu salvată/refăcută naiv: cu un dialog
 * deschis peste altul (creare de produs din vânzare), primul care se închide
 * ar fi redat scrollul paginii deși al doilea panou e încă pe ecran — și,
 * mai rău, ar fi scris „hidden" ca valoare „de dinainte".
 *
 * `body` vine ca parametru ca să poată fi verificată fără DOM.
 */
export function lockBodyScroll(body: { style: { overflow: string } }) {
  if (locks === 0) {
    restore = body.style.overflow;
    body.style.overflow = "hidden";
  }
  locks += 1;

  let released = false;
  return () => {
    // Contorul e stare partajată: o eliberare chemată de două ori l-ar strica
    // pe veci (pagina ar rămâne blocată sau s-ar debloca prea devreme).
    if (released) return;
    released = true;
    locks -= 1;
    if (locks === 0) body.style.overflow = restore;
  };
}

export function DrawerPortal({
  children,
  /** false = panoul e montat dar ascuns (ciornă păstrată): pagina rămâne scrolabilă. */
  locked = true,
}: {
  children: ReactNode;
  locked?: boolean;
}) {
  useEffect(() => {
    if (!locked) return;
    return lockBodyScroll(document.body);
  }, [locked]);

  return createPortal(children, document.body);
}
