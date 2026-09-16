import { logger } from "~/utils/logger";

/**
 * App-wide event harness.
 *
 * Publishers and consumers are fully decoupled: a publisher calls `publish`
 * and knows nothing about who listens; a surface calls `subscribe` and knows
 * nothing about who publishes. The core is plain TypeScript with no React
 * dependency, so any surface (toast, email digest, log sink, webhook) can
 * subscribe without publishers changing.
 *
 * Pre-subscriber policy — QUEUE AND REPLAY. Events published while no
 * subscriber exists are retained in a bounded replay buffer (oldest dropped
 * past the limit). When the first subscriber attaches, buffered events are
 * replayed to it (through its filter, oldest first) and the buffer is
 * cleared; from then on events are delivered live. When every subscriber
 * unsubscribes, buffering re-arms. Rationale: Invoicer boots with client
 * loaders that can surface events (storage parse failures, save
 * confirmations) before any UI surface has mounted, and those events are
 * worth showing once a surface exists. Late subscribers after the first do
 * not receive history.
 *
 * Listener isolation: a listener that throws is reported through `logger`
 * and does not prevent remaining listeners from receiving the event.
 *
 * Filtering: a filter's `types` and `severities` restrict delivery. An
 * omitted field is unrestricted; a provided array requires membership (so an
 * empty array matches nothing). When both are provided, both must match.
 */

export const SEVERITIES = ["debug", "info", "success", "warning", "error"] as const;

export type EventSeverity = (typeof SEVERITIES)[number];

export type AppEvent = {
  readonly type: string;
  readonly severity: EventSeverity;
  readonly message: string;
  readonly timestamp: number;
  readonly context?: Readonly<Record<string, unknown>>;
};

export type AppEventInput = {
  type: string;
  severity: EventSeverity;
  message: string;
  timestamp?: number;
  context?: Record<string, unknown>;
};

export type EventFilter = {
  readonly types?: readonly string[];
  readonly severities?: readonly EventSeverity[];
};

export type EventListener = (event: AppEvent) => void;

export type Unsubscribe = () => void;

export type EventBus = {
  publish: (input: AppEventInput) => AppEvent | undefined;
  subscribe: (listener: EventListener, filter?: EventFilter) => Unsubscribe;
};

/** Events retained while no subscriber exists; oldest are dropped past this. */
const REPLAY_BUFFER_LIMIT = 100;

/**
 * Stamp and freeze a publish input, or return undefined when the input is
 * malformed (wrong types, empty type/message, unknown severity). A timestamp
 * that is not a finite number is replaced with the current time. The context
 * is shallow-copied so later mutation by the publisher cannot change what
 * consumers saw.
 */
const normaliseEvent = (input: AppEventInput): AppEvent | undefined => {
  if (typeof input !== "object" || input === null) return undefined;
  if (typeof input.type !== "string" || input.type.trim() === "") return undefined;
  if (typeof input.message !== "string" || input.message.trim() === "") return undefined;
  if (typeof input.severity !== "string" || !SEVERITIES.includes(input.severity)) return undefined;
  const timestamp = typeof input.timestamp === "number" && Number.isFinite(input.timestamp) ? input.timestamp : Date.now();
  const context = input.context === undefined ? undefined : Object.freeze({ ...input.context });
  return Object.freeze({ type: input.type, severity: input.severity, message: input.message, timestamp, context });
};

const matchesFilter = (event: AppEvent, filter: EventFilter | undefined): boolean => {
  if (!filter) return true;
  if (filter.types !== undefined && !filter.types.includes(event.type)) return false;
  if (filter.severities !== undefined && !filter.severities.includes(event.severity)) return false;
  return true;
};

export const createEventBus = (): EventBus => {
  const listeners = new Map<EventListener, EventFilter | undefined>();
  let replayBuffer: AppEvent[] = [];

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
    if (listeners.size === 0) {
      replayBuffer.push(event);
      if (replayBuffer.length > REPLAY_BUFFER_LIMIT) replayBuffer = replayBuffer.slice(-REPLAY_BUFFER_LIMIT);
      return event;
    }
    // Snapshot: a listener that subscribes mid-publish receives later events,
    // not the one in flight (matching Node's EventEmitter behaviour).
    for (const [listener, filter] of [...listeners]) {
      if (matchesFilter(event, filter)) dispatch(listener, event);
    }
    return event;
  };

  const subscribe = (listener: EventListener, filter?: EventFilter): Unsubscribe => {
    if (typeof listener !== "function") throw new TypeError("eventBus.subscribe: listener must be a function");
    listeners.set(listener, filter);
    if (replayBuffer.length > 0) {
      const buffered = replayBuffer;
      replayBuffer = [];
      for (const event of buffered) {
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
