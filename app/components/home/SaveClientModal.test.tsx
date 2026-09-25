import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveClientModal } from "./SaveClientModal";
import { saveClient } from "~/data/client";
import { type AppEvent, eventBus } from "~/utils/events";

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

describe("SaveClientModal", () => {
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
