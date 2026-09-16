import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";
import { Toaster } from "./Toaster";
import { MAX_TOASTS, TOAST_DURATIONS } from "./toastConfig";
import { type AppEventInput, createEventBus, eventBus, type EventBus } from "~/utils/events";

// Toast ids come from a module-level counter that intentionally never resets,
// so tests never assert on ids — they query by message text, region, or
// data-severity instead.

const makeBus = (): EventBus => createEventBus();

const makeEvent = (overrides: Partial<AppEventInput> = {}): AppEventInput => ({
  type: "test.event",
  severity: "info",
  message: "Hello",
  ...overrides,
});

/** Publish inside act: a live publish synchronously dispatches to the mounted listener. */
const publishInAct = (bus: EventBus, input: AppEventInput) => {
  act(() => {
    bus.publish(input);
  });
};

const toastItem = (message: string): HTMLElement => {
  const item = screen.getByText(message).closest<HTMLElement>("[data-testid='toast-item']");
  if (!item) throw new Error(`No toast item found for message: ${message}`);
  return item;
};

describe("Toaster", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders empty live regions and no toasts when nothing was published", () => {
    render(<Toaster bus={makeBus()} />);

    expect(screen.getByTestId("toast-region-assertive")).toBeEmptyDOMElement();
    expect(screen.getByTestId("toast-region-polite")).toBeEmptyDOMElement();
    expect(screen.queryByTestId("toast-item")).toBeNull();
  });

  it("shows a published error toast in the assertive region and never auto-dismisses it", () => {
    vi.useFakeTimers();
    const bus = makeBus();
    render(<Toaster bus={bus} />);

    publishInAct(bus, makeEvent({ severity: "error", message: "Boom" }));

    const item = toastItem("Boom");
    expect(item).toHaveAttribute("data-severity", "error");
    expect(item.closest("[aria-live='assertive']")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("auto-dismisses success, info, and warning at their configured durations", () => {
    vi.useFakeTimers();
    const bus = makeBus();
    render(<Toaster bus={bus} />);
    publishInAct(bus, makeEvent({ severity: "success", message: "saved" }));
    publishInAct(bus, makeEvent({ severity: "info", message: "loaded" }));
    publishInAct(bus, makeEvent({ severity: "warning", message: "stale" }));

    const successMs = TOAST_DURATIONS.success ?? 0;
    const infoMs = TOAST_DURATIONS.info ?? 0;
    const warningMs = TOAST_DURATIONS.warning ?? 0;

    act(() => {
      vi.advanceTimersByTime(successMs);
    });
    expect(screen.queryByText("saved")).toBeNull();
    expect(screen.getByText("loaded")).toBeInTheDocument();
    expect(screen.getByText("stale")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(infoMs - successMs);
    });
    expect(screen.queryByText("loaded")).toBeNull();
    expect(screen.getByText("stale")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(warningMs - infoMs);
    });
    expect(screen.queryByText("stale")).toBeNull();
    expect(screen.getByTestId("toast-region-assertive")).toBeEmptyDOMElement();
  });

  it("stacks multiple simultaneous events across the polite and assertive regions", () => {
    const bus = makeBus();
    render(<Toaster bus={bus} />);
    publishInAct(bus, makeEvent({ severity: "error", message: "e-msg" }));
    publishInAct(bus, makeEvent({ severity: "warning", message: "w-msg" }));
    publishInAct(bus, makeEvent({ severity: "info", message: "i-msg" }));
    publishInAct(bus, makeEvent({ severity: "success", message: "s-msg" }));

    const assertive = screen.getByTestId("toast-region-assertive");
    const polite = screen.getByTestId("toast-region-polite");
    expect(within(assertive).getByText("e-msg")).toBeInTheDocument();
    expect(within(assertive).getByText("w-msg")).toBeInTheDocument();
    expect(within(polite).getByText("i-msg")).toBeInTheDocument();
    expect(within(polite).getByText("s-msg")).toBeInTheDocument();
    expect(screen.getAllByTestId("toast-item")).toHaveLength(4);
  });

  it("dismisses a toast via its dismiss button", async () => {
    const bus = makeBus();
    render(<Toaster bus={bus} />);
    publishInAct(bus, makeEvent({ severity: "error", message: "Boom" }));

    await userEvent.click(within(toastItem("Boom")).getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText("Boom")).toBeNull();
    expect(screen.getByTestId("toast-region-assertive")).toBeEmptyDOMElement();
  });

  it("dismisses a focused toast on Escape", async () => {
    const bus = makeBus();
    render(<Toaster bus={bus} />);
    publishInAct(bus, makeEvent({ severity: "error", message: "Boom" }));

    await userEvent.tab();
    expect(within(toastItem("Boom")).getByRole("button", { name: /dismiss/i })).toHaveFocus();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByText("Boom")).toBeNull();
  });

  it("ignores debug-severity events but keeps the subscription healthy", () => {
    const bus = makeBus();
    render(<Toaster bus={bus} />);

    publishInAct(bus, makeEvent({ severity: "debug", message: "noise" }));
    expect(screen.queryByText("noise")).toBeNull();

    publishInAct(bus, makeEvent({ severity: "error", message: "Boom" }));
    expect(screen.getByText("Boom")).toBeInTheDocument();
  });

  it("renders pre-subscriber events replayed by the harness, filtered by severity", () => {
    const bus = makeBus();
    bus.publish(makeEvent({ severity: "error", message: "early-error" }));
    bus.publish(makeEvent({ severity: "success", message: "early-success" }));
    bus.publish(makeEvent({ severity: "debug", message: "early-noise" }));

    render(<Toaster bus={bus} />);

    expect(screen.getByText("early-error")).toBeInTheDocument();
    expect(screen.getByText("early-success")).toBeInTheDocument();
    expect(screen.queryByText("early-noise")).toBeNull();
  });

  it("renders exactly one toast for one publish under StrictMode double-subscribe", () => {
    const bus = makeBus();
    render(
      <StrictMode>
        <Toaster bus={bus} />
      </StrictMode>
    );

    publishInAct(bus, makeEvent({ severity: "info", message: "once" }));

    expect(screen.getAllByText("once")).toHaveLength(1);
  });

  it("evicts the oldest toasts once the stack exceeds MAX_TOASTS", () => {
    const bus = makeBus();
    render(<Toaster bus={bus} />);

    for (let i = 0; i <= MAX_TOASTS + 1; i++) {
      publishInAct(bus, makeEvent({ severity: "error", message: `m${i}` }));
    }

    expect(screen.getAllByTestId("toast-item")).toHaveLength(MAX_TOASTS);
    expect(screen.queryByText("m0")).toBeNull();
    expect(screen.queryByText("m1")).toBeNull();
    expect(screen.getByText(`m${MAX_TOASTS + 1}`)).toBeInTheDocument();
  });

  it("renders nothing after unmount and does not throw on later publishes", () => {
    const bus = makeBus();
    const { unmount } = render(<Toaster bus={bus} />);
    publishInAct(bus, makeEvent({ severity: "error", message: "Boom" }));
    expect(screen.getByText("Boom")).toBeInTheDocument();

    unmount();
    expect(screen.queryByText("Boom")).toBeNull();
    expect(() => publishInAct(bus, makeEvent({ severity: "error", message: "after" }))).not.toThrow();
  });

  it("removes its listener on unmount (no leak in the harness registry)", () => {
    const bus = makeBus();
    const { unmount } = render(<Toaster bus={bus} />);
    unmount();

    // Probe the harness registry through observable behaviour. Publish twice
    // before any spy subscribes: with a clean registry the events buffer and
    // are replayed to the spy (2 deliveries); with a leaked Toaster listener
    // they are delivered live to it instead, so the spy later sees only the
    // third publish (1 delivery).
    bus.publish(makeEvent({ severity: "error", message: "probe-1" }));
    bus.publish(makeEvent({ severity: "error", message: "probe-2" }));

    const spy = vi.fn();
    bus.subscribe(spy);
    act(() => {
      bus.publish(makeEvent({ severity: "error", message: "probe-3" }));
    });

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("consumes the default app-wide bus", () => {
    const { unmount } = render(<Toaster />);

    act(() => {
      eventBus.publish(makeEvent({ severity: "error", message: "default-bus-boom" }));
    });

    expect(screen.getByText("default-bus-boom")).toBeInTheDocument();
    // Explicit unmount so the singleton bus carries no leaked listener.
    unmount();
  });
});

