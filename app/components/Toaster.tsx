import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { type AppEvent, type EventBus, eventBus } from "~/utils/events";
import { MAX_TOASTS, nextToastId, TOAST_DURATIONS, TOAST_SEVERITIES, type ToastSeverity } from "./toastConfig";

/**
 * Toast notification surface — a pure event-harness subscriber.
 *
 * The component subscribes to the app-wide bus (or an injected one) with a
 * severity filter that excludes `debug`, and renders one dismissible toast
 * per delivered event. All publish-side behaviour lives with the publishers;
 * this file only consumes.
 *
 * Accessibility: two live regions pre-exist on mount (assertive for
 * error/warning, polite for info/success) because live regions only announce
 * reliably when they exist in the DOM before content is inserted. With no
 * toasts the regions are empty and paint nothing, so e2e snapshots are
 * unaffected. Individual toasts carry no `role` — a nested live region would
 * be an anti-pattern; the container's `aria-live` does the announcing.
 *
 * Keyboard: Escape dismisses the toast whose dismiss button holds focus —
 * the keydown bubbles from the button to the toast's own handler, which
 * stops propagation so the same keypress never reaches a document-level
 * Escape listener such as `Modal`'s. A toast can coexist with an open modal
 * (e.g. payment.rejected publishes an error toast while the payment modal
 * deliberately stays open), so one Escape press must dismiss only the
 * focused toast. The dismiss button is the toast's tab target; the toast div
 * itself stays out of the tab order (an unnamed generic tab stop is an
 * accessibility defect).
 *
 * Errors have no auto-dismiss duration and stay until dismissed manually;
 * every other severity auto-dismisses after its configured delay (see
 * toastConfig.ts).
 *
 * Known dev-only quirk: under React StrictMode the double effect-run can
 * consume replayed non-error toasts on the first pass and clear their timers
 * on teardown, so a replayed auto-dismiss toast may linger in dev
 * StrictMode. Production runs the effect once, so replayed toasts get their
 * timers as normal. Do not "fix" this by scheduling timers inside the
 * setState updater — updater side effects are double-invoked under
 * StrictMode; the idempotent-dismiss design here is the correct shape.
 */

export type Toast = {
  id: string;
  severity: ToastSeverity;
  message: string;
};

export type ToasterProps = {
  /** Event source to subscribe to; defaults to the app-wide singleton. */
  bus?: EventBus;
};

export const Toaster = ({ bus = eventBus }: ToasterProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    // Idempotent: a timer firing for an already-evicted toast is a no-op.
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    // Capture the Map once: the cleanup must close over a stable local, not
    // `timers.current` (react-hooks/exhaustive-deps).
    const activeTimers = timers.current;
    const onEvent = (event: AppEvent) => {
      // The subscription filter already restricts delivery to display severities.
      const toast: Toast = { id: nextToastId(), severity: event.severity as ToastSeverity, message: event.message };
      // Cap-slice inside the updater keeps the stack bounded under event
      // storms; the oldest toasts are evicted first (FIFO).
      setToasts((prev) => {
        const next = [...prev, toast];
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
      });
      const duration = TOAST_DURATIONS[event.severity as ToastSeverity];
      if (duration !== undefined) {
        activeTimers.set(
          toast.id,
          setTimeout(() => dismiss(toast.id), duration)
        );
      }
    };

    const unsubscribe = bus.subscribe(onEvent, { severities: [...TOAST_SEVERITIES] });
    return () => {
      unsubscribe();
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, [bus, dismiss]);

  const urgent = toasts.filter((toast) => toast.severity === "error" || toast.severity === "warning");
  const calm = toasts.filter((toast) => toast.severity === "info" || toast.severity === "success");

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 print:hidden">
      <div aria-live="assertive" data-testid="toast-region-assertive" className="flex flex-col gap-2">
        {urgent.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
      <div aria-live="polite" data-testid="toast-region-polite" className="flex flex-col gap-2">
        {calm.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </div>
  );
};

const TOAST_ICONS: Record<ToastSeverity, ComponentType<{ className?: string }>> = {
  error: XCircleIcon,
  warning: ExclamationTriangleIcon,
  success: CheckCircleIcon,
  info: InformationCircleIcon,
};

const TOAST_ICON_COLORS: Record<ToastSeverity, string> = {
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-500 dark:text-amber-400",
  success: "text-green-600 dark:text-green-400",
  info: "text-blue-600 dark:text-blue-400",
};

type ToastItemProps = {
  toast: Toast;
  onDismiss: (id: string) => void;
};

const ToastItem = ({ onDismiss, toast }: ToastItemProps) => {
  const Icon = TOAST_ICONS[toast.severity];
  return (
    <div
      data-testid="toast-item"
      data-severity={toast.severity}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // Dismissing a toast must not also trigger document-level Escape
          // listeners (Modal closes on Escape at document level), and the two
          // can be open at the same time (payment.rejected keeps its modal
          // open while surfacing an error toast).
          event.stopPropagation();
          onDismiss(toast.id);
        }
      }}
      className="pointer-events-auto flex items-start gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-800"
    >
      <Icon className={`h-5 w-5 shrink-0 ${TOAST_ICON_COLORS[toast.severity]}`} />
      <p className="flex-1 text-sm text-gray-900 dark:text-gray-100">{toast.message}</p>
      <button
        type="button"
        aria-label={`Dismiss ${toast.severity} message`}
        onClick={() => onDismiss(toast.id)}
        className="rounded p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
};
