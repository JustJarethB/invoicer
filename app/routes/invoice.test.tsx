import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { emptyAddress } from "~/data/address";
import { makeClient } from "~/data/testFixtures";
import { type AppEvent, eventBus } from "~/utils/events";
import { Toaster } from "~/components/Toaster";
import { createClientAddressLoader } from "./invoice";

const clients = [makeClient({ id: "client-7", contactName: "Alpha", address: { ...emptyAddress(), name: "Alpha House", city: "Springfield" } })];

const received: AppEvent[] = [];
let unsubscribe: () => void = () => {};

const listenForEvents = () => {
  unsubscribe();
  received.length = 0;
  unsubscribe = eventBus.subscribe((event) => received.push(event));
  received.length = 0; // drain any replayed history
};

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  eventBus.subscribe(() => {})(); // drain any replayed events so a later test's subscribers stay clean
  cleanup();
});

describe("createClientAddressLoader", () => {
  it("populates the To address with a known client's address and publishes nothing", () => {
    listenForEvents();
    const setTo = vi.fn();
    createClientAddressLoader(clients, setTo)("client-7");

    expect(setTo).toHaveBeenCalledTimes(1);
    expect(setTo).toHaveBeenCalledWith(clients[0].address);
    expect(received).toHaveLength(0);
  });

  it("clears the To address and publishes a warning toast event for an unknown id", () => {
    listenForEvents();
    const setTo = vi.fn();
    createClientAddressLoader(clients, setTo)("gone-client");

    expect(setTo).toHaveBeenCalledTimes(1);
    expect(setTo).toHaveBeenCalledWith(emptyAddress());
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: "client",
      severity: "warning",
      message: "Selected client could not be found",
      context: { clientId: "gone-client", action: "not-found" },
    });
  });

  it("renders the missing-client toast through the real Toaster", () => {
    render(<Toaster />);
    act(() => {
      createClientAddressLoader(clients, vi.fn())("gone-client");
    });

    const item = screen.getByText("Selected client could not be found").closest("[data-testid='toast-item']");
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("data-severity", "warning");
  });
});
