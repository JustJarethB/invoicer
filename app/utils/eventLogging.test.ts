import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AppEvent, createEventBus } from "./events";
import { registerEventLogging } from "./eventLogging";
import { logger } from "~/utils/logger";

vi.mock("~/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn(), debug: vi.fn() },
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), success: vi.fn(), debug: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("eventLogging sink", () => {
  it("mirrors each severity onto the matching consola method, with context", () => {
    const bus = createEventBus();
    registerEventLogging(bus);

    bus.publish({
      type: "storage.unreadable",
      severity: "warning",
      message: "1 saved entry could not be read and was skipped",
      context: { keys: ["not-json"] },
    });
    bus.publish({ type: "invoice.deleted", severity: "error", message: "Invoice could not be deleted", context: { invoiceId: "inv-1" } });

    expect(logger.warn).toHaveBeenCalledWith("[storage.unreadable] 1 saved entry could not be read and was skipped", { keys: ["not-json"] });
    expect(logger.error).toHaveBeenCalledWith("[invoice.deleted] Invoice could not be deleted", { invoiceId: "inv-1" });
  });

  it("does not consume replay events meant for UI surfaces", () => {
    const bus = createEventBus();
    registerEventLogging(bus);

    bus.publish({ type: "storage.unreadable", severity: "warning", message: "1 saved entry could not be read and was skipped" });

    const surface: AppEvent[] = [];
    bus.subscribe((event) => surface.push(event));
    expect(surface.map((e) => e.message)).toEqual(["1 saved entry could not be read and was skipped"]);
  });
});
