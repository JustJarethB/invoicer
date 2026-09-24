import { type AppEvent, type EventBus, eventBus, type EventSeverity, publishError, type Unsubscribe } from "~/utils/events";
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
let rejectionCapture: Unsubscribe | undefined;

export const registerEventLogging = (bus: EventBus = eventBus): Unsubscribe => {
  logSink?.();
  logSink = bus.subscribe(logEvent, undefined, { replayable: false });
  return logSink;
};

export const registerGlobalErrorCapture = (bus: EventBus = eventBus): Unsubscribe => {
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
