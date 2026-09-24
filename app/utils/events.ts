import { logger } from "~/utils/logger";

export const SEVERITIES = ["debug", "info", "success", "warning", "error"] as const;

export type EventSeverity = (typeof SEVERITIES)[number];

export const EVENT_TYPES = ["invoice", "payment", "client", "autosave", "storage", "image", "app"] as const;

export type AppEventType = (typeof EVENT_TYPES)[number];

export type AppEvent = {
  readonly type: AppEventType;
  readonly severity: EventSeverity;
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Readonly<Record<string, unknown>>;
};

export type AppEventInput = Omit<AppEvent, "timestamp"> & { readonly timestamp?: number };

export type RethrownEventInput = Omit<AppEventInput, "message" | "severity"> & { readonly message?: string };

export type EventFilter = {
  readonly types?: readonly AppEventType[];
  readonly severities?: readonly EventSeverity[];
};

export type EventListener = (event: AppEvent) => void;

export type Unsubscribe = () => void;

export type SubscribeOptions = {
  readonly replayable?: boolean;
};

export type EventBus = {
  publish: (input: AppEventInput) => AppEvent | undefined;
  subscribe: (listener: EventListener, filter?: EventFilter, options?: SubscribeOptions) => Unsubscribe;
};

const REPLAY_BUFFER_LIMIT = 100;

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const publishedErrors = new WeakSet<object>();

export const hasBeenPublished = (error: unknown): boolean => typeof error === "object" && error !== null && publishedErrors.has(error);

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

export const rethrowError: (bus: EventBus, event: RethrownEventInput, error: unknown) => never = (bus, event, error) => {
  publishError(bus, event, error);
  throw error;
};

const isEventSeverity = (value: unknown): value is EventSeverity => typeof value === "string" && SEVERITIES.some((s) => s === value);

const isAppEventType = (value: unknown): value is AppEventType => typeof value === "string" && EVENT_TYPES.some((t) => t === value);

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
    if (!hasReplayableListener()) retainForReplay(event);
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

export const eventBus = createEventBus();
