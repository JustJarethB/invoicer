import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveClientModal } from "./SaveClientModal";
import { saveClient } from "~/data/client";
import { type AppEvent, type EventBus, eventBus, rethrowError, type RethrownEventInput } from "~/utils/events";

vi.mock("~/utils/events", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/utils/events")>();
  return {
    ...actual,
    rethrowError: vi.fn((bus: EventBus, event: RethrownEventInput, error: unknown) => actual.publishError(bus, event, error)),
  };
});

vi.mock("~/data/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/data/client")>()),
  saveClient: vi.fn(),
}));

const received: AppEvent[] = [];
let unsubscribe: () => void = () => {};

const savedEvents = () => received.filter((event) => event.type === "client" && event.context?.action === "saved");

beforeEach(() => {
  vi.clearAllMocks();
  unsubscribe = eventBus.subscribe((event) => received.push(event));
  received.length = 0; // drain any replayed history
});

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  received.length = 0;
  eventBus.subscribe(() => {})();
  cleanup();
});

describe("SaveClientModal failure path", () => {
  it("rethrows a rejected save through rethrowError and keeps the modal open", async () => {
    const error = new Error("quota exceeded");
    vi.mocked(saveClient).mockRejectedValueOnce(error);
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<SaveClientModal record={{ name: "Acme", streetAddress: "1 Way" }} onClose={onClose} onSaved={onSaved} />);

    await userEvent.type(screen.getByPlaceholderText("Display Name"), "Acme Co");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await vi.waitFor(() =>
      expect(rethrowError).toHaveBeenCalledWith(eventBus, { type: "client", message: "Client could not be saved", context: { action: "failed" } }, error)
    );
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("client");
    expect(received[0].severity).toBe("error");
    expect(received[0].message).toBe("Client could not be saved");
    expect(received[0].context).toEqual({ action: "failed", error: "quota exceeded" });
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(savedEvents()).toHaveLength(0);
  });

  it("publishes client.saved and closes the modal when the save succeeds", async () => {
    vi.mocked(saveClient).mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    const onSaved = vi.fn();
    render(<SaveClientModal record={{ name: "Acme", streetAddress: "1 Way" }} onClose={onClose} onSaved={onSaved} />);

    await userEvent.type(screen.getByPlaceholderText("Display Name"), "Acme Co");
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await vi.waitFor(() => expect(savedEvents()).toHaveLength(1));
    expect(savedEvents()[0].severity).toBe("success");
    expect(onClose).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });
});
