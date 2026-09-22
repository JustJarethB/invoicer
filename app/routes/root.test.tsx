import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { type AppEvent, eventBus, rethrowError } from "~/utils/events";
import { createRoutesStub, Outlet } from "react-router";
import { ErrorBoundary } from "../root";
import { ErrorBoundary as InvoicesErrorBoundary } from "./invoices";

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

describe("root error boundary", () => {
  // The root boundary is terminal: the stub mounts it on the same route as
  // the throwing component — the shape the invoices route tests prove React
  // Router delivers (an error thrown on a route lands in that route's own
  // boundary via the error prop and useRouteError()).
  const stubWith = (Throwing: () => never) => createRoutesStub([{ path: "/", Component: Throwing, ErrorBoundary }]);

  it("publishes one app route-error event and renders the fallback for a render error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    const renderError = new Error("root boom");
    const Throwing = (): never => {
      throw renderError;
    };
    const Stub = stubWith(Throwing);
    render(<Stub initialEntries={["/"]} />);

    await screen.findByText("Oops!");
    await vi.waitFor(() => {
      const appErrors = received.filter((event) => event.type === "app" && event.context?.boundary === "root");
      expect(appErrors).toHaveLength(1);
      expect(appErrors[0].severity).toBe("error");
      expect(appErrors[0].message).toBe("root boom");
      expect(appErrors[0].context).toMatchObject({ action: "route-error", boundary: "root" });
    });

    errorSpy.mockRestore();
  });

  it("renders the fallback for a navigational 404 without publishing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    // isRouteErrorResponse is structural (react-router index.js:1040), so a
    // plain object with the four fields exercises the 404 branch without the
    // private ErrorResponseImpl. A loader-driven 404 is untestable here: RR7's
    // startNavigation builds a Request whose AbortSignal jsdom rejects.
    const Throwing = (): never => {
      throw { status: 404, statusText: "Not Found", internal: true, data: null };
    };
    const Stub = stubWith(Throwing);
    render(<Stub initialEntries={["/"]} />);

    // 404 copy renders, but nothing is published: navigational 404s are
    // expected outcomes and the fallback page is their capture.
    await screen.findByText("404");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("adds no second publish for an error a handler already published via rethrowError", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    // Pre-mark the error the way a handler path would, then throw the same
    // object from render: root's publishError must see the WeakSet mark.
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
    const Stub = stubWith(HelperThrowing);
    render(<Stub initialEntries={["/"]} />);

    await screen.findByText("Oops!");
    // The handler's publish is the only one; root saw the marked error and skipped its own.
    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0].type).toBe("payment");
    expect(received[0].message).toBe("handler failure");

    errorSpy.mockRestore();
  });

  it("does not double-publish when the invoices route boundary already captured the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    // Real composition: the invoices route boundary defers its publishError
    // with queueMicrotask and rethrows synchronously; root — the next boundary
    // up — also defers. Microtask FIFO runs the route boundary's publish
    // first, its WeakSet mark makes root's publishError a no-op.
    const renderError = new Error("render exploded");
    const Throwing = (): never => {
      throw renderError;
    };
    const Stub = createRoutesStub([
      {
        path: "/",
        ErrorBoundary,
        children: [{ path: "invoices", Component: Throwing, ErrorBoundary: InvoicesErrorBoundary }],
      },
    ]);
    render(<Stub initialEntries={["/invoices"]} />);

    // Positive control: "render exploded" is root's DEV details branch
    // (root.tsx renders error.message only when the error actually arrived),
    // so this assertion proves delivery — "Oops!" alone renders even when
    // error is undefined.
    await screen.findByText("render exploded");
    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0].type).toBe("invoice");
    expect(received[0].context).toMatchObject({ action: "route-error", boundary: "invoices" });
    expect(received.filter((event) => event.type === "app")).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("captures an error from a child route that has no boundary of its own", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    // The clients and invoice routes carry no ErrorBoundary export: their
    // render errors must bubble to the root boundary and be captured there.
    // The parent renders <Outlet/> so the child subtree actually mounts.
    // The error is a stable object thrown on every attempt: a fresh Error per
    // render attempt would yield one event per attempt — the documented
    // exactly-once edge (ERROR-CAPTURE.md), not a defect to fix here.
    const orphanError = new Error("orphan boom");
    const Throwing = (): never => {
      throw orphanError;
    };
    const Stub = createRoutesStub([
      {
        path: "/",
        Component: () => <Outlet />,
        ErrorBoundary,
        children: [{ path: "clients", Component: Throwing }],
      },
    ]);
    render(<Stub initialEntries={["/clients"]} />);

    // Positive control again: the DEV details text proves root received the error.
    await screen.findByText("orphan boom");
    await vi.waitFor(() => {
      const appErrors = received.filter((event) => event.type === "app" && event.context?.boundary === "root");
      expect(appErrors).toHaveLength(1);
      expect(appErrors[0].message).toBe("orphan boom");
    });

    errorSpy.mockRestore();
  });
});
