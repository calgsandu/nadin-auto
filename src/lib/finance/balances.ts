import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { listMoneyAccounts } from "@/lib/finance/expenses";

export type MoneyEntryKind =
  | "SALE"
  | "RETURN"
  | "PAYMENT_IN"
  | "PAYMENT_OUT"
  | "EXPENSE"
  | "MOVEMENT";

export type MoneyEntry = {
  id: string;
  accountId: string;
  date: Date;
  kind: MoneyEntryKind;
  label: string;
  amountLei: number;
  /** Soldul contului după această mișcare. */
  balanceLei: number;
};

export type AccountBalance = {
  id: string;
  name: string;
  kind: "CASH" | "BANK";
  iban: string | null;
  openingBalanceLei: number;
  openingDate: Date;
  balanceLei: number;
};

/**
 * Toate mișcările de bani, adunate din tabelele care le scriu deja.
 *
 * Soldul NU se ține într-o coloană: o vânzare cash, o încasare și o cheltuială
 * sunt deja scrise, iar copierea lor într-un registru separat ar da două cifre
 * care se pot despărți. Aici se citesc la loc, cu semn.
 *
 * ponytail: vânzările pe card intră în bancă la data vânzării, deși banca
 * decontează cu 1–2 zile mai târziu și reține comision (scris separat ca
 * cheltuială COMISION_CARD). Dacă reconcilierea cu extrasul devine o problemă,
 * următorul pas e importul extrasului bancar, nu o coloană de sold.
 */
function entriesSql(cashAccountId: string, bankAccountId: string) {
  return Prisma.sql`
    -- Vânzări încasate pe loc: numerarul intră în casă, cardul în bancă.
    SELECT d.id,
           CASE WHEN d."paymentMethod" = 'CASH' THEN ${cashAccountId} ELSE ${bankAccountId} END AS account_id,
           d."documentDate" AS entry_date,
           'SALE' AS kind,
           'Vânzare #' || d.number AS label,
           COALESCE(d."totalLei", 0) AS amount
      FROM "StockDocument" d
     WHERE d.type = 'SALE' AND d."paymentMethod" IN ('CASH', 'CARD')

    UNION ALL

    -- Retur: banii pleacă înapoi pe unde au venit, deci după vânzarea sursă.
    SELECT r.id,
           CASE WHEN s."paymentMethod" = 'CASH' THEN ${cashAccountId} ELSE ${bankAccountId} END,
           r."documentDate",
           'RETURN',
           'Retur #' || r.number,
           -COALESCE(r."totalLei", 0)
      FROM "StockDocument" r
      JOIN "StockDocument" s ON s.id = r."sourceDocumentId"
     WHERE r.type = 'RETURN' AND s."paymentMethod" IN ('CASH', 'CARD')

    UNION ALL

    -- Încasări și plăți cu partenerii. Rândurile vechi n-au cont: numerarul e
    -- locul unde au trecut de fapt, deci cad pe casă.
    SELECT p.id,
           COALESCE(p."accountId", ${cashAccountId}),
           p."paidAt",
           CASE WHEN p.direction = 'IN' THEN 'PAYMENT_IN' ELSE 'PAYMENT_OUT' END,
           CASE WHEN p.direction = 'IN' THEN 'Încasare de la ' ELSE 'Plată către ' END || pt.name,
           CASE WHEN p.direction = 'IN' THEN p.amount ELSE -p.amount END
      FROM "PartnerPayment" p
      JOIN "Partner" pt ON pt.id = p."partnerId"

    UNION ALL

    SELECT e.id, e."accountId", e."date", 'EXPENSE', e.description, -e."amountLei"
      FROM "Expense" e

    UNION ALL

    SELECT m.id,
           m."accountId",
           m."date",
           'MOVEMENT',
           -- Fără notiță, rândul poartă numele mișcării, nu valoarea din enum.
           COALESCE(NULLIF(m.notes, ''), CASE m.kind
             WHEN 'DEPUNERE' THEN 'Depunere'
             WHEN 'RETRAGERE' THEN 'Retragere'
             WHEN 'TRANSFER' THEN 'Transfer între conturi'
             WHEN 'ALTA_INCASARE' THEN 'Altă încasare'
             ELSE 'Altă plată' END),
           m."amountLei"
      FROM "MoneyMovement" m`;
}

/**
 * Conturile în care intră vânzările plătite pe loc.
 *
 * ponytail: cu mai multe case sau mai multe conturi bancare, vânzările cad pe
 * primul de fiecare fel. O alegere per depozit ar cere o coloană pe Warehouse;
 * se adaugă atunci când chiar există a doua casă.
 */
