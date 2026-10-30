"use client";

import { useSyncExternalStore } from "react";
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

export function SidebarCollapseButton() {
  const collapsed = useSyncExternalStore(
    subscribeToCollapsedState,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot,
  );

  const toggle = () => {
    const next = !collapsed;
    document.documentElement.toggleAttribute("data-crm-collapsed", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ponytail: localStorage blocked = preference just doesn't persist
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
      title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
      className="motion-nav-link grid size-7 place-items-center rounded-md text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#18181b]"
    >
      {collapsed ? (
        <ChevronsRight className="size-4" aria-hidden="true" />
      ) : (
        <ChevronsLeft className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
