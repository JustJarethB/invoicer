import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { type AppEvent, eventBus, withErrorReporting } from "~/utils/events";
import { createRoutesStub, Outlet } from "react-router";
import { ErrorBoundary } from "../root";
import { ErrorBoundary as InvoicesErrorBoundary } from "./invoices";

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

    const Throwing = (): never => {
      throw { status: 404, statusText: "Not Found", internal: true, data: null };
    };
    const Stub = stubWith(Throwing);
    render(<Stub initialEntries={["/"]} />);

    await screen.findByText("404");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(received).toHaveLength(0);

    errorSpy.mockRestore();
  });

  it("adds no second publish for an error a handler already reported", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

    const error = new Error("handler boom");
    await expect(
      withErrorReporting({ type: "payment", message: "handler failure" }, async () => {
        throw error;
      })
    ).rejects.toBe(error);
    expect(received).toHaveLength(1);

    const HelperThrowing = (): never => {
      throw error;
    };
    const Stub = stubWith(HelperThrowing);
    render(<Stub initialEntries={["/"]} />);

    await screen.findByText("Oops!");
    await vi.waitFor(() => expect(received).toHaveLength(1));
    expect(received[0].type).toBe("payment");
    expect(received[0].message).toBe("handler failure");

    errorSpy.mockRestore();
  });

  it("does not double-publish when the invoices route boundary already captured the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    listenForEvents();

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

    await screen.findByText("orphan boom");
    await vi.waitFor(() => {
      const appErrors = received.filter((event) => event.type === "app" && event.context?.boundary === "root");
      expect(appErrors).toHaveLength(1);
      expect(appErrors[0].message).toBe("orphan boom");
    });

    errorSpy.mockRestore();
  });
});
