import { type AppEvent, errorMessage, type EventBus, eventBus, type EventSeverity, publishError, type Unsubscribe } from "~/utils/events";
import { logger } from "~/utils/logger";

const logBySeverity: Record<EventSeverity, (message: string, context?: unknown) => void> = {
  debug: (message, context) => logger.debug(message, context),
  info: (message, context) => logger.info(message, context),
  success: (message, context) => logger.success(message, context),
  warning: (message, context) => logger.warn(message, context),
  error: (message, context) => logger.error(message, context),
};

const logEvent = (event: AppEvent): void => {
  logBySeverity[event.severity](`[${event.type}] ${event.message}`, event.context);
};

let logSink: Unsubscribe | undefined;
let globalErrorCapture: Unsubscribe | undefined;

export const registerEventLogging = (bus: EventBus = eventBus): Unsubscribe => {
  logSink?.();
  logSink = bus.subscribe(logEvent, undefined, { replayable: false });
  return logSink;
};

export const registerGlobalErrorCapture = (bus: EventBus = eventBus): Unsubscribe => {
  if (typeof window === "undefined") return () => {};
  const target = window;
  globalErrorCapture?.();
  globalErrorCapture = undefined;
  const rejectionListener = (event: PromiseRejectionEvent): void => {
    publishError(bus, { type: "app", context: { action: "unhandled-rejection", boundary: "global" } }, event.reason);
  };
  const runtimeErrorListener = (event: ErrorEvent): void => {
    if (!(event instanceof ErrorEvent)) return;
    const capturedError = event.error ?? event.message;
    publishError(
      bus,
      {
        type: "app",
        message: errorMessage(capturedError).trim() || "Uncaught browser runtime error",
        context: {
          action: "uncaught-error",
          boundary: "global",
          ...(event.filename ? { filename: event.filename } : {}),
          ...(event.lineno !== 0 ? { line: event.lineno } : {}),
          ...(event.colno !== 0 ? { column: event.colno } : {}),
        },
      },
      capturedError
    );
  };
  let active = true;
  const unsubscribe = (): void => {
    if (!active) return;
    active = false;
    target.removeEventListener("unhandledrejection", rejectionListener);
    target.removeEventListener("error", runtimeErrorListener);
    if (globalErrorCapture === unsubscribe) globalErrorCapture = undefined;
  };
  target.addEventListener("unhandledrejection", rejectionListener);
  target.addEventListener("error", runtimeErrorListener);
  globalErrorCapture = unsubscribe;
  return unsubscribe;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    logSink?.();
    logSink = undefined;
    globalErrorCapture?.();
    globalErrorCapture = undefined;
  });
}
