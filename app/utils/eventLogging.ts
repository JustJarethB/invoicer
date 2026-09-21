import { type AppEvent, type EventBus, type EventSeverity, eventBus, type Unsubscribe } from "~/utils/events";
import { logger } from "~/utils/logger";

// One row per severity (coding-practices §2.1): the log sink mirrors the
// harness's severity vocabulary onto consola's method names, 1:1. consola's
// prod level (1) still passes `warn` through, so storage diagnostics keep
// their production visibility.
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

let active: Unsubscribe | undefined;

/**
 * Subscribe the console log sink to the event bus. Publishers publish once;
 * diagnostics reach both the UI surfaces and the console from this single
 * channel. The sink opts out of replay: it sees live events only, so the
 * queue-and-replay contract for UI surfaces (Toaster) stays intact.
 */
export const registerEventLogging = (bus: EventBus = eventBus): Unsubscribe => {
  active?.();
  active = bus.subscribe(logEvent, undefined, { replayable: false });
  return active;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    active?.();
    active = undefined;
  });
}
