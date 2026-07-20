"use client";

import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

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
      title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
      className="motion-nav-link flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#6f6b63] hover:bg-[#f6f6f4] hover:text-[#1b1a17]"
    >
      {collapsed ? (
        <PanelLeftOpen className="size-4 shrink-0 text-[#98948b]" aria-hidden="true" />
      ) : (
        <PanelLeftClose className="size-4 shrink-0 text-[#98948b]" aria-hidden="true" />
      )}
      <span className="crm-nav-label whitespace-nowrap">
        {collapsed ? "Extinde" : "Restrânge"}
      </span>
    </button>
  );
}
