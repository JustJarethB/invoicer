import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppEvent, type AppEventInput, errorMessage, eventBus, type EventListener, hasBeenPublished, publishError, rethrowError } from "./events";

const makeEvent = (overrides: Partial<AppEventInput> = {}): AppEventInput => ({
  type: "invoice",
  severity: "success",
  message: "Invoice Saved",
  ...overrides,
});

// The harness is the app-wide singleton, so tests subscribe through this
// helper; afterEach unsubscribes every listener from the test and drains
// anything that buffered while no one was listening — no state leaks
// between tests.
const received: AppEvent[] = [];
const unsubscribers: Array<() => void> = [];

const subscribe = (
  listener: EventListener,
  filter?: Parameters<typeof eventBus.subscribe>[1],
  options?: Parameters<typeof eventBus.subscribe>[2]
): (() => void) => {
  const stop = eventBus.subscribe(listener, filter, options);
  unsubscribers.push(stop);
  return stop;
};

afterEach(() => {
  for (const stop of unsubscribers.splice(0)) stop();
  received.length = 0;
  eventBus.subscribe(() => {})();
});

describe("eventBus", () => {
  describe("publish/subscribe", () => {
    it("delivers a published event to a subscriber with stamped fields", () => {
      subscribe((event) => received.push(event));

      const returned = eventBus.publish(makeEvent());

      expect(returned).toBeDefined();
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe("invoice");
      expect(received[0].severity).toBe("success");
      expect(received[0].message).toBe("Invoice Saved");
      expect(received[0].timestamp).toBeGreaterThan(0);
      expect(received[0].context).toBeUndefined();
    });

    it("delivers to every subscriber", () => {
      const first = vi.fn();
      const second = vi.fn();
      subscribe(first);
      subscribe(second);

      eventBus.publish(makeEvent());

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("carries optional context and stamps the provided timestamp", () => {
      subscribe((event) => received.push(event));

      eventBus.publish({ type: "payment", severity: "info", message: "Paid 10.00", timestamp: 1234, context: { invoiceId: "inv-1", action: "recorded" } });

      expect(received[0].timestamp).toBe(1234);
      expect(received[0].context).toEqual({ invoiceId: "inv-1", action: "recorded" });
    });

    it("passes a frozen event so consumers cannot mutate it", () => {
      let event: AppEvent | undefined;
      subscribe((e) => (event = e));

      eventBus.publish(makeEvent());

      expect(Object.isFrozen(event)).toBe(true);
    });

    it("shallow-copies context so later mutation by the publisher is not seen", () => {
      subscribe((e) => received.push(e));
      const context = { invoiceId: "inv-1" };

      eventBus.publish({ type: "invoice", severity: "success", message: "saved", context });
      context.invoiceId = "inv-2";

      expect(received[0].context).toEqual({ invoiceId: "inv-1" });
    });

    it("publishing with no listeners does not throw", () => {
      expect(() => eventBus.publish(makeEvent())).not.toThrow();
    });
  });

  describe("error normalisation", () => {
    it("serialises a caught Error passed in context.error", () => {
      subscribe((event) => received.push(event));

      eventBus.publish({ type: "payment", severity: "error", message: "Payment could not be saved", context: { error: new Error("quota exceeded") } });

      expect(received[0].context).toEqual({ error: "quota exceeded" });
    });

    it("serialises a non-Error caught value passed in context.error", () => {
      subscribe((event) => received.push(event));

      eventBus.publish({ type: "autosave", severity: "warning", message: "Changes could not be saved automatically", context: { error: 42 } });

      expect(received[0].context).toEqual({ error: "42" });
    });

    it("leaves a string context.error untouched", () => {
      subscribe((event) => received.push(event));

      eventBus.publish({ type: "client", severity: "error", message: "Client could not be saved", context: { error: "quota exceeded" } });

      expect(received[0].context).toEqual({ error: "quota exceeded" });
    });

    it("errorMessage extracts Error.message and stringifies anything else", () => {
      expect(errorMessage(new Error("boom"))).toBe("boom");
      expect(errorMessage("raw")).toBe("raw");
      expect(errorMessage(42)).toBe("42");
    });
  });

  describe("rethrowError", () => {
    const catchRethrow = (fn: () => never): unknown => {
      try {
        fn();
      } catch (error) {
        return error;
      }
      return undefined;
    };

    it("publishes an error event with the derived message and rethrows the same error object", () => {
      subscribe((event) => received.push(event));
      const error = new Error("quota exceeded");

      const caught = catchRethrow(() => rethrowError(eventBus, { type: "payment", context: { invoiceId: "inv-1", action: "failed" } }, error));

      expect(caught).toBe(error);
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe("payment");
      expect(received[0].severity).toBe("error");
      expect(received[0].message).toBe("quota exceeded");
      expect(received[0].context).toEqual({ invoiceId: "inv-1", action: "failed", error: "quota exceeded" });
    });

    it("keeps an explicit message over the derived one", () => {
      subscribe((event) => received.push(event));

      catchRethrow(() => rethrowError(eventBus, { type: "invoice", message: "Payment could not be saved" }, new Error("quota exceeded")));

      expect(received[0].message).toBe("Payment could not be saved");
      expect(received[0].context).toEqual({ error: "quota exceeded" });
    });

    it("serialises a non-Error caught value", () => {
      subscribe((event) => received.push(event));

      catchRethrow(() => rethrowError(eventBus, { type: "autosave" }, 42));

      expect(received[0].message).toBe("42");
      expect(received[0].context).toEqual({ error: "42" });
    });

    it("publishError publishes without throwing so a boundary can defer the rethrow", () => {
      subscribe((event) => received.push(event));
      const error = new Error("route boom");

      const published = publishError(eventBus, { type: "invoice", context: { action: "route-error" } }, error);

      expect(published).toBeDefined();
      expect(received).toHaveLength(1);
      expect(received[0].severity).toBe("error");
      expect(hasBeenPublished(error)).toBe(true);
      // A repeat call is a no-op, not a throw: the caller owns the rethrow.
      expect(() => publishError(eventBus, { type: "invoice" }, error)).not.toThrow();
      expect(received).toHaveLength(1);
    });

    it("does not publish twice for the same caught value", () => {
      subscribe((event) => received.push(event));
      const error = new Error("once");

      catchRethrow(() => rethrowError(eventBus, { type: "payment" }, error));
      expect(hasBeenPublished(error)).toBe(true);
      catchRethrow(() => rethrowError(eventBus, { type: "payment" }, error));

      expect(received).toHaveLength(1);
    });

    it("reports only helper-published values as published", () => {
      expect(hasBeenPublished(new Error("fresh"))).toBe(false);
      expect(hasBeenPublished("raw")).toBe(false);
      expect(hasBeenPublished(undefined)).toBe(false);
      expect(hasBeenPublished(null)).toBe(false);
    });
  });

  describe("pre-subscriber policy (queue and replay)", () => {
    it("replays events published before any subscriber, oldest first", () => {
      eventBus.publish(makeEvent({ message: "first" }));
      eventBus.publish(makeEvent({ message: "second" }));

      subscribe((event) => received.push(event));

      expect(received.map((e) => e.message)).toEqual(["first", "second"]);
    });

    it("clears the buffer after replay so a second subscriber gets no history", () => {
      eventBus.publish(makeEvent({ message: "early" }));

      const first: AppEvent[] = [];
      subscribe((event) => first.push(event));
      const second: AppEvent[] = [];
      subscribe((event) => second.push(event));

      expect(first.map((e) => e.message)).toEqual(["early"]);
      expect(second).toHaveLength(0);
    });

    it("re-arms buffering after every listener unsubscribes", () => {
      const stop = subscribe((event) => received.push(event));

      stop();
      eventBus.publish(makeEvent({ message: "while-orphaned" }));

      const late: AppEvent[] = [];
      subscribe((event) => late.push(event));
      expect(late.map((e) => e.message)).toEqual(["while-orphaned"]);
    });

    it("caps the replay buffer and keeps the newest events", () => {
      for (let i = 0; i < 105; i++) eventBus.publish(makeEvent({ message: `e${i}` }));

      subscribe((event) => received.push(event));

      expect(received).toHaveLength(100);
      expect(received[0].message).toBe("e5");
      expect(received[99].message).toBe("e104");
    });

    it("applies the subscriber's filter to replayed events", () => {
      eventBus.publish(makeEvent({ severity: "error", message: "boom" }));
      eventBus.publish(makeEvent({ severity: "success", message: "ok" }));

      subscribe((event) => received.push(event), { severities: ["error"] });

      expect(received.map((e) => e.message)).toEqual(["boom"]);
    });

    it("does not throw when a malformed event is published with no listeners", () => {
      const emptyType: unknown = { type: "", severity: "success", message: "x" };
      expect(() => eventBus.publish(emptyType as never)).not.toThrow();
      const bogusSeverity: unknown = { type: "invoice", severity: "bogus", message: "x" };
      expect(() => eventBus.publish(bogusSeverity as never)).not.toThrow();
    });
  });

  describe("filtering", () => {
    it("delivers only events matching a severity filter", () => {
      subscribe((event) => received.push(event), { severities: ["error"] });

      eventBus.publish(makeEvent({ severity: "success" }));
      eventBus.publish(makeEvent({ severity: "error" }));

      expect(received).toHaveLength(1);
      expect(received[0].severity).toBe("error");
    });

    it("delivers only events matching a type filter", () => {
      subscribe((event) => received.push(event), { types: ["invoice"] });

      eventBus.publish(makeEvent({ type: "client" }));
      eventBus.publish(makeEvent({ type: "invoice" }));

      expect(received).toHaveLength(1);
      expect(received[0].type).toBe("invoice");
    });

    it("requires both dimensions to match when both are provided", () => {
      subscribe((event) => received.push(event), { types: ["invoice"], severities: ["error"] });

      eventBus.publish(makeEvent({ severity: "success" }));
      eventBus.publish(makeEvent({ type: "client", severity: "error" }));
      eventBus.publish(makeEvent({ severity: "error" }));

      expect(received).toHaveLength(1);
    });

    it("matches nothing on an empty filter array", () => {
      subscribe((event) => received.push(event), { severities: [] });

      eventBus.publish(makeEvent());

      expect(received).toHaveLength(0);
    });

    it("supports multiple subscribers with different filters", () => {
      const errors: AppEvent[] = [];
      const successes: AppEvent[] = [];
      subscribe((event) => errors.push(event), { severities: ["error"] });
      subscribe((event) => successes.push(event), { severities: ["success"] });

      eventBus.publish(makeEvent({ severity: "error", message: "bad" }));
      eventBus.publish(makeEvent({ severity: "success", message: "good" }));

      expect(errors.map((e) => e.message)).toEqual(["bad"]);
      expect(successes.map((e) => e.message)).toEqual(["good"]);
    });
  });

  describe("unsubscribe", () => {
    it("stops delivery after unsubscribing", () => {
      const stop = subscribe((event) => received.push(event));

      eventBus.publish(makeEvent());
      stop();
      eventBus.publish(makeEvent());

      expect(received).toHaveLength(1);
    });

    it("unsubscribing twice is safe", () => {
      const listener = vi.fn();
      const stop = subscribe(listener);

      stop();
      expect(() => stop()).not.toThrow();

      eventBus.publish(makeEvent());
      expect(listener).not.toHaveBeenCalled();
    });

    it("removes only the unsubscribed listener", () => {
      const kept = vi.fn();
      const removed = vi.fn();
      subscribe(kept);
      const stopRemoved = subscribe(removed);

      stopRemoved();
      eventBus.publish(makeEvent());

      expect(kept).toHaveBeenCalledTimes(1);
      expect(removed).not.toHaveBeenCalled();
    });
  });

  describe("malformed events", () => {
    it("rejects a malformed event even when listeners exist", () => {
      const listener = vi.fn();
      subscribe(listener);

      const bad: unknown = { type: "invoice", severity: "success", message: "" };
      expect(eventBus.publish(bad as never)).toBeUndefined();

      expect(listener).not.toHaveBeenCalled();
    });

    it("rejects a type outside the domain union even when listeners exist", () => {
      const listener = vi.fn();
      subscribe(listener);

      const stale: unknown = { type: "invoice.saved", severity: "success", message: "x" };
      expect(eventBus.publish(stale as never)).toBeUndefined();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("listener isolation", () => {
    it("a throwing listener does not break other listeners or the publish call", () => {
      const good = vi.fn();
      const throws = vi.fn(() => {
        throw new Error("listener bug");
      });
      subscribe(throws);
      subscribe(good);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() => eventBus.publish(makeEvent())).not.toThrow();
      expect(good).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });

  describe("mid-publish subscribe snapshot", () => {
    it("a listener subscribing during publish does not receive the in-flight event", () => {
      const late: AppEvent[] = [];
      let stopLate: (() => void) | undefined;
      const first = vi.fn(() => {
        stopLate = subscribe((event) => late.push(event));
      });
      subscribe(first as EventListener);

      eventBus.publish(makeEvent());
      expect(late).toHaveLength(0);

      eventBus.publish(makeEvent({ message: "next" }));
      expect(late).toHaveLength(1);

      stopLate?.();
    });
  });

  describe("replayable sink option", () => {
    it("delivers live events to a non-replayable listener", () => {
      const sink: AppEvent[] = [];
      subscribe((event) => sink.push(event), undefined, { replayable: false });

      eventBus.publish(makeEvent({ message: "live" }));

      expect(sink.map((e) => e.message)).toEqual(["live"]);
    });

    it("a non-replayable listener does not consume buffered events", () => {
      eventBus.publish(makeEvent({ message: "early" }));

      const sink: AppEvent[] = [];
      subscribe((event) => sink.push(event), undefined, { replayable: false });
      expect(sink).toHaveLength(0);

      const surface: AppEvent[] = [];
      subscribe((event) => surface.push(event));
      expect(surface.map((e) => e.message)).toEqual(["early"]);
      expect(sink).toHaveLength(0);
    });

    it("buffering stays armed while only a non-replayable listener is subscribed", () => {
      const sink: AppEvent[] = [];
      subscribe((event) => sink.push(event), undefined, { replayable: false });

      eventBus.publish(makeEvent({ message: "boot-event" }));

      expect(sink.map((e) => e.message)).toEqual(["boot-event"]);
      const surface: AppEvent[] = [];
      subscribe((event) => surface.push(event));
      expect(surface.map((e) => e.message)).toEqual(["boot-event"]);
    });

    it("re-arms buffering after the last replay-capable listener unsubscribes", () => {
      const sink: AppEvent[] = [];
      subscribe((event) => sink.push(event), undefined, { replayable: false });
      const stopSurface = subscribe((event) => sink.push(event));

      stopSurface();
      eventBus.publish(makeEvent({ message: "while-orphaned" }));

      expect(sink.map((e) => e.message)).toEqual(["while-orphaned"]);
      const late: AppEvent[] = [];
      subscribe((event) => late.push(event));
      expect(late.map((e) => e.message)).toEqual(["while-orphaned"]);
    });
  });
});
