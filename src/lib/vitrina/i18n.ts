export type CatalogLocale = "ro" | "ru";

type CatalogDictionary = {
  nav: { brands: string; categories: string; search: string };
  footer: {
    question: string;
    answer: string;
    search: string;
  };
  common: {
    catalog: string;
    all: string;
    allYears: string;
    fromYear: (year: number) => string;
    present: string;
    parts: (count: number) => string;
    models: (count: number) => string;
    brands: (count: number) => string;
    inStock: string;
    outOfStock: string;
    local: string;
  };
  home: {
    title: string;
    chooseBrand: string;
    categoryTitle: string;
    categoryAccent: string;
    brandsTitle: string;
    explainer: string;
    warehouseAlt: string;
    stats: {
      products: string;
      brands: string;
      models: string;
      categories: string;
    };
    categories: Record<"Prag" | "Aripa" | "Stop", string>;
  };
  search: {
    eyebrow: string;
    title: string;
    description: string;
    placeholder: string;
    button: string;
    results: (count: number) => string;
    emptyQuery: string;
    emptyResults: string;
  };
  product: {
    code: string;
    availability: string;
    compatibility: string;
    category: string;
    notes: string;
    related: string;
    imageAlt: (description: string) => string;
  };
  metadata: {
    title: string;
    description: string;
    searchTitle: string;
    searchDescription: string;
  };
};

const dictionaries: Record<CatalogLocale, CatalogDictionary> = {
  ro: {
    nav: { brands: "Mărci", categories: "Categorii", search: "Caută o piesă" },
    footer: {
      question: "Nu găsești piesa?",
      answer: "Întreabă-ne direct.",
      search: "Caută în catalog",
    },
    common: {
      catalog: "Catalog",
      all: "Toate",
      allYears: "toți anii",
      fromYear: (year) => `din ${year}`,
      present: "prezent",
      parts: (count) => `${count} ${count === 1 ? "piesă" : "piese"}`,
      models: (count) => `${count} ${count === 1 ? "model" : "modele"}`,
      brands: (count) => `${count} ${count === 1 ? "marcă" : "mărci"}`,
      inStock: "În stoc",
      outOfStock: "La comandă",
      local: "Producție locală",
    },
    home: {
      title: "Piese de caroserie pentru mașina ta.",
      chooseBrand: "Alege marca",
      categoryTitle: "Ce ține mașina",
      categoryAccent: "întreagă",
      brandsTitle: "Alege marca. Vezi tot ce avem.",
      explainer:
        "Fiecare piesă din catalog e legată de model și anii de fabricație — alegi mașina și vezi exact ce avem pentru ea.",
      warehouseAlt: "Depozitul Nadin Auto",
      stats: {
        products: "repere în catalog",
        brands: "mărci auto",
        models: "modele acoperite",
        categories: "categorii de piese",
      },
      categories: { Prag: "Praguri", Aripa: "Aripi", Stop: "Optică" },
    },
    search: {
      eyebrow: "Catalog Nadin Auto",
      title: "Caută piesa potrivită.",
      description: "Scrie codul, denumirea piesei, marca sau modelul mașinii.",
      placeholder: "ex. prag Golf 4, aripă Logan, 506584",
      button: "Caută",
      results: (count) => `${count} rezultate`,
      emptyQuery: "Introdu cel puțin două caractere pentru a începe căutarea.",
      emptyResults: "Nu am găsit piese pentru această căutare.",
    },
    product: {
      code: "Cod",
      availability: "Disponibilitate",
      compatibility: "Compatibilitate",
      category: "Categorie",
      notes: "Detalii",
      related: "Piese similare",
      imageAlt: (description) => description,
    },
    metadata: {
      title: "Nadin Auto — Catalog piese de caroserie",
      description:
        "Catalog public Nadin Auto: piese de caroserie pentru 30 de mărci auto — praguri, aripi, panouri, faruri și multe altele.",
      searchTitle: "Caută piese auto — Nadin Auto",
      searchDescription: "Caută piese de caroserie după cod, denumire, marcă sau model.",
    },
  },
  ru: {
    nav: { brands: "Марки", categories: "Категории", search: "Найти деталь" },
    footer: {
      question: "Не нашли нужную деталь?",
      answer: "Свяжитесь с нами.",
      search: "Поиск по каталогу",
    },
    common: {
      catalog: "Каталог",
      all: "Все",
      allYears: "все годы",
      fromYear: (year) => `с ${year} г.`,
      present: "по настоящее время",
      parts: (count) => `${count} ${russianPlural(count, "деталь", "детали", "деталей")}`,
      models: (count) => `${count} ${russianPlural(count, "модель", "модели", "моделей")}`,
      brands: (count) => `${count} ${russianPlural(count, "марка", "марки", "марок")}`,
      inStock: "В наличии",
      outOfStock: "Под заказ",
      local: "Местное производство",
    },
    home: {
      title: "Кузовные детали для вашего автомобиля.",
      chooseBrand: "Выбрать марку",
      categoryTitle: "Всё, что сохраняет автомобиль",
      categoryAccent: "целым",
      brandsTitle: "Выберите марку и посмотрите наш ассортимент.",
      explainer:
        "Каждая деталь связана с моделью и годами выпуска — выберите автомобиль и сразу увидите подходящие позиции.",
      warehouseAlt: "Склад Nadin Auto",
      stats: {
        products: "позиций в каталоге",
        brands: "автомобильных марок",
        models: "моделей автомобилей",
        categories: "категорий деталей",
      },
      categories: { Prag: "Пороги", Aripa: "Крылья", Stop: "Оптика" },
    },
    search: {
      eyebrow: "Каталог Nadin Auto",
      title: "Найдите подходящую деталь.",
      description: "Введите код, название детали, марку или модель автомобиля.",
      placeholder: "например: порог Golf 4, крыло Logan, 506584",
      button: "Найти",
      results: (count) => `${count} ${russianPlural(count, "результат", "результата", "результатов")}`,
      emptyQuery: "Введите не менее двух символов, чтобы начать поиск.",
      emptyResults: "По вашему запросу детали не найдены.",
    },
    product: {
      code: "Код",
      availability: "Наличие",
      compatibility: "Совместимость",
      category: "Категория",
      notes: "Подробности",
      related: "Похожие детали",
      imageAlt: (description) => description,
    },
    metadata: {
      title: "Nadin Auto — Каталог кузовных деталей",
      description:
        "Открытый каталог Nadin Auto: кузовные детали для автомобилей — пороги, крылья, панели, фары и многое другое.",
      searchTitle: "Поиск автозапчастей — Nadin Auto",
      searchDescription: "Поиск кузовных деталей по коду, названию, марке или модели.",
    },
  },
};

