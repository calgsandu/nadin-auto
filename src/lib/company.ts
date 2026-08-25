/**
 * Datele firmei pentru documentele oficiale (facturi, registre).
 * Completează IDNO/adresa reale înainte de a folosi documentele fiscal.
 */
export const COMPANY = {
  name: "CAROS",
  legalName: "«NADIN AUTO» S.R.L.",
  idno: "1017600020085",
  vatCode: "0612067",
  address: "str. Ginta Latină 15/2, ap. 85, mun. Chișinău",
  phone: "—",
  iban: "MD59AG000000022513141479",
  bankName: "BC Moldova-Agroindbank S.A., sucursala 5 Chișinău",
  bankCode: "AGRNMD2X435",
  director: "Calugareanu Gh.",
  chiefAccountant: "Calugareanu N.",
  vatRate: 0.2, // TVA 20% — cota standard în Republica Moldova
  /**
   * Firma e plătitoare de TVA? Dacă NU (false), rândurile de TVA dispar din
   * facturi, registru și UI — confirmă cu contabilul înainte de a schimba.
   */
  vatPayer: true,
} as const;

/**
 * Prețurile sunt cu TVA inclus, deci TVA se extrage din total, nu se adaugă:
 * la cota de 20% asta înseamnă total ÷ 6.
 */
export function vatFromGross(totalGross: number, vatRate: number = COMPANY.vatRate) {
  const tva = Math.round((totalGross * (vatRate / (1 + vatRate))) * 100) / 100;
  return { tva, net: Math.round((totalGross - tva) * 100) / 100 };
}
