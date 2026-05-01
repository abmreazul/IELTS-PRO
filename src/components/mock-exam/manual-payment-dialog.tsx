"use client";

import Image from "next/image";
import { Check, Copy, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { submitPaymentRequest, uploadPaymentProof } from "@/app/(site)/mock-exam/actions";
import type { MockPaymentRequestRow } from "./types";
import {
  formatExamPrice,
  getManualPaymentMethod,
  MANUAL_PAYMENT_METHODS,
  type ManualPaymentMethodId,
} from "@/lib/payments/manual-payment";

/** Currency shown per payment method */
const METHOD_CURRENCIES: Record<ManualPaymentMethodId, string[]> = {
  bkash: ["BDT"],
  touchngo: ["MYR"],
  ebl: ["USD", "BDT", "MYR"],
  maybank: ["USD", "BDT", "MYR"],
};

type Props = {
  examId: string;
  examTitle: string;
  priceUsdCents: number;
  priceBdtCents: number;
  priceMyrCents: number;
  existingRequest: MockPaymentRequestRow | null;
  children?: React.ReactNode;
};

export function ManualPaymentDialog({
  examId,
  examTitle,
  priceUsdCents,
  priceBdtCents,
  priceMyrCents,
  existingRequest,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<ManualPaymentMethodId>(
    existingRequest?.payment_method ?? "bkash",
  );
  const [transactionId, setTransactionId] = useState("");
  const [proofUrl, setProofUrl] = useState(existingRequest?.proof_url ?? "");
  const [proofName, setProofName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, startSubmit] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPayment = useMemo(
    () => getManualPaymentMethod(selectedMethod),
    [selectedMethod],
  );

  // Get prices map
  const priceMap: Record<string, number> = useMemo(() => {
    const m: Record<string, number> = {};
    if (priceUsdCents > 0) m.USD = priceUsdCents;
    if (priceBdtCents > 0) m.BDT = priceBdtCents;
    if (priceMyrCents > 0) m.MYR = priceMyrCents;
    return m;
  }, [priceUsdCents, priceBdtCents, priceMyrCents]);

  // Available currencies for this method
  const availableCurrencies = useMemo(() => {
    const methodCurrencies = METHOD_CURRENCIES[selectedMethod] ?? ["USD"];
    return methodCurrencies.filter((c) => priceMap[c] != null);
  }, [selectedMethod, priceMap]);

  // Selected currency for payment (auto-pick first available)
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");

  // Reset currency when method changes
  useEffect(() => {
    if (availableCurrencies.length > 0 && !availableCurrencies.includes(selectedCurrency)) {
      setSelectedCurrency(availableCurrencies[0]);
    }
  }, [availableCurrencies, selectedCurrency]);

  const currentAmountCents = priceMap[selectedCurrency] ?? 0;
  const amountLabel = formatExamPrice(currentAmountCents, selectedCurrency);

  const canSubmit = transactionId.trim().length > 2 && !isSubmitting && !isUploading;

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(selectedPayment.accountNumber);
      setCopyDone(true);
      window.setTimeout(() => setCopyDone(false), 1500);
    } catch {
      setCopyDone(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  return (
    <>
      {children ? (
        <div role="button" tabIndex={0} onClick={() => setOpen(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true); }} style={{ cursor: 'pointer' }}>
          {children}
        </div>
      ) : (
        <button type="button" className="btn btn-topbar-cta btn-primary" onClick={() => setOpen(true)}>
          Buy now
        </button>
      )}

      {mounted && open
        ? createPortal(
            <div
              className="manual-pay__backdrop"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`manual-pay-title-${examId}`}
              onClick={() => setOpen(false)}
            >
              <div className="manual-pay" onClick={(event) => event.stopPropagation()}>
                <div className="manual-pay__head">
                  <div className="manual-pay__head-copy">
                    <h2 id={`manual-pay-title-${examId}`}>{examTitle}</h2>
                    <p>{amountLabel}</p>
                  </div>
                  <button
                    type="button"
                    className="manual-pay__close"
                    aria-label="Close payment dialog"
                    onClick={() => setOpen(false)}
                  >
                    <X size={20} strokeWidth={2.2} />
                  </button>
                </div>

                <div className="manual-pay__section">
                  <div className="manual-pay__step">
                    <span>1</span>
                    <h3>Choose Payment Method</h3>
                  </div>
                  <div className="manual-pay__methods">
                    {MANUAL_PAYMENT_METHODS.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        className={`manual-pay__method ${method.accentClass}${selectedMethod === method.id ? " is-active" : ""}`}
                        onClick={() => setSelectedMethod(method.id)}
                      >
                        <div className="manual-pay__method-logo">
                          {method.logoSrc ? (
                            <Image src={method.logoSrc} alt={method.name} width={84} height={40} />
                          ) : (
                            <span className="manual-pay__wordmark">{method.wordmark ?? method.name}</span>
                          )}
                        </div>
                        <span>{method.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="manual-pay__panel">
                  <p className="manual-pay__muted">{selectedPayment.accountLabel}</p>
                  <div className="manual-pay__number-row">
                    <div className={`manual-pay__number ${selectedPayment.numberClass}`}>{selectedPayment.accountNumber}</div>
                    <button type="button" className="manual-pay__copy" onClick={handleCopy}>
                      {copyDone ? "Copied" : "Copy"}
                    </button>
                  </div>

                  {/* Currency selector for multi-currency methods */}
                  {availableCurrencies.length > 1 ? (
                    <div className="manual-pay__currency-select">
                      <p className="manual-pay__muted" style={{ marginBottom: "0.5rem" }}>Select currency to pay in:</p>
                      <div className="manual-pay__currency-chips">
                        {availableCurrencies.map((curr) => (
                          <button
                            key={curr}
                            type="button"
                            className={`manual-pay__currency-chip${selectedCurrency === curr ? " is-active" : ""}`}
                            onClick={() => setSelectedCurrency(curr)}
                          >
                            <span className="manual-pay__currency-chip-code">{curr}</span>
                            <span className="manual-pay__currency-chip-amount">{formatExamPrice(priceMap[curr] ?? 0, curr)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Big amount display */}
                  <div className="manual-pay__amount-display">
                    <span className="manual-pay__amount-label">Amount to send</span>
                    <span className="manual-pay__amount-value">{amountLabel}</span>
                  </div>

                  <p className="manual-pay__hint">Send exactly {amountLabel} to this number.</p>
                  {selectedPayment.qrSrc ? (
                    <>
                      <p className="manual-pay__muted manual-pay__muted--qr">Or scan the QR code:</p>
                      <div className="manual-pay__qr-row">
                        <button
                          type="button"
                          className="manual-pay__qr"
                          onClick={() => setShowQrPreview(true)}
                          aria-label={`Open larger ${selectedPayment.name} QR code`}
                        >
                          <Image src={selectedPayment.qrSrc} alt={`${selectedPayment.name} QR code`} width={220} height={220} />
                        </button>
                        <div className="manual-pay__qr-amount">
                          <span className="manual-pay__qr-amount-label">Send</span>
                          <span className="manual-pay__qr-amount-value">{amountLabel}</span>
                          <span className="manual-pay__qr-amount-hint">to this QR</span>
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="manual-pay__section">
                  <div className="manual-pay__step">
                    <span>2</span>
                    <h3>Enter Transaction ID</h3>
                  </div>
                  <input
                    className="manual-pay__input"
                    placeholder="e.g. TXN8A4K2R9"
                    value={transactionId}
                    onChange={(event) => setTransactionId(event.target.value)}
                  />
                </div>

                <div className="manual-pay__section">
                  <div className="manual-pay__step">
                    <span>3</span>
                    <h3>Upload Payment Proof</h3>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      startUpload(async () => {
                        setError(null);
                        setMessage(null);
                        const formData = new FormData();
                        formData.set("file", file);
                        const result = await uploadPaymentProof(formData);
                        if (!result.ok) {
                          setError(result.message ?? "Could not upload payment proof.");
                          return;
                        }
                        setProofUrl(result.url ?? "");
                        setProofName(file.name);
                      });
                    }}
                  />
                  <button
                    type="button"
                    className={`manual-pay__upload${proofUrl ? " is-done" : ""}`}
                    onClick={handleUploadClick}
                    disabled={isUploading}
                  >
                    <Upload size={18} strokeWidth={2} />
                    <span>
                      {isUploading
                        ? "Uploading..."
                        : proofName
                          ? `Uploaded: ${proofName}`
                          : "Click to upload screenshot"}
                    </span>
                  </button>
                </div>

                {existingRequest?.status === "rejected" && existingRequest.admin_note ? (
                  <div className="manual-pay__alert manual-pay__alert--warning">
                    Previous request was rejected: {existingRequest.admin_note}
                  </div>
                ) : null}

                {error ? <div className="manual-pay__alert manual-pay__alert--error">{error}</div> : null}
                {message ? <div className="manual-pay__alert manual-pay__alert--success">{message}</div> : null}

                <button
                  type="button"
                  className="manual-pay__submit"
                  disabled={!canSubmit}
                  onClick={() =>
                    startSubmit(async () => {
                      setError(null);
                      setMessage(null);
                      const result = await submitPaymentRequest({
                        examId,
                        paymentMethod: selectedMethod,
                        transactionId,
                        proofUrl: proofUrl || null,
                        currency: selectedCurrency,
                        amountCents: currentAmountCents,
                      });
                      if (!result.ok) {
                        setError(result.message ?? "Could not submit payment request.");
                        return;
                      }
                      setMessage(result.message ?? "Payment request sent.");
                      setTransactionId("");
                    })
                  }
                >
                  <Check size={18} strokeWidth={2.2} />
                  Submit Order — {amountLabel}
                </button>
              </div>

              {showQrPreview && selectedPayment.qrSrc ? (
                <div
                  className="manual-pay__qr-preview-backdrop"
                  onClick={() => setShowQrPreview(false)}
                >
                  <div
                    className="manual-pay__qr-preview"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="manual-pay__close manual-pay__qr-preview-close"
                      aria-label="Close QR preview"
                      onClick={() => setShowQrPreview(false)}
                    >
                      <X size={20} strokeWidth={2.2} />
                    </button>
                    <Image
                      src={selectedPayment.qrSrc}
                      alt={`${selectedPayment.name} QR code large preview`}
                      width={520}
                      height={520}
                    />
                  </div>
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
