import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { type AppEvent, eventBus, rethrowError } from "~/utils/events";
import { ErrorBoundary } from "./invoices";

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
  eventBus.subscribe(() => {})();
  cleanup();
});

describe("invoices route error boundary", () => {
  const stubWith = (Throwing: () => never) =>
    createRoutesStub([
      {
        path: "/",
        ErrorBoundary: () => <p>root fallback rendered</p>,
        children: [{ path: "invoices", Component: Throwing, ErrorBoundary }],
      },
    ]);

  it("publishes one route-error event and delegates to the root boundary", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    const renderError = new Error("render exploded");
    const Throwing = (): never => {
      throw renderError;
    };
    const Stub = stubWith(Throwing);
    render(<Stub initialEntries={["/invoices"]} />);

    await screen.findByText("root fallback rendered");
    await vi.waitFor(() => {
      const routeErrors = received.filter((event) => event.type === "invoice" && event.context?.action === "route-error");
      expect(routeErrors).toHaveLength(1);
      expect(routeErrors[0].severity).toBe("error");
      expect(routeErrors[0].message).toBe("render exploded");
      expect(routeErrors[0].context).toMatchObject({ action: "route-error", boundary: "invoices", error: "render exploded" });
    });

    errorSpy.mockRestore();
  });

  it("does not double-publish an error that already went through the helper", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    const error = new Error("handler boom");
    const caught = (() => {
      try {
        rethrowError(eventBus, { type: "payment", message: "handler failure" }, error);
        return undefined;
      } catch (caught) {
        return caught;
      }
    })();
    expect(caught).toBe(error);
    expect(received).toHaveLength(1);

    const HelperThrowing = (): never => {
      throw error;
    };
    const HelperStub = stubWith(HelperThrowing);
    render(<HelperStub initialEntries={["/invoices"]} />);

    await screen.findByText("root fallback rendered");
    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0].type).toBe("payment");
    expect(received[0].message).toBe("handler failure");

    errorSpy.mockRestore();
  });
});
