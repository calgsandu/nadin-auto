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
    <div className="motion-card rounded-lg border border-[#d8d2c6] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#68746d]">Valoare stoc (preț vânzare)</p>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
          className="h-8 rounded-md border border-[#d8d2c6] bg-white px-2 text-sm outline-none"
        >
          <option value="MDL">MDL (lei)</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold text-[#1d2521]">{format(converted, currency)}</p>
      <div className="mt-3 border-t border-[#e7e2d8] pt-3 text-xs text-[#68746d]">
        <p className="font-semibold text-[#2f3a34]">Curs valutar {rates.source === "live" ? "(live)" : "(aproximativ)"}</p>
        <p className="mt-1">1 EUR = {rates.EUR.toFixed(2)} lei · 1 USD = {rates.USD.toFixed(2)} lei</p>
      </div>
    </div>
  );
}
