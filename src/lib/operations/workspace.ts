export type WorkspaceSectionId =
  | "produse"
  | "receptii"
  | "transferuri"
  | "vanzari"
  | "retururi"
  | "de-adus"
  | "fara-stoc"
  | "inventar"
  | "depozite"
  | "furnizori"
  | "personal"
  | "branduri"
  | "modele"
  | "tipuri"
  | "compatibilitati"
  | "documente"
  | "istoric"
  | "rapoarte"
  | "statistici";

type WorkspaceSection = {
  id: WorkspaceSectionId;
  title: string;
  description: string;
};

type NavigationEntry = {
  section: WorkspaceSectionId;
  label: string;
  description: string;
  icon:
    | "PackageSearch"
    | "PackagePlus"
    | "ArrowRightLeft"
    | "ShoppingCart"
    | "ClipboardList"
    | "Warehouse"
    | "Handshake"
    | "Users"
    | "Tag"
    | "Car"
    | "Layers"
    | "CalendarRange"
    | "FileText"
    | "BarChart3";
  /** When true, the nav entry is only shown to ADMIN users. */
  adminOnly?: boolean;
};

export const workspaceSections: WorkspaceSection[] = [
  {
    id: "produse",
    title: "Produse",
    description: "Catalogul produselor și stocul total disponibil.",
  },
  {
    id: "receptii",
    title: "Recepții marfă",
    description: "Adaugă marfă în depozit și consultă recepțiile recente.",
  },
  {
    id: "transferuri",
    title: "Transferuri între depozite",
    description: "Mută produse între locațiile de stoc.",
  },
  {
    id: "vanzari",
    title: "Vânzări",
    description: "Vânzări catalogate pe zile, luni și ani.",
  },
  {
    id: "retururi",
    title: "Retururi",
    description: "Produse returnate din vânzările înregistrate.",
  },
  {
    id: "de-adus",
    title: "De adus în 110A",
    description: "Cantitățile vândute din 110A care trebuie reaprovizionate.",
  },
  {
    id: "fara-stoc",
    title: "Fără stoc 110A",
    description: "Produsele din coada 110A marcate ca indisponibile.",
  },
  {
    id: "inventar",
    title: "Inventar",
    description: "Verifică stocul fizic pe depozit și corectează diferențele.",
  },
  {
    id: "depozite",
    title: "Depozite",
    description: "Locațiile în care este păstrată marfa.",
  },
  {
    id: "furnizori",
    title: "Furnizori",
    description: "Partenerii de la care se aprovizionează marfa.",
  },
  {
    id: "personal",
    title: "Personal",
    description: "Utilizatorii aplicației și rolurile lor.",
  },
  {
    id: "branduri",
    title: "Branduri",
    description: "Mărcile auto din catalog.",
  },
  {
    id: "modele",
    title: "Modele auto",
    description: "Modelele asociate fiecărui brand.",
  },
  {
    id: "tipuri",
    title: "Tipuri produs",
    description: "Categoriile de produse din catalog.",
  },
  {
    id: "compatibilitati",
    title: "Compatibilități",
    description: "Potrivirea produselor pe model și ani.",
  },
  {
    id: "documente",
    title: "Documente stoc",
    description: "Recepții, vânzări, transferuri și ajustări.",
  },
  {
    id: "istoric",
    title: "Istoric modificări",
    description: "Jurnalul creărilor, editărilor și ștergerilor.",
  },
  {
    id: "rapoarte",
    title: "Rapoarte",
    description: "Situații de stoc și vânzări extrase din baza de date.",
  },
  {
    id: "statistici",
    title: "Statistici",
    description: "Totaluri zilnice, săptămânale și lunare pentru vânzări.",
  },
];

