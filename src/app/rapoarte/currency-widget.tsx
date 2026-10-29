"use client";

import { useState } from "react";
import { convertFromLei, type ExchangeRates } from "@/lib/currency/rates";

type Currency = "MDL" | "EUR" | "USD";

function format(value: number, currency: Currency) {
  return new Intl.NumberFormat("ro-MD", { maximumFractionDigits: 2 }).format(value) + " " + currency;
}

export function CurrencyWidget({ valueLei, rates }: { valueLei: number; rates: ExchangeRates }) {
  const [currency, setCurrency] = useState<Currency>("MDL");
  const converted = convertFromLei(valueLei, currency, rates);

  return (
    <div className="motion-card rounded-xl border border-[#e4e4e7] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#52525b]">Valoare stoc (preț vânzare)</p>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className="h-8 rounded-md border border-[#e4e4e7] bg-white px-2 text-sm outline-none"
        >
          <option value="MDL">MDL (lei)</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-[#18181b]">{format(converted, currency)}</p>
      <div className="mt-3 border-t border-[#f0f0f2] pt-3 text-xs text-[#52525b]">
        <p className="font-semibold text-[#3f3f46]" title={rates.reason}>
          Curs valutar {rates.source === "live" ? "(live)" : "(aproximativ)"}
        </p>
        <p className="mt-1">1 EUR = {rates.EUR.toFixed(2)} lei, 1 USD = {rates.USD.toFixed(2)} lei</p>
      </div>
    </div>
  );
}
