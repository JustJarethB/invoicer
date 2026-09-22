import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AppEvent, eventBus, publishError } from "./events";
import { registerEventLogging, registerGlobalErrorCapture } from "./eventLogging";
import { logger } from "~/utils/logger";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn(), debug: vi.fn() },
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn(), debug: vi.fn() },
}));

let stopSink: (() => void) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  // The tests run against the app-wide singleton: drop the sink and drain
  // the replay buffer so nothing leaks into the next test.
  stopSink?.();
  stopSink = undefined;
  eventBus.subscribe(() => {})();
});

describe("eventLogging sink", () => {
  it("mirrors each severity onto the matching consola method, with context", () => {
    stopSink = registerEventLogging();

    eventBus.publish({
      type: "storage",
      severity: "warning",
      message: "1 saved entry could not be read and was skipped",
      context: { action: "unreadable", keys: ["not-json"] },
    });
    eventBus.publish({ type: "invoice", severity: "error", message: "Invoice could not be deleted", context: { action: "deleted", invoiceId: "inv-1" } });

    expect(logger.warn).toHaveBeenCalledWith("[storage] 1 saved entry could not be read and was skipped", {
      action: "unreadable",
      keys: ["not-json"],
    });
    expect(logger.error).toHaveBeenCalledWith("[invoice] Invoice could not be deleted", {
      action: "deleted",
      invoiceId: "inv-1",
    });
  });

  it("does not consume replay events meant for UI surfaces", () => {
    stopSink = registerEventLogging();

    eventBus.publish({ type: "storage", severity: "warning", message: "1 saved entry could not be read and was skipped", context: { action: "unreadable" } });

    const surface: AppEvent[] = [];
    const stopSurface = eventBus.subscribe((event) => surface.push(event));
    expect(surface.map((e) => e.message)).toEqual(["1 saved entry could not be read and was skipped"]);
    stopSurface();
  });
});

describe("global error capture", () => {
  const received: AppEvent[] = [];
  // Held at describe scope and always dropped in afterEach: a failed
  // assertion must never leak a bus subscriber or a window listener into
  // the next test.
  let busUnsub: () => void = () => {};
  let stopCapture: (() => void) | undefined;

  const unhandledRejections = () => received.filter((event) => event.type === "app" && event.context?.action === "unhandled-rejection");

  // jsdom never delivers a floating rejection to a window listener, and a
  // natural floating rejection fails the whole vitest run (probe evidence:
  // window listener saw 0 events; run exited 1 with "Errors: 3"). The
  // listener is therefore exercised with a synthetic event carrying the
  // same shape a browser dispatches.
  const dispatchRejection = (reason: unknown) => {
    const event = new Event("unhandledrejection");
    Object.assign(event, { promise: Promise.resolve(), reason });
    window.dispatchEvent(event);
  };

  beforeEach(() => {
    busUnsub = eventBus.subscribe((event) => received.push(event));
    received.length = 0; // drain any replayed history
  });

  afterEach(() => {
    busUnsub();
    stopCapture?.();
    stopCapture = undefined;
    received.length = 0;
  });

  it("publishes one app unhandled-rejection event with the reason as message", () => {
    stopCapture = registerGlobalErrorCapture();

    dispatchRejection(new Error("rejected with no local catch"));

    const captures = unhandledRejections();
    expect(captures).toHaveLength(1);
    expect(captures[0].severity).toBe("error");
    expect(captures[0].message).toBe("rejected with no local catch");
    expect(captures[0].context).toMatchObject({ action: "unhandled-rejection", boundary: "global" });
  });

  it("adds no second event when the reason already went through publishError", () => {
    stopCapture = registerGlobalErrorCapture();

    const error = new Error("quota exceeded");
    publishError(eventBus, { type: "payment", message: "Payment could not be saved", context: { action: "failed" } }, error);
    expect(received).toHaveLength(1);

    // The same object reaching the window listener is the rethrowError
    // compose: the WeakSet mark makes the catcher's publish a no-op. The
    // surviving event is the source publish, explicit message intact.
    dispatchRejection(error);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("payment");
    expect(received[0].message).toBe("Payment could not be saved");
  });

  it("replaces the previous listener on re-registration", () => {
    stopCapture = registerGlobalErrorCapture();
    dispatchRejection(new Error("first"));
    expect(unhandledRejections()).toHaveLength(1);

    // Re-registration disposes the previous listener; the stale handle is a
    // no-op afterwards. One event per dispatch: a leaked first listener
    // would push this to three.
    const replaced = registerGlobalErrorCapture();
    stopCapture = replaced;
    dispatchRejection(new Error("second"));

    expect(unhandledRejections()).toHaveLength(2);
    expect(unhandledRejections()[1].message).toBe("second");
  });

  it("returns a callable no-op unsubscribe without a window", () => {
    vi.stubGlobal("window", undefined);
    try {
      const unsubscribe = registerGlobalErrorCapture();
      expect(() => unsubscribe()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("publishes string reasons through errorMessage without marking the WeakSet", () => {
    stopCapture = registerGlobalErrorCapture();

    // Exactly-once is identity-based and cannot apply to primitives: the
    // WeakSet marks objects only, so a string reason is published fresh.
    dispatchRejection("plain string reason");

    const captures = unhandledRejections();
    expect(captures).toHaveLength(1);
    expect(captures[0].severity).toBe("error");
    expect(captures[0].message).toBe("plain string reason");
  });

  it("adds no second event for a fire-and-forget client-save failure that reaches the catcher", () => {
    // Pins the SaveClientModal conversion shape: rethrowError publishes at
    // the source, the rethrown promise floats unhandled, and the catcher
    // must not repeat the publish.
    stopCapture = registerGlobalErrorCapture();

    const error = new Error("quota exceeded");
    publishError(eventBus, { type: "client", message: "Client could not be saved", context: { action: "failed" } }, error);
    dispatchRejection(error);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("client");
    expect(received[0].message).toBe("Client could not be saved");
  });
});
