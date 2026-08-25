type PaymentAccountState = {
  cancelledAt: Date | null;
  fulfilledAt: Date | null;
  paidAt: Date | null;
};

function assertActive(account: PaymentAccountState) {
  if (account.cancelledAt) throw new Error("Contul de plată este anulat.");
}

export function assertCanMarkPaymentAccountPaid(account: PaymentAccountState) {
  assertActive(account);
  if (account.paidAt) throw new Error("Contul de plată este deja achitat.");
}

export function assertCanFulfillPaymentAccount(account: PaymentAccountState) {
  assertActive(account);
  if (account.fulfilledAt) throw new Error("Marfa este deja predată pentru acest cont.");
}

/**
 * `refunded` = operatorul confirmă că banii se dau înapoi; anularea scrie
 * atunci și rambursarea, ca încasarea să nu rămână atârnată în registru.
 *
 * Fără asta, un cont achitat dar nelivrat era fundătură: nu-l puteai nici
 * anula, nici stinge.
 */
export function assertCanCancelPaymentAccount(
  account: PaymentAccountState,
  refunded = false,
) {
  assertActive(account);
  // Marfa predată se întoarce printr-un retur pe vânzare, nu prin anularea contului.
  if (account.fulfilledAt) {
    throw new Error("Contul nu poate fi anulat după ce marfa a fost predată.");
  }
  if (account.paidAt && !refunded) {
    throw new Error(
      "Contul achitat nu poate fi anulat fără o rambursare înregistrată.",
    );
  }
}
