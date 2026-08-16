"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftKey,
  newToken,
  parseDraft,
  serializeDraft,
} from "@/lib/operations/draft-storage";

/** Cât se așteaptă după ultima tastă înainte de a scrie ciorna. */
const SAVE_DEBOUNCE_MS = 500;
/**
 * Ce înseamnă „operatorul a mai lucrat la document": a scris (`input`), a ales
 * din listă (`change`), a apăsat un buton de rând (`click`) sau a adăugat o
 * linie cu Enter (`keyup`).
 */
const WATCHED_EVENTS = ["input", "change", "click", "keyup"] as const;

export type DrawerDraftBanner = {
  /** Momentul ultimei salvări locale — antetul îl arată discret. */
  savedAt: number | null;
  /** Dat = ciorna a fost recuperată la deschiderea paginii. */
  restoredAt: number | null;
  onDiscard: () => void;
};

/**
 * Ciorna unui drawer, în localStorage. Se citește o singură dată, la montare
 * (deci de regulă înainte ca formularul să existe): liniile intră în state, iar
 * câmpurile de antet se aplică pe DOM când formularul se deschide.
 *
 * `lines` = TOT state-ul controlat de React din formular (linii, discount,
 * clientul ales…). Ce nu e în `lines` trebuie să fie un câmp necontrolat, ca să
 * poată fi restaurat din `fields`.
 */
export function useDrawerDraft<L>({
  kind,
  lines,
  setLines,
  reset,
}: {
  /** Tipul operațiunii: `receipt`, `sale`, `doc-edit:<id>`… (o ciornă per tip). */
  kind: string;
  lines: L;
  setLines: (lines: L) => void;
  /** Golirea formularului, aceeași care rulează după o salvare reușită. */
  reset: () => void;
}) {
  const key = draftKey(kind);
  const [token, setToken] = useState("");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const pendingFields = useRef<Record<string, string[]> | null>(null);
  // Datele și callback-urile se schimbă la fiecare randare; salvarea debounce-uită
  // are nevoie de cele curente, nu de cele din randarea în care a pornit.
  const linesRef = useRef(lines);
  const setLinesRef = useRef(setLines);
  useEffect(() => {
    linesRef.current = lines;
    setLinesRef.current = setLines;
  });

  // Citirea ciornei: o singură dată, la montare. Modul privat sau cota plină
  // aruncă din localStorage — atunci se lucrează pur și simplu fără ciornă.
  /* eslint-disable react-hooks/set-state-in-effect -- ciorna vine dintr-un
     sistem extern (localStorage) și trebuie citită DUPĂ hidratare: pe server nu
     există, deci un state inițializat din ea ar da altceva decât HTML-ul trimis. */
  useEffect(() => {
    let draft = null;
    try {
      draft = parseDraft(window.localStorage.getItem(key), Date.now());
    } catch {
      draft = null;
    }
    setToken(draft?.token ?? newToken());
    if (!draft) return;
    pendingFields.current = draft.fields;
    setSavedAt(draft.savedAt);
    setRestoredAt(draft.savedAt);
    if (draft.lines != null) setLinesRef.current(draft.lines as L);
  }, [key]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Antetul restaurat se aplică abia când formularul se deschide (liniile sunt
  // deja în state de la montare, deci rândurile există în DOM).
  useEffect(() => {
    const fields = pendingFields.current;
    if (!form || !fields) return;
    pendingFields.current = null;
    applyFields(form, fields);
  }, [form]);

  useEffect(() => {
    if (!form || !token) return;
    let timer = 0;
    const write = () => {
      const draft = serializeDraft(new FormData(form), linesRef.current, token);
      try {
        window.localStorage.setItem(key, JSON.stringify(draft));
      } catch {
        return;
      }
      setSavedAt(draft.savedAt);
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(write, SAVE_DEBOUNCE_MS);
    };
    for (const type of WATCHED_EVENTS) form.addEventListener(type, schedule);
    return () => {
      window.clearTimeout(timer);
      for (const type of WATCHED_EVENTS) form.removeEventListener(type, schedule);
    };
  }, [form, token, key]);

  /** Salvare reușită: ciorna dispare, iar următorul document primește token nou. */
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Fără localStorage nu era nimic de șters oricum.
    }
    setToken(newToken());
    setSavedAt(null);
    setRestoredAt(null);
  }, [key]);

  const discard = useCallback(() => {
    clear();
    form?.reset();
    reset();
  }, [clear, form, reset]);

  return {
    /** Se pune pe `<form ref={…}>`. */
    attachForm: setForm,
    /** Se trimite ca `<input type="hidden" name="idempotencyKey">`. */
    token,
    banner: { savedAt, restoredAt, onDiscard: discard } satisfies DrawerDraftBanner,
    clear,
  };
}

/**
 * Pune valorile salvate înapoi în câmpuri, în ordinea din DOM. Câmpurile
 * ascunse sunt controlate de React (produsul ales, id-uri) — valoarea lor vine
 * din state, nu de aici.
 */
function applyFields(form: HTMLFormElement, fields: Record<string, string[]>) {
  for (const [name, values] of Object.entries(fields)) {
    if (/[^a-zA-Z0-9_-]/.test(name)) continue;
    const nodes = form.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(`[name="${name}"]`);
    nodes.forEach((node, index) => {
      const value = values[index];
      if (value === undefined) return;
      if (node instanceof HTMLInputElement && node.type === "hidden") return;
      node.value = value;
    });
  }
}
