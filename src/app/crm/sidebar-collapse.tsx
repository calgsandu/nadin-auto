"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

const STORAGE_KEY = "nadin-crm-collapsed";

function getCollapsedSnapshot() {
  return document.documentElement.hasAttribute("data-crm-collapsed");
}

function getCollapsedServerSnapshot() {
  return false;
}

function subscribeToCollapsedState(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-crm-collapsed"],
  });

  const syncFromStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    document.documentElement.toggleAttribute("data-crm-collapsed", event.newValue === "1");
  };
  window.addEventListener("storage", syncFromStorage);

  return () => {
    observer.disconnect();
    window.removeEventListener("storage", syncFromStorage);
  };
}

function toggleCollapsed() {
  const root = document.documentElement;
  const next = !root.hasAttribute("data-crm-collapsed");
  // La deschidere etichetele apar abia după ce meniul s-a lățit (vezi
  // `data-crm-expanding` în globals.css), nu tăiate cu „…" pe parcurs.
  if (!next) {
    root.setAttribute("data-crm-expanding", "");
    window.setTimeout(() => root.removeAttribute("data-crm-expanding"), 450);
  }
  root.toggleAttribute("data-crm-collapsed", next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // ponytail: localStorage blocked = preference just doesn't persist
  }
}

/** Ctrl/⌘+B oriunde, „[" când nu scrii într-un câmp. */
function onShortcut(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable;
  const hit =
    ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "b" && !target.isContentEditable) ||
    (event.key === "[" && !typing && !event.ctrlKey && !event.metaKey && !event.altKey);
  if (!hit || !window.matchMedia("(min-width: 1024px)").matches) return;
  event.preventDefault();
  toggleCollapsed();
}

export function SidebarCollapseButton() {
  const collapsed = useSyncExternalStore(
    subscribeToCollapsedState,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  const label = `${collapsed ? "Extinde meniul" : "Restrânge meniul"} (Ctrl+B)`;

  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      aria-keyshortcuts="Control+B"
      className="motion-nav-link grid size-8 shrink-0 place-items-center rounded-md text-[#64748b] hover:bg-[#f1f4f9] hover:text-[#0f172a]"
    >
      {collapsed ? (
        <ChevronsRight className="size-4" aria-hidden="true" />
      ) : (
        <ChevronsLeft className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
