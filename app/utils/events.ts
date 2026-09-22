import { logger } from "~/utils/logger";

/**
 * App-wide event harness.
 *
 * Events published while no replay-capable subscriber exists are queued and
 * replayed to the first replay-capable subscriber (oldest first, through its
 * filter, then discarded): Invoicer boots with client loaders that can
 * surface events before any UI surface has mounted, and those events are
 * worth showing once a surface exists. Later subscribers do not receive
 * history. Non-replayable sinks (the boot-time log sink) receive live events
 * but never drain the buffer; buffering re-arms whenever no replay-capable
 * subscriber remains.
 *
 * A listener that throws is logged and skipped, so one broken surface cannot
 * block the others. A filter array requires membership: an omitted field is
 * unrestricted, an empty array matches nothing.
 */

export const SEVERITIES = ["debug", "info", "success", "warning", "error"] as const;

export type EventSeverity = (typeof SEVERITIES)[number];

/** Domain keys, not issue names: severity and context carry what happened. `app` carries harness-level failures that belong to no single domain (the root error boundary). */
export const EVENT_TYPES = ["invoice", "payment", "client", "autosave", "storage", "image", "app"] as const;

export type AppEventType = (typeof EVENT_TYPES)[number];

export type AppEvent = {
  readonly type: AppEventType;
  readonly severity: EventSeverity;
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Readonly<Record<string, unknown>>;
};

/** Publish-side input: AppEvent with the harness-stamped timestamp optional. */
export type AppEventInput = Omit<AppEvent, "timestamp"> & { readonly timestamp?: number };

/** rethrowError's event input: the message may be derived from the caught error. */
export type RethrownEventInput = Omit<AppEventInput, "message" | "severity"> & { readonly message?: string };

export type EventFilter = {
  readonly types?: readonly AppEventType[];
  readonly severities?: readonly EventSeverity[];
};

export type EventListener = (event: AppEvent) => void;

export type Unsubscribe = () => void;

export type SubscribeOptions = {
  /** Sinks that must not consume or clear the replay buffer opt out here. */
  readonly replayable?: boolean;
};

export type EventBus = {
  publish: (input: AppEventInput) => AppEvent | undefined;
  subscribe: (listener: EventListener, filter?: EventFilter, options?: SubscribeOptions) => Unsubscribe;
};

/** Events retained while no subscriber exists; oldest are dropped past this. */
const REPLAY_BUFFER_LIMIT = 100;

/** Extract a display message from an unknown caught value. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Caught values already published, so parental catches and boundaries do not publish them twice. */
const publishedErrors = new WeakSet<object>();

/** True when this caught value was already published to the bus. */
export const hasBeenPublished = (error: unknown): boolean => typeof error === "object" && error !== null && publishedErrors.has(error);

/**
 * Publish a failure to the bus without throwing: severity is always "error",
 * the message derives from the caught error when not given, and the caught
 * value is normalised into context.error. Exactly once — an already-published
 * value is skipped. Callers that must publish while keeping control of the
 * throw (a route ErrorBoundary deferring the publish, then rethrowing) use
 * this directly.
 */
export const publishError = (bus: EventBus, event: RethrownEventInput, error: unknown): AppEvent | undefined => {
  if (hasBeenPublished(error)) return undefined;
  const published = bus.publish({
    ...event,
    severity: "error",
    message: event.message ?? errorMessage(error),
    context: { ...event.context, error },
  });
  if (published && typeof error === "object" && error !== null) publishedErrors.add(error);
  return published;
};

/**
 * Publish a failure to the bus, then rethrow the original error toward the
 * parental boundary (a local catch, or a route ErrorBoundary). The throw is
 * the original object, never a wrapper, so parental catches keep their
 * instanceof/message checks.
 */
