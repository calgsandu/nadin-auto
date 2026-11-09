import {
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarRange,
  Car,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileText,
  Files,
  Handshake,
  History,
  Layers,
  MapPin,
  PackagePlus,
  PackageSearch,
  PackageX,
  Percent,
  PieChart,
  Receipt,
  ScrollText,
  Shapes,
  ShieldCheck,
  ShoppingCart,
  Tag,
  TrendingUp,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { createElement } from "react";
import { navigationEntries, type MenuIconName, type WorkspaceSectionId } from "@/lib/operations/workspace";

/** Iconițele din meniu, după numele din `navigationEntries` / `navigationGroups`. */
export const menuIcons: Record<MenuIconName, LucideIcon> = {
  ArrowRightLeft,
  BadgeCheck,
  BarChart3,
  Boxes,
  CalendarCheck,
  CalendarRange,
  Car,
  ClipboardCheck,
  ClipboardList,
  Factory,
  Files,
  Handshake,
  History,
  Layers,
  MapPin,
  PackagePlus,
  PackageSearch,
  PackageX,
  Percent,
  PieChart,
  Receipt,
  ScrollText,
  Shapes,
  ShieldCheck,
  ShoppingCart,
  Tag,
  TrendingUp,
  Truck,
  Undo2,
  UserCog,
  Users,
  Wallet,
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
