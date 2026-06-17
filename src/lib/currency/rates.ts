export type ExchangeRates = {
  /** Lei (MDL) for 1 EUR. */
  EUR: number;
  /** Lei (MDL) for 1 USD. */
  USD: number;
  updatedAt: string;
  source: "live" | "fallback";
};

// Used if the live API is unreachable (offline dev, rate-limit, etc.).
const FALLBACK: Omit<ExchangeRates, "source"> = { EUR: 19.5, USD: 18.0, updatedAt: "" };

/**
 * Live MDL exchange rates (lei per 1 unit of foreign currency). Base = MDL.
 * Cached 1h via Next fetch revalidation; falls back to static rates on failure.
 */
export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/MDL", {
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      const eur = json.rates?.EUR;
      const usd = json.rates?.USD;
      if (eur && usd) {
        return {
          EUR: 1 / eur,
          USD: 1 / usd,
          updatedAt: json.time_last_update_utc ?? "",
          source: "live",
        };
      }
    }
  } catch {
    // fall through to fallback rates
  }
  return { ...FALLBACK, source: "fallback" };
}

/** Convert an amount in lei (MDL) to the target currency. */
export function convertFromLei(
  amountLei: number,
  currency: "MDL" | "EUR" | "USD",
  rates: ExchangeRates,
): number {
  if (currency === "MDL") return amountLei;
  return amountLei / rates[currency];
}