export function catalogCopy(locale: CatalogLocale) {
  return dictionaries[locale];
}

export function catalogHref(locale: CatalogLocale, suffix = "") {
  const base = locale === "ru" ? "/ru/catalog" : "/catalog";
  if (!suffix) return base;
  const separator = suffix.startsWith("/") || suffix.startsWith("?") || suffix.startsWith("#") ? "" : "/";
  return `${base}${separator}${suffix}`;
}

export function localeFromCatalogPath(pathname: string): CatalogLocale {
  return pathname === "/ru/catalog" || pathname.startsWith("/ru/catalog/")
    ? "ru"
    : "ro";
}

export function switchCatalogLocale(
  pathname: string,
  search: string,
  targetLocale: CatalogLocale,
) {
  const suffix = pathname.startsWith("/ru/catalog")
    ? pathname.slice("/ru/catalog".length)
    : pathname.startsWith("/catalog")
      ? pathname.slice("/catalog".length)
      : "";
  return `${catalogHref(targetLocale, suffix)}${search}`;
}

export function localizedValue(
  locale: CatalogLocale,
  original: string,
  russian: string | null | undefined,
) {
  const translated = russian?.trim();
  return locale === "ru" && translated ? translated : original;
}

export function catalogNumberFormat(locale: CatalogLocale) {
  return new Intl.NumberFormat(locale === "ru" ? "ru-MD" : "ro-MD");
}

function russianPlural(
  count: number,
  one: string,
  few: string,
  many: string,
) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
