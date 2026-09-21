import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AppEvent, eventBus } from "./events";
import { registerEventLogging } from "./eventLogging";
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
