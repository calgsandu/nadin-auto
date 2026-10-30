import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  CalendarRange,
  Car,
  ClipboardList,
  FileText,
  Handshake,
  Layers,
  PackagePlus,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { navigationEntries, type WorkspaceSectionId } from "@/lib/operations/workspace";

/** Iconițele din meniu, după numele din `navigationEntries` / `navigationGroups`. */
export const menuIcons: Record<string, LucideIcon> = {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  CalendarRange,
  Car,
  ClipboardList,
  FileText,
  Handshake,
  Layers,
  PackagePlus,
  PackageSearch,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Users,
  Warehouse,
};

/** Aceeași iconiță ca în meniu — antetul paginii arată unde ești. */
export function sectionIcon(section: WorkspaceSectionId): LucideIcon {
  const name = navigationEntries.find((entry) => entry.section === section)?.icon;
  return (name && menuIcons[name]) || FileText;
}

/** Iconița secțiunii ca element gata de pus în JSX (fără componentă creată la randare). */
export function sectionIconElement(section: WorkspaceSectionId, className: string) {
  return createElement(sectionIcon(section), { className, "aria-hidden": true });
}
