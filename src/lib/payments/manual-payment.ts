export type ManualPaymentMethodId = "bkash" | "touchngo" | "ebl" | "maybank";

export type ManualPaymentMethod = {
  id: ManualPaymentMethodId;
  name: string;
  logoSrc?: string;
  accountLabel: string;
  accountNumber: string;
  qrSrc?: string;
  accentClass: string;
  numberClass: string;
  wordmark?: string;
};

export const MANUAL_PAYMENT_METHODS: ManualPaymentMethod[] = [
  {
    id: "bkash",
    name: "bKash",
    accountLabel: "Send money to this bKash Personal number:",
    accountNumber: "01783571677",
    qrSrc: "/Payment%20methods/bkash_qr.jpeg",
    accentClass: "manual-pay__method--bkash",
    numberClass: "manual-pay__number--bkash",
    wordmark: "bKash",
  },
  {
    id: "touchngo",
    name: "Touch n Go",
    accountLabel: "Send money to this Touch n Go number:",
    accountNumber: "161651528898",
    qrSrc: "/Payment%20methods/tng_qr.jpeg",
    accentClass: "manual-pay__method--touchngo",
    numberClass: "manual-pay__number--touchngo",
    wordmark: "Touch n Go eWallet",
  },
  {
    id: "ebl",
    name: "EBL",
    logoSrc: "/Payment%20methods/ebl.png",
    accountLabel: "Transfer to this EBL card number:",
    accountNumber: "4520 1724 0843 2466",
    accentClass: "manual-pay__method--ebl",
    numberClass: "manual-pay__number--ebl",
  },
  {
    id: "maybank",
    name: "Maybank",
    logoSrc: "/Payment%20methods/maybank.png",
    accountLabel: "Transfer to this Maybank card number or scan QR code:",
    accountNumber: "4283 3221 5742 5834",
    qrSrc: "/Payment%20methods/maybank_qr.jpeg",
    accentClass: "manual-pay__method--maybank",
    numberClass: "manual-pay__number--maybank",
  },
] as const;

export function getManualPaymentMethod(methodId: string | null | undefined) {
  return MANUAL_PAYMENT_METHODS.find((method) => method.id === methodId) ?? MANUAL_PAYMENT_METHODS[0];
}

export function formatExamPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}