describe("Toaster + Modal Escape interplay", () => {
  // The real scenario: payment.rejected publishes an error toast while the
  // payment modal deliberately stays open. Error toasts never auto-dismiss,
  // so no fake timers are needed here.
  const mountInterplay = (onModalClose: () => void) => {
    const bus = makeBus();
    render(
      <Modal title="Payment" onClose={onModalClose}>
        Payment details
      </Modal>
    );
    render(<Toaster bus={bus} />);
    publishInAct(bus, makeEvent({ severity: "error", message: "payment.rejected" }));
  };

  it("dismisses a focused toast on Escape without closing an open Modal", async () => {
    const onModalClose = vi.fn();
    mountInterplay(onModalClose);

    const dismiss = within(toastItem("payment.rejected")).getByRole("button", { name: "Dismiss error message" });
    dismiss.focus();
    expect(dismiss).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByText("payment.rejected")).toBeNull();
    expect(screen.getByTestId("toast-region-assertive")).toBeEmptyDOMElement();
    expect(onModalClose).not.toHaveBeenCalled();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });

  it("still closes the Modal on Escape when focus is outside any toast, leaving the toast untouched", async () => {
    const onModalClose = vi.fn();
    mountInterplay(onModalClose);

    expect(document.activeElement).toBe(document.body);
    await userEvent.keyboard("{Escape}");

    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText("payment.rejected")).toBeInTheDocument();
    expect(screen.getByText("Payment")).toBeInTheDocument();
  });
});