export const navigationEntries: NavigationEntry[] = [
  {
    section: "produse",
    label: "Produse",
    description: "Listă și adăugare produse",
    icon: "PackageSearch",
  },
  {
    section: "receptii",
    label: "Recepții",
    description: "Intrări de marfă",
    icon: "PackagePlus",
  },
  {
    section: "transferuri",
    label: "Transferuri",
    description: "Mutări între depozite",
    icon: "ArrowRightLeft",
  },
  {
    section: "vanzari",
    label: "Vânzări",
    description: "Istoric vânzări",
    icon: "ShoppingCart",
  },
  {
    section: "retururi",
    label: "Retururi",
    description: "Produse returnate",
    icon: "ArrowRightLeft",
  },
  {
    section: "de-adus",
    label: "De adus în 110A",
    description: "Produse de reaprovizionat",
    icon: "ClipboardList",
  },
  {
    section: "fara-stoc",
    label: "Fără stoc 110A",
    description: "Indisponibile",
    icon: "ClipboardList",
  },
  {
    section: "inventar",
    label: "Inventar",
    description: "Stoc fizic vs. sistem",
    icon: "ClipboardList",
  },
  {
    section: "depozite",
    label: "Depozite",
    description: "Locații de stoc",
    icon: "Warehouse",
  },
  {
    section: "furnizori",
    label: "Furnizori",
    description: "Parteneri de aprovizionare",
    icon: "Handshake",
  },
  {
    section: "personal",
    label: "Personal",
    description: "Utilizatori și roluri",
    icon: "Users",
    adminOnly: true,
  },
  {
    section: "branduri",
    label: "Branduri",
    description: "Mărci auto",
    icon: "Tag",
  },
  {
    section: "modele",
    label: "Modele auto",
    description: "Modele pe brand",
    icon: "Car",
  },
  {
    section: "tipuri",
    label: "Tipuri produs",
    description: "Categorii produse",
    icon: "Layers",
  },
  {
    section: "compatibilitati",
    label: "Compatibilități",
    description: "Model + ani",
    icon: "CalendarRange",
  },
  {
    section: "documente",
    label: "Documente stoc",
    description: "Istoric mișcări",
    icon: "FileText",
  },
  {
    section: "istoric",
    label: "Istoric modificări",
    description: "Jurnal audit",
    icon: "FileText",
  },
  {
    section: "rapoarte",
    label: "Rapoarte",
    description: "Situații & vânzări",
    icon: "BarChart3",
  },
  {
    section: "statistici",
    label: "Statistici",
    description: "Totaluri & grafice",
    icon: "BarChart3",
  },
];

type NavGroupIcon =
  | "PackageSearch"
  | "ArrowRightLeft"
  | "Layers"
  | "Handshake"
  | "Users"
  | "BarChart3";

export type NavGroup = {
  id: string;
  label: string;
  description: string;
  icon: NavGroupIcon;
  sections: WorkspaceSectionId[];
  adminOnly?: boolean;
};

/** Collapsed sidebar: a handful of groups, each fanning out to sub-tabs. */
export const navigationGroups: NavGroup[] = [
  {
    id: "catalog",
    label: "Produse",
    description: "Catalog și stoc",
    icon: "PackageSearch",
    sections: ["produse"],
  },
  {
    id: "operatiuni",
    label: "Operațiuni",
    description: "Mișcări de stoc",
    icon: "ArrowRightLeft",
    sections: ["receptii", "transferuri", "vanzari", "retururi", "de-adus", "fara-stoc", "inventar", "documente", "istoric"],
  },
  {
    id: "nomenclatoare",
    label: "Nomenclatoare",
    description: "Date de catalog",
    icon: "Layers",
    sections: ["branduri", "modele", "tipuri", "compatibilitati", "depozite"],
  },
  {
    id: "furnizori",
    label: "Furnizori",
    description: "Parteneri",
    icon: "Handshake",
    sections: ["furnizori"],
  },
  {
    id: "personal",
    label: "Personal",
    description: "Utilizatori și roluri",
    icon: "Users",
    sections: ["personal"],
    adminOnly: true,
  },
  {
    id: "rapoarte",
    label: "Rapoarte",
    description: "Situații & vânzări",
    icon: "BarChart3",
    sections: ["rapoarte", "statistici"],
  },
];

export function groupForSection(section: WorkspaceSectionId): NavGroup | undefined {
  return navigationGroups.find((group) => group.sections.includes(section));
}

/** Short tab label for a section (reuses sidebar entry labels). */
export function sectionLabel(section: WorkspaceSectionId): string {
  return navigationEntries.find((entry) => entry.section === section)?.label ?? getSection(section).title;
}

const sectionIds = new Set<WorkspaceSectionId>(
  workspaceSections.map((section) => section.id),
);

export function resolveSection(value: string | string[] | null | undefined) {
  const section = Array.isArray(value) ? value[0] : value;

  return section && sectionIds.has(section as WorkspaceSectionId)
    ? (section as WorkspaceSectionId)
    : "produse";
}

export function getSection(sectionId: WorkspaceSectionId) {
  return workspaceSections.find((section) => section.id === sectionId) ?? workspaceSections[0];
}