async function defaultAccounts() {
  const accounts = await prisma.moneyAccount.findMany({
    where: { active: true },
    select: { id: true, kind: true },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  });

  return {
    cashAccountId: accounts.find((account) => account.kind === "CASH")?.id ?? "",
    bankAccountId: accounts.find((account) => account.kind === "BANK")?.id ?? "",
  };
}

/** Soldul curent al fiecărui cont: sold de pornire plus toate mișcările. */
export async function getAccountBalances(at = new Date()): Promise<AccountBalance[]> {
  const [accounts, { cashAccountId, bankAccountId }] = await Promise.all([
    prisma.moneyAccount.findMany({
      where: { active: true },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        iban: true,
        openingBalanceLei: true,
        openingDate: true,
      },
    }),
    defaultAccounts(),
  ]);
  if (accounts.length === 0) return [];

  // `openingDate` taie mișcările deja cuprinse în soldul de pornire: fără ea,
  // banii dinaintea începerii evidenței s-ar număra de două ori.
  const totals = await prisma.$queryRaw<Array<{ account_id: string; total: number }>>`
    SELECT e.account_id, COALESCE(SUM(e.amount), 0)::float8 AS total
      FROM (${entriesSql(cashAccountId, bankAccountId)}) e
      JOIN "MoneyAccount" a ON a.id = e.account_id
     WHERE e.entry_date <= ${at} AND e.entry_date >= a."openingDate"
     GROUP BY e.account_id`;

  const byAccount = new Map(totals.map((row) => [row.account_id, row.total]));

  return accounts.map((account) => {
    const opening = Number(account.openingBalanceLei);
    const moved = byAccount.get(account.id) ?? 0;
    return {
      ...account,
      openingBalanceLei: opening,
      balanceLei: round(opening + moved),
    };
  });
}

export type CashRegisterFilters = { acc?: string; from?: string; to?: string };

/**
 * Registrul unui cont pe un interval, cu sold cumulat pe fiecare rând.
 *
 * Soldul de pe rând pornește de la soldul de dinaintea intervalului, nu de la
 * zero: altfel „sold la 1 septembrie" ar arăta rulajul lunii, nu banii din casă.
 */
export async function getCashRegisterData(filters: CashRegisterFilters = {}) {
  // Prima deschidere pe o bază goală: casa și contul curent apar singure, ca
  // în Cheltuieli — altfel pagina depindea de care secțiune a fost văzută întâi.
  await listMoneyAccounts();
  const accounts = await getAccountBalances();
  if (accounts.length === 0) {
    return { accounts, account: null, entries: [], openingLei: 0, closingLei: 0, from: null, to: null };
  }

  const account = accounts.find((one) => one.id === filters.acc) ?? accounts[0];
  const { from, to } = rangeBounds(filters);
  const { cashAccountId, bankAccountId } = await defaultAccounts();
  const sql = entriesSql(cashAccountId, bankAccountId);

  const [beforeRows, rows] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COALESCE(SUM(amount), 0)::float8 AS total
        FROM (${sql}) entries
       WHERE account_id = ${account.id}
         AND entry_date < ${from}
         AND entry_date >= ${account.openingDate}`,
    prisma.$queryRaw<
      Array<{ id: string; account_id: string; entry_date: Date; kind: string; label: string; amount: number }>
    >`
      SELECT id, account_id, entry_date, kind, label, amount::float8 AS amount
        FROM (${sql}) entries
       WHERE account_id = ${account.id}
         AND entry_date >= ${from}
         AND entry_date < ${to}
         AND entry_date >= ${account.openingDate}
       ORDER BY entry_date ASC, id ASC`,
  ]);

  const openingLei = round(account.openingBalanceLei + (beforeRows[0]?.total ?? 0));

  let running = openingLei;
  const entries: MoneyEntry[] = rows.map((row) => {
    running = round(running + row.amount);
    return {
      id: row.id,
      accountId: row.account_id,
      date: row.entry_date,
      kind: row.kind as MoneyEntryKind,
      label: row.label,
      amountLei: round(row.amount),
      balanceLei: running,
    };
  });

  return { accounts, account, entries, openingLei, closingLei: running, from, to };
}

export type CashRegisterData = Awaited<ReturnType<typeof getCashRegisterData>>;

/** Intervalul cerut; implicit luna curentă. */
function rangeBounds(filters: CashRegisterFilters) {
  const now = new Date();
  const from = parseDay(filters.from) ?? new Date(now.getFullYear(), now.getMonth(), 1);
  const toDay = parseDay(filters.to);
  // Capătul e exclusiv, deci ziua aleasă în filtru trebuie să intre întreagă.
  const to = toDay ? new Date(toDay.getTime() + 24 * 60 * 60 * 1000) : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from, to };
}

function parseDay(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
