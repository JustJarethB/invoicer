import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { type AppEvent, type EventBus, eventBus } from "~/utils/events";
import { MAX_TOASTS, nextToastId, TOAST_DURATIONS, TOAST_SEVERITIES, type ToastSeverity } from "./toastConfig";

export type Toast = {
  id: string;
  severity: ToastSeverity;
  message: string;
};

export type ToasterProps = {
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
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const activeTimers = timers.current;
    const onEvent = (event: AppEvent) => {
      const toast: Toast = { id: nextToastId(), severity: event.severity as ToastSeverity, message: event.message };
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
