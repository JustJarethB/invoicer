import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { type AppEvent, eventBus, rethrowError } from "~/utils/events";
import { ErrorBoundary } from "./invoices";

// The harness is the app-wide singleton: subscribe first, drain any replayed
// history, and unsubscribe in afterEach so no state leaks between tests.
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
  // A parent fallback boundary is required: the route boundary rethrows, and
  // without an ancestor the render error would escape the router uncaught.
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

    // A stable Error instance: exactly-once is identity-based, so the test
    // pins the contract for one rethrown object.
    const renderError = new Error("render exploded");
    const Throwing = (): never => {
      throw renderError;
    };
    // A call expression is not a valid JSX tag name; the stub must be bound
    // to a capitalized identifier first.
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

    // Pre-mark the error the same way a handler path would: publish once via
    // the helper, catch the rethrow, then throw the same object in render.
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
    // The helper's publish is the only one; the boundary saw the marked error
    // and skipped its own.
    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0].type).toBe("payment");
    expect(received[0].message).toBe("handler failure");

    errorSpy.mockRestore();
  });
});
