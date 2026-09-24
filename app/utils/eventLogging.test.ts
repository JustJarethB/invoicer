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
  let busUnsub: () => void = () => {};
  let stopCapture: (() => void) | undefined;

  const unhandledRejections = () => received.filter((event) => event.type === "app" && event.context?.action === "unhandled-rejection");

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

    dispatchRejection(error);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("payment");
    expect(received[0].message).toBe("Payment could not be saved");
  });

  it("replaces the previous listener on re-registration", () => {
    stopCapture = registerGlobalErrorCapture();
    dispatchRejection(new Error("first"));
    expect(unhandledRejections()).toHaveLength(1);

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

    dispatchRejection("plain string reason");

    const captures = unhandledRejections();
    expect(captures).toHaveLength(1);
    expect(captures[0].severity).toBe("error");
    expect(captures[0].message).toBe("plain string reason");
  });

  it("adds no second event for a fire-and-forget client-save failure that reaches the catcher", () => {
    stopCapture = registerGlobalErrorCapture();

    const error = new Error("quota exceeded");
    publishError(eventBus, { type: "client", message: "Client could not be saved", context: { action: "failed" } }, error);
    dispatchRejection(error);

    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("client");
    expect(received[0].message).toBe("Client could not be saved");
  });
});