// The binding carries the type annotation: TypeScript applies control-flow
// narrowing after a never-returning call only when the callee's type is
// declared, and callers (the invoices.tsx not-found guard) rely on it.
export const rethrowError: (bus: EventBus, event: RethrownEventInput, error: unknown) => never = (bus, event, error) => {
  publishError(bus, event, error);
  throw error;
};

const isEventSeverity = (value: unknown): value is EventSeverity => typeof value === "string" && SEVERITIES.some((s) => s === value);

const isAppEventType = (value: unknown): value is AppEventType => typeof value === "string" && EVENT_TYPES.some((t) => t === value);

/** Callers pass caught values in `context.error`; serialise them once, here. */
const withNormalisedError = (context: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> => {
  const error = context.error;
  if (error === undefined || typeof error === "string") return context;
  return { ...context, error: errorMessage(error) };
};

const normaliseEvent = (input: AppEventInput): AppEvent | undefined => {
  if (typeof input !== "object" || input === null) return undefined;
  if (!isAppEventType(input.type) || !isEventSeverity(input.severity)) return undefined;
  if (typeof input.message !== "string" || input.message.trim() === "") return undefined;
  const timestamp = typeof input.timestamp === "number" && Number.isFinite(input.timestamp) ? input.timestamp : Date.now();
  const context = input.context === undefined ? undefined : Object.freeze({ ...withNormalisedError(input.context) });
  return Object.freeze({ type: input.type, severity: input.severity, message: input.message, timestamp, context });
};

const matchesFilter = (event: AppEvent, filter: EventFilter | undefined): boolean => {
  if (!filter) return true;
  if (filter.types !== undefined && !filter.types.includes(event.type)) return false;
  if (filter.severities !== undefined && !filter.severities.includes(event.severity)) return false;
  return true;
};

const createEventBus = (): EventBus => {
  const listeners = new Map<EventListener, { readonly filter?: EventFilter; readonly replayable: boolean }>();
  const replayBuffer: AppEvent[] = [];

  const retainForReplay = (event: AppEvent) => {
    replayBuffer.push(event);
    while (replayBuffer.length > REPLAY_BUFFER_LIMIT) replayBuffer.shift();
  };

  const drainReplayBuffer = (): AppEvent[] => replayBuffer.splice(0, replayBuffer.length);

  const hasReplayableListener = (): boolean => {
    for (const [, { replayable }] of [...listeners]) {
      if (replayable) return true;
    }
    return false;
  };

  const dispatch = (listener: EventListener, event: AppEvent) => {
    try {
      listener(event);
    } catch (error) {
      logger.error("Event harness: listener threw while handling", event.type, error);
    }
  };

  const publish = (input: AppEventInput): AppEvent | undefined => {
    const event = normaliseEvent(input);
    if (!event) {
      logger.warn("Event harness: rejected malformed event", input);
      return undefined;
    }
    // Buffer for future replay-capable surfaces while still delivering live
    // to whatever is subscribed now (a non-replayable sink must not miss
    // boot-time events).
    if (!hasReplayableListener()) retainForReplay(event);
    // Snapshot the listeners: one that subscribes mid-publish receives later
    // events, not the one in flight (matching Node's EventEmitter).
    for (const [listener, { filter }] of [...listeners]) {
      if (matchesFilter(event, filter)) dispatch(listener, event);
    }
    return event;
  };

  const subscribe = (listener: EventListener, filter?: EventFilter, options?: SubscribeOptions): Unsubscribe => {
    if (typeof listener !== "function") throw new TypeError("eventBus.subscribe: listener must be a function");
    const replayable = options?.replayable ?? true;
    listeners.set(listener, { filter, replayable });
    if (replayable) {
      for (const event of drainReplayBuffer()) {
        if (matchesFilter(event, filter)) dispatch(listener, event);
      }
    }
    return () => {
      listeners.delete(listener);
    };
  };

  return { publish, subscribe };
};

/** The app-wide singleton. Surfaces and publishers import this. */
export const eventBus = createEventBus();
