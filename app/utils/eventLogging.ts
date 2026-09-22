import { type AppEvent, type EventBus, eventBus, type EventSeverity, publishError, type Unsubscribe } from "~/utils/events";
import { logger } from "~/utils/logger";

// consola's prod level (1) passes `warn` through, so warning-severity
// diagnostics keep their production visibility.
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
let rejectionCapture: Unsubscribe | undefined;

/**
 * Subscribe the console log sink to the event bus. Publishers publish once;
 * diagnostics reach both the UI surfaces and the console from this single
 * channel. The sink opts out of replay: it sees live events only, so the
 * queue-and-replay contract for UI surfaces (Toaster) stays intact.
 */
export const registerEventLogging = (bus: EventBus = eventBus): Unsubscribe => {
  logSink?.();
  logSink = bus.subscribe(logEvent, undefined, { replayable: false });
  return logSink;
};

/**
 * Capture unhandled promise rejections on the bus — the last capture path.
 * An async throw with no local catch escapes every handler catch and every
 * error boundary; only this window-level listener sees it. Rides
 * publishError: the message derives from the rejection reason, and errors a
 * rethrowError site already published dedupe by identity (the WeakSet), so
 * the compose stays exactly-once. Default handling is not prevented — the
 * browser's own console entry keeps the live stack. Idempotent: a
 * re-registration disposes the previous listener (module reload, HMR).
 */
export const registerGlobalErrorCapture = (bus: EventBus = eventBus): Unsubscribe => {
  // Guard first: with no window there is nothing to attach to, and a stale
  // remover would dereference an absent window.
  if (typeof window === "undefined") return () => {};
  const target = window;
  rejectionCapture?.();
  rejectionCapture = undefined;
  const listener = (event: PromiseRejectionEvent): void => {
    publishError(bus, { type: "app", context: { action: "unhandled-rejection", boundary: "global" } }, event.reason);
  };
  let active = true;
  const unsubscribe = (): void => {
    if (!active) return;
    active = false;
    target.removeEventListener("unhandledrejection", listener);
    if (rejectionCapture === unsubscribe) rejectionCapture = undefined;
  };
  target.addEventListener("unhandledrejection", listener);
  rejectionCapture = unsubscribe;
  return unsubscribe;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    logSink?.();
    logSink = undefined;
    rejectionCapture?.();
    rejectionCapture = undefined;
  });
}
