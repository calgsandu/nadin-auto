export type WorkspaceSectionId =
  | "produse"
  | "receptii"
  | "transferuri"
  | "vanzari"
  | "la-comanda"
  | "conturi-plata"
  | "retururi"
  | "de-adus"
  | "fara-stoc"
  | "inventar"
  | "depozite"
  | "furnizori"
  | "clienti"
  | "personal"
  | "branduri"
  | "modele"
  | "tipuri"
  | "compatibilitati"
  | "documente"
  | "aprobari"
  | "istoric"
  | "rapoarte"
  | "statistici"
  | "inchidere-zi"
  | "tva"
  | "preturi";

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
    id: "la-comanda",
    title: "Comenzi la furnizori",
    description:
      "Piese aduse la comandă de la furnizori parteneri, fără a intra în catalogul propriu.",
  },
  {
    id: "conturi-plata",
    title: "Conturi de plată",
    description: "Emite proforme, urmărește achitarea și predarea mărfii.",
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
    description: "Furnizorii de la care se aprovizionează marfa. Clienții au secțiunea lor.",
  },
  {
    id: "clienti",
    title: "Clienți",
    description: "Ce a cumpărat fiecare client, cât a plătit, ce datorează și ce discount are.",
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
    id: "aprobari",
    title: "Aprobări operațiuni",
    description: "Operațiunile angajaților care așteaptă confirmarea directorului.",
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
  {
    id: "inchidere-zi",
    title: "Închidere de zi",
    description: "Cât s-a încasat azi și cum s-a plătit.",
  },
  {
    id: "tva",
    title: "Registrul TVA",
    description: "TVA colectată pe luni, din vânzări și retururi.",
  },
  {
    id: "preturi",
    title: "Istoric prețuri",
    description: "Când și cu cât s-a schimbat costul sau prețul de vânzare.",
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
    section: "la-comanda",
    label: "Comenzi la furnizori",
    description: "Piese aduse de la furnizori parteneri",
    icon: "PackagePlus",
  },
  {
    section: "conturi-plata",
    label: "Proforme",
    description: "Proforme și achitări",
    icon: "FileText",
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
    description: "Furnizori de aprovizionare",
    icon: "Handshake",
  },
  {
    section: "clienti",
    label: "Clienți",
    description: "Cumpărături, datorii, discount",
    icon: "Users",
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
    section: "aprobari",
    label: "Aprobări",
    description: "Operațiuni de confirmat",
    icon: "ClipboardList",
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
  {
    section: "inchidere-zi",
    label: "Închidere de zi",
    description: "Încasări pe zi",
    icon: "CalendarRange",
  },
  {
    section: "tva",
    label: "Registrul TVA",
    description: "TVA pe luni",
    icon: "FileText",
  },
  {
    section: "preturi",
    label: "Istoric prețuri",
    description: "Schimbări de cost și preț",
    icon: "Tag",
  },
];

type NavGroupIcon =
  | "ShoppingCart"
  | "Boxes"
  | "Layers"
  | "Handshake"
  | "ShieldCheck"
  | "BarChart3"
  | "ArrowRightLeft";

export type NavGroup = {
  id: string;
  label: string;
  description: string;
  icon: NavGroupIcon;
  sections: WorkspaceSectionId[];
  /**
   * "list": pe desktop sidebar-ul arată fiecare secțiune a grupului, deci
   * grupul n-are nevoie de sub-tab-uri. "tabs": grupurile folosite rar
   * (rapoarte, nomenclatoare, administrare) ocupă un singur rând în sidebar
   * și își arată secțiunile ca sub-tab-uri sus.
   */
  display: "list" | "tabs";
  /** Folosit rar: stă jos în sidebar, după o linie despărțitoare. */
  rare?: boolean;
};

/**
 * Sidebar-ul, cât mai scurt: ce se face zilnic (vânzări, produse) e la vedere,
 * câte o secțiune pe rând; restul stă strâns câte un rând pe grup, cu
 * secțiunile ca tab-uri sus.
 *
 * Vizibilitatea pe rol vine din `canViewSection`: un grup fără nicio secțiune
 * vizibilă dispare singur (ANGAJAT vede Azi, Vânzări și Produse).
 */
export const navigationGroups: NavGroup[] = [
  {
    id: "stoc",
    label: "Produse",
    description: "Catalogul cu stocul",
    icon: "Boxes",
    sections: ["produse"],
    display: "list",
  },
  {
    id: "zi",
    label: "Zi de zi",
    description: "Vânzări, proforme, comenzi, retururi",
    icon: "ShoppingCart",
    sections: ["vanzari", "conturi-plata", "la-comanda", "retururi"],
    display: "list",
  },
  {
    id: "miscari",
    label: "Stoc",
    description: "Recepții, transferuri, inventar, documente",
    icon: "ArrowRightLeft",
    sections: ["receptii", "transferuri", "inventar", "de-adus", "fara-stoc", "documente"],
    display: "tabs",
  },
  {
    id: "furnizori",
    label: "Parteneri",
    description: "Clienți și furnizori",
    icon: "Handshake",
    sections: ["clienti", "furnizori"],
    display: "tabs",
  },
  {
    id: "rapoarte",
    label: "Rapoarte",
    description: "Situații & vânzări",
    icon: "BarChart3",
    sections: ["rapoarte", "statistici", "inchidere-zi", "tva", "preturi"],
    display: "tabs",
    rare: true,
  },
  {
    id: "nomenclatoare",
    label: "Nomenclatoare",
    description: "Branduri, modele, tipuri, depozite",
    icon: "Layers",
    sections: ["branduri", "modele", "tipuri", "compatibilitati", "depozite"],
    display: "tabs",
    rare: true,
  },
  {
    id: "control",
    label: "Administrare",
    description: "Aprobări, istoric, personal",
    icon: "ShieldCheck",
    sections: ["aprobari", "istoric", "personal"],
    display: "tabs",
    rare: true,
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
