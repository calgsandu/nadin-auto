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
    local: string;
    noPhoto: string;
  };
  model: {
    categories: string;
  };
  picker: {
    byCar: string;
    byText: string;
    brand: string;
    model: string;
    chooseBrand: string;
    chooseModel: string;
    allModels: string;
    show: string;
  };
  home: {
    title: string;
    chooseBrand: string;
    categoriesTitle: string;
    categoriesLead: string;
    brandsTitle: string;
    brandsLead: string;
    popularTitle: string;
    popularLead: string;
    allBrands: string;
    quickSearch: string;
    explainer: string;
    warehouseAlt: string;
    stats: {
      products: string;
      brands: string;
      models: string;
      categories: string;
    };
  };
  search: {
    title: string;
    description: string;
    placeholder: string;
    button: string;
    results: (count: number) => string;
    emptyQuery: string;
    emptyResults: string;
    resultsFor: (count: number, query: string, capped: boolean) => string;
    noResultsFor: (query: string) => string;
    tryCategory: string;
    tryBrand: string;
    clear: string;
  };
  product: {
    code: string;
    availability: string;
    compatibility: string;
    category: string;
    notes: string;
    related: string;
    imageAlt: (description: string) => string;
    car: string;
    years: string;
    referenceImage: string;
    allPartsFor: (model: string) => string;
    searchAnother: string;
    otherPartsFor: string;
    part: string;
  };
  notFound: {
    title: string;
    message: string;
    home: string;
    search: string;
  };
  error: {
    title: string;
    message: string;
    retry: string;
    code: string;
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
      local: "Producție locală",
      noPhoto: "Fără fotografie",
    },
    model: {
      categories: "Categorii de piese",
    },
    picker: {
      byCar: "După mașină",
      byText: "După cod sau denumire",
      brand: "Marca",
      model: "Modelul",
      chooseBrand: "Alege marca",
      chooseModel: "Alege modelul",
      allModels: "Toate modelele",
      show: "Vezi piesele",
    },
    home: {
      title: "Piese de caroserie pentru mașina ta.",
      chooseBrand: "Alege marca",
      categoriesTitle: "Piese după categorie",
      categoriesLead: "Caroserie, optică și accesorii, grupate pe tipuri.",
      brandsTitle: "Alege marca mașinii",
      brandsLead: "Vezi toate modelele și piesele disponibile pentru fiecare marcă.",
      popularTitle: "Modele populare",
      popularLead: "Microbuze, utilitare și autoturisme pentru care avem cele mai multe piese.",
      allBrands: "Toate mărcile",
      quickSearch: "Căutate des:",
      explainer:
        "Fiecare piesă din catalog e legată de model și anii de fabricație — alegi mașina și vezi exact ce avem pentru ea.",
      warehouseAlt: "Depozitul Nadin Auto",
      stats: {
        products: "repere în catalog",
        brands: "mărci auto",
        models: "modele acoperite",
        categories: "categorii de piese",
      },
    },
    search: {
      title: "Caută piesa potrivită.",
      description: "Scrie codul, denumirea piesei, marca sau modelul mașinii.",
      placeholder: "ex. prag Golf 4, aripă Logan, 506584",
      button: "Caută",
      results: (count) => `${count} rezultate`,
      emptyQuery: "Introdu cel puțin două caractere pentru a începe căutarea.",
      emptyResults: "Nu am găsit piese pentru această căutare.",
      resultsFor: (count, query, capped) =>
        `${count}${capped ? "+" : ""} ${count === 1 ? "rezultat" : "rezultate"} pentru „${query}”`,
      noResultsFor: (query) =>
        `Nimic găsit pentru „${query}”. Încearcă un cod, o categorie sau numele modelului.`,
      tryCategory: "Caută după categorie",
      tryBrand: "Sau alege mașina",
      clear: "Șterge",
    },
    product: {
      code: "Cod",
      availability: "Disponibilitate",
      compatibility: "Compatibilitate",
      category: "Categorie",
      notes: "Detalii",
      related: "Piese similare",
      imageAlt: (description) => description,
      car: "Mașina",
      years: "Ani de fabricație",
      referenceImage: "Imagine de referință a categoriei",
      allPartsFor: (model) => `Toate piesele pentru ${model}`,
      searchAnother: "Caută altă piesă",
      otherPartsFor: "Alte piese pentru",
      part: "piesă",
    },
    notFound: {
      title: "Piesa nu mai e aici",
      message: "Linkul e vechi sau piesa nu mai e în catalog.",
      home: "Catalogul",
      search: "Caută piesa",
    },
    error: {
      title: "Catalogul nu răspunde",
      message: "Încearcă din nou peste câteva secunde.",
      retry: "Încearcă din nou",
      code: "Cod",
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
      local: "Местное производство",
      noPhoto: "Нет фото",
    },
    model: {
      categories: "Категории деталей",
    },
    picker: {
      byCar: "По автомобилю",
      byText: "По коду или названию",
      brand: "Марка",
      model: "Модель",
      chooseBrand: "Выберите марку",
      chooseModel: "Выберите модель",
      allModels: "Все модели",
      show: "Показать детали",
    },
    home: {
      title: "Кузовные детали для вашего автомобиля.",
      chooseBrand: "Выбрать марку",
      categoriesTitle: "Детали по категориям",
      categoriesLead: "Кузов, оптика и аксессуары, сгруппированные по типам.",
      brandsTitle: "Выберите марку автомобиля",
      brandsLead: "Все модели и детали, доступные для каждой марки.",
      popularTitle: "Популярные модели",
      popularLead: "Микроавтобусы, коммерческие и легковые автомобили, для которых у нас больше всего деталей.",
      allBrands: "Все марки",
      quickSearch: "Часто ищут:",
      explainer:
        "Каждая деталь связана с моделью и годами выпуска — выберите автомобиль и сразу увидите подходящие позиции.",
      warehouseAlt: "Склад Nadin Auto",
      stats: {
        products: "позиций в каталоге",
        brands: "автомобильных марок",
        models: "моделей автомобилей",
        categories: "категорий деталей",
      },
    },
    search: {
      title: "Найдите подходящую деталь.",
      description: "Введите код, название детали, марку или модель автомобиля.",
      placeholder: "например: порог Golf 4, крыло Logan, 506584",
      button: "Найти",
      results: (count) => `${count} ${russianPlural(count, "результат", "результата", "результатов")}`,
      emptyQuery: "Введите не менее двух символов, чтобы начать поиск.",
      emptyResults: "По вашему запросу детали не найдены.",
      resultsFor: (count, query, capped) =>
        `${count}${capped ? "+" : ""} ${russianPlural(count, "результат", "результата", "результатов")} по запросу «${query}»`,
      noResultsFor: (query) =>
        `По запросу «${query}» ничего не найдено. Попробуйте код, категорию или модель.`,
      tryCategory: "Искать по категории",
      tryBrand: "Или выберите автомобиль",
      clear: "Очистить",
    },
    product: {
      code: "Код",
      availability: "Наличие",
      compatibility: "Совместимость",
      category: "Категория",
      notes: "Подробности",
      related: "Похожие детали",
      imageAlt: (description) => description,
      car: "Автомобиль",
      years: "Годы выпуска",
      referenceImage: "Изображение категории",
      allPartsFor: (model) => `Все детали для ${model}`,
      searchAnother: "Найти другую деталь",
      otherPartsFor: "Другие детали для",
      part: "деталь",
    },
    notFound: {
      title: "Этой детали здесь больше нет",
      message: "Ссылка устарела или детали больше нет в каталоге.",
      home: "Каталог",
      search: "Найти деталь",
    },
    error: {
      title: "Каталог не отвечает",
      message: "Попробуйте ещё раз через несколько секунд.",
      retry: "Попробовать снова",
      code: "Код",
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
