/**
 * Toast surface configuration.
 *
 * Kept in a non-component module so `Toaster.tsx` stays components-only
 * (react-refresh/only-export-components) and so tests can import the
 * durations without mounting React.
 */

/** Display severities the toast surface renders; `debug` is harness-only. */
export const TOAST_SEVERITIES = ["error", "warning", "info", "success"] as const;

export type ToastSeverity = (typeof TOAST_SEVERITIES)[number];

/**
 * Auto-dismiss delay per severity in ms. A severity without an entry stays
 * until dismissed manually — errors never auto-dismiss so they cannot
 * vanish unread.
 */
export const TOAST_DURATIONS: Partial<Record<ToastSeverity, number>> = {
  success: 4000,
  info: 5000,
  warning: 8000,
};

/** Maximum toasts visible at once; the oldest is evicted past this. */
export const MAX_TOASTS = 5;

let toastCounter = 0;

/**
 * Monotonic toast ids: WebCrypto is stubbed deterministically in the test
 * environment, so crypto-based ids would collide across toasts.
 */
export const nextToastId = (): string => {
  toastCounter += 1;
  return `toast-${toastCounter}`;
};
