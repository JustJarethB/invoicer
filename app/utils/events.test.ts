import { afterEach, describe, expect, it, vi } from "vitest";
import { type AppEvent, createEventBus, type EventListener } from "./events";

const makeEvent = (overrides: Partial<Parameters<ReturnType<typeof createEventBus>["publish"]>[0]> = {}) => ({
  type: "invoice.saved",
  severity: "success" as const,
  message: "Invoice Saved",
  ...overrides,
});

describe("createEventBus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("publish/subscribe", () => {
    it("delivers a published event to a subscriber with stamped fields", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      bus.subscribe((event) => received.push(event));

      const returned = bus.publish(makeEvent());

      expect(returned).toBeDefined();
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe("invoice.saved");
      expect(received[0].severity).toBe("success");
      expect(received[0].message).toBe("Invoice Saved");
      expect(received[0].timestamp).toBeGreaterThan(0);
      expect(received[0].context).toBeUndefined();
    });

    it("delivers to every subscriber", () => {
      const bus = createEventBus();
      const first = vi.fn();
      const second = vi.fn();
      bus.subscribe(first);
      bus.subscribe(second);

      bus.publish(makeEvent());

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it("carries optional context and stamps the provided timestamp", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      bus.subscribe((event) => received.push(event));

      bus.publish({ type: "payment.recorded", severity: "info", message: "Paid 10.00", timestamp: 1234, context: { invoiceId: "inv-1" } });

      expect(received[0].timestamp).toBe(1234);
      expect(received[0].context).toEqual({ invoiceId: "inv-1" });
    });

    it("passes a frozen event so consumers cannot mutate it", () => {
      const bus = createEventBus();
      let event: AppEvent | undefined;
      bus.subscribe((e) => (event = e));

      bus.publish(makeEvent());

      expect(Object.isFrozen(event)).toBe(true);
    });

    it("shallow-copies context so later mutation by the publisher is not seen", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      bus.subscribe((e) => received.push(e));
      const context = { invoiceId: "inv-1" };

      bus.publish({ type: "invoice.saved", severity: "success", message: "saved", context });
      context.invoiceId = "inv-2";

      expect(received[0].context).toEqual({ invoiceId: "inv-1" });
    });

    it("publishing with no listeners does not throw", () => {
      const bus = createEventBus();

      expect(() => bus.publish(makeEvent())).not.toThrow();
    });
  });

  describe("pre-subscriber policy (queue and replay)", () => {
    it("replays events published before any subscriber, oldest first", () => {
      const bus = createEventBus();
      bus.publish(makeEvent({ message: "first" }));
      bus.publish(makeEvent({ message: "second" }));

      const received: AppEvent[] = [];
      bus.subscribe((event) => received.push(event));

      expect(received.map((e) => e.message)).toEqual(["first", "second"]);
    });

    it("clears the buffer after replay so a second subscriber gets no history", () => {
      const bus = createEventBus();
      bus.publish(makeEvent({ message: "early" }));

      const first: AppEvent[] = [];
      bus.subscribe((event) => first.push(event));
      const second: AppEvent[] = [];
      bus.subscribe((event) => second.push(event));

      expect(first.map((e) => e.message)).toEqual(["early"]);
      expect(second).toHaveLength(0);
    });

    it("re-arms buffering after every listener unsubscribes", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      const unsubscribe = bus.subscribe((event) => received.push(event));

      unsubscribe();
      bus.publish(makeEvent({ message: "while-orphaned" }));

      const late: AppEvent[] = [];
      bus.subscribe((event) => late.push(event));
      expect(late.map((e) => e.message)).toEqual(["while-orphaned"]);
    });

    it("caps the replay buffer and keeps the newest events", () => {
      const bus = createEventBus();
      for (let i = 0; i < 105; i++) bus.publish(makeEvent({ message: `e${i}` }));

      const received: AppEvent[] = [];
      bus.subscribe((event) => received.push(event));

      expect(received).toHaveLength(100);
      expect(received[0].message).toBe("e5");
      expect(received[99].message).toBe("e104");
    });

    it("applies the subscriber's filter to replayed events", () => {
      const bus = createEventBus();
      bus.publish(makeEvent({ severity: "error", message: "boom" }));
      bus.publish(makeEvent({ severity: "success", message: "ok" }));

      const errorsOnly: AppEvent[] = [];
      bus.subscribe((event) => errorsOnly.push(event), { severities: ["error"] });

      expect(errorsOnly.map((e) => e.message)).toEqual(["boom"]);
    });

    it("does not throw when a malformed event is published with no listeners", () => {
      const bus = createEventBus();

      expect(() => bus.publish({ type: "", severity: "success", message: "x" })).not.toThrow();
      expect(() => bus.publish({ type: "t", severity: "bogus" as "success", message: "x" })).not.toThrow();
    });
  });

  describe("filtering", () => {
    it("delivers only events matching a severity filter", () => {
      const bus = createEventBus();
      const errors: AppEvent[] = [];
      bus.subscribe((event) => errors.push(event), { severities: ["error"] });

      bus.publish(makeEvent({ severity: "success" }));
      bus.publish(makeEvent({ severity: "error" }));

      expect(errors).toHaveLength(1);
      expect(errors[0].severity).toBe("error");
    });

    it("delivers only events matching a type filter", () => {
      const bus = createEventBus();
      const invoiceEvents: AppEvent[] = [];
      bus.subscribe((event) => invoiceEvents.push(event), { types: ["invoice.saved"] });

      bus.publish(makeEvent({ type: "client.saved" }));
      bus.publish(makeEvent({ type: "invoice.saved" }));

      expect(invoiceEvents).toHaveLength(1);
      expect(invoiceEvents[0].type).toBe("invoice.saved");
    });

    it("requires both dimensions to match when both are provided", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      bus.subscribe((event) => received.push(event), { types: ["invoice.saved"], severities: ["error"] });

      bus.publish(makeEvent({ type: "invoice.saved", severity: "success" }));
      bus.publish(makeEvent({ type: "client.saved", severity: "error" }));
      bus.publish(makeEvent({ type: "invoice.saved", severity: "error" }));

      expect(received).toHaveLength(1);
    });

    it("matches nothing on an empty filter array", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      bus.subscribe((event) => received.push(event), { severities: [] });

      bus.publish(makeEvent());

      expect(received).toHaveLength(0);
    });

    it("supports multiple subscribers with different filters", () => {
      const bus = createEventBus();
      const errors: AppEvent[] = [];
      const successes: AppEvent[] = [];
      bus.subscribe((event) => errors.push(event), { severities: ["error"] });
      bus.subscribe((event) => successes.push(event), { severities: ["success"] });

      bus.publish(makeEvent({ severity: "error", message: "bad" }));
      bus.publish(makeEvent({ severity: "success", message: "good" }));

      expect(errors.map((e) => e.message)).toEqual(["bad"]);
      expect(successes.map((e) => e.message)).toEqual(["good"]);
    });
  });

  describe("unsubscribe", () => {
    it("stops delivery after unsubscribing", () => {
      const bus = createEventBus();
      const received: AppEvent[] = [];
      const unsubscribe = bus.subscribe((event) => received.push(event));

      bus.publish(makeEvent());
      unsubscribe();
      bus.publish(makeEvent());

      expect(received).toHaveLength(1);
    });

    it("unsubscribing twice is safe", () => {
      const bus = createEventBus();
      const listener = vi.fn();
      const unsubscribe = bus.subscribe(listener);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();

      bus.publish(makeEvent());
      expect(listener).not.toHaveBeenCalled();
    });

    it("removes only the unsubscribed listener", () => {
      const bus = createEventBus();
      const kept = vi.fn();
      const removed = vi.fn();
      bus.subscribe(kept);
      const unsubscribeRemoved = bus.subscribe(removed);

      unsubscribeRemoved();
      bus.publish(makeEvent());

      expect(kept).toHaveBeenCalledTimes(1);
      expect(removed).not.toHaveBeenCalled();
    });
  });

  describe("malformed events", () => {
    it("rejects a malformed event even when listeners exist", () => {
      const bus = createEventBus();
      const listener = vi.fn();
      bus.subscribe(listener);

      const bad: unknown = { type: "", severity: "success", message: "" };
      expect(bus.publish(bad as never)).toBeUndefined();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("listener isolation", () => {
    it("a throwing listener does not break other listeners or the publish call", () => {
      const bus = createEventBus();
      const good = vi.fn();
      const throws = vi.fn(() => {
        throw new Error("listener bug");
      });
      bus.subscribe(throws);
      bus.subscribe(good);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() => bus.publish(makeEvent())).not.toThrow();
      expect(good).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });
  });

  describe("mid-publish subscribe snapshot", () => {
    it("a listener subscribing during publish does not receive the in-flight event", () => {
      const bus = createEventBus();
      const late: AppEvent[] = [];
      const first = vi.fn(() => {
        bus.subscribe((event) => late.push(event));
      });
      bus.subscribe(first as EventListener);

      bus.publish(makeEvent());
      expect(late).toHaveLength(0);

      bus.publish(makeEvent({ message: "next" }));
      expect(late).toHaveLength(1);
    });
  });

  describe("framework-agnostic core", () => {
    it("creates independent buses with isolated buffers and listeners", () => {
      const a = createEventBus();
      const b = createEventBus();
      const received: AppEvent[] = [];
      b.subscribe((event) => received.push(event));

      a.publish(makeEvent());

      expect(received).toHaveLength(0);
    });
  });
});
