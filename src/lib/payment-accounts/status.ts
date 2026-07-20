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

export function assertCanCancelPaymentAccount(account: PaymentAccountState) {
  assertActive(account);
  if (account.paidAt) {
    throw new Error(
      "Contul achitat nu poate fi anulat fără o rambursare înregistrată.",
    );
  }
  if (account.fulfilledAt) {
    throw new Error("Contul nu poate fi anulat după ce marfa a fost predată.");
  }
}
