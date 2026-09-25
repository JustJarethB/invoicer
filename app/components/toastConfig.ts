export const TOAST_SEVERITIES = ["error", "warning", "info", "success"] as const;

export type ToastSeverity = (typeof TOAST_SEVERITIES)[number];

export const TOAST_DURATIONS: Partial<Record<ToastSeverity, number>> = {
  success: 4000,
  info: 5000,
  warning: 8000,
};

export const MAX_TOASTS = 5;

let toastCounter = 0;

export const nextToastId = (): string => {
  toastCounter += 1;
  return `toast-${toastCounter}`;
};
