"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);

  return createPortal(children, document.body);
}
