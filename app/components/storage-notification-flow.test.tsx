import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Toaster } from "./Toaster";
import { db } from "~/db";
import { emptyAddress } from "~/data/address";
import type { Invoice } from "~/data/invoice";
import { eventBus } from "~/utils/events";

const makeInvoice = (id: string): Invoice => ({
  date: "2026-01-01",
  from: emptyAddress(),
  id,
  lineItems: [{ qty: 2, type: "0", unitPrice: 150, uuid: "l1" }],
  logo: { url: "" },
  payments: [],
  purchaseOrder: "PO-1",
  to: emptyAddress(),
});

const read = async <T,>(operation: () => Promise<T>): Promise<T> => {
  let result: T | undefined;
  await act(async () => {
    result = await operation();
  });
  return result as T;
};

afterEach(() => {
  eventBus.subscribe(() => {})();
});

describe("storage failures through Toaster", () => {
  it("shows one toast when an individual read contains invalid JSON", async () => {
    render(<Toaster />);
    localStorage.setItem(JSON.stringify(["invoice", "corrupt"]), "{not json");

    await expect(read(() => db.get(["invoice", "corrupt"]))).resolves.toBeNull();

    expect(screen.getByText("A saved invoice could not be read")).toBeInTheDocument();
    expect(screen.getAllByTestId("toast-item")).toHaveLength(1);
    expect(localStorage.getItem(JSON.stringify(["invoice", "corrupt"]))).toBe("{not json");
  });

  it("shows one toast when an individual read fails schema validation", async () => {
    render(<Toaster />);
    localStorage.setItem(JSON.stringify(["invoice", "invalid"]), JSON.stringify({ id: "invalid" }));

    await expect(read(() => db.get(["invoice", "invalid"]))).resolves.toBeNull();

    expect(screen.getByText("A saved invoice could not be read")).toBeInTheDocument();
    expect(screen.getAllByTestId("toast-item")).toHaveLength(1);
    expect(localStorage.getItem(JSON.stringify(["invoice", "invalid"]))).toBe(JSON.stringify({ id: "invalid" }));
  });

  it("keeps valid neighbours and shows one summary toast for invalid list records", async () => {
    render(<Toaster />);
    localStorage.setItem(JSON.stringify(["invoice", "valid"]), JSON.stringify(makeInvoice("valid")));
    localStorage.setItem(JSON.stringify(["invoice", "invalid"]), JSON.stringify({ id: "invalid" }));

    await expect(read(() => db.getAll(["invoice"]))).resolves.toEqual([makeInvoice("valid")]);

    expect(screen.getByText("1 saved invoice could not be read and was skipped")).toBeInTheDocument();
    expect(screen.getAllByTestId("toast-item")).toHaveLength(1);
  });

  it("does not show a toast when an individual key is missing", async () => {
    render(<Toaster />);

    await expect(read(() => db.get(["invoice", "missing"]))).resolves.toBeNull();

    expect(screen.queryByTestId("toast-item")).toBeNull();
  });
});
