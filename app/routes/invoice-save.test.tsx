import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import Home, { clientLoader } from "./invoice";
import { db } from "~/db";
import { type AppEvent, eventBus } from "~/utils/events";

const received: AppEvent[] = [];
let unsubscribe = () => {};
const renderHome = async () => {
  const loaderData = await clientLoader();
  const match = { data: undefined, handle: undefined, params: {}, pathname: "/" };
  const matches = [
    { ...match, id: "root" as const },
    { ...match, id: "layouts/navbar" as const },
    { ...match, data: loaderData, id: "routes/invoice" as const },
  ] satisfies Parameters<typeof Home>[0]["matches"];
  const Stub = createRoutesStub([{ path: "/", Component: () => <Home loaderData={loaderData} params={{}} matches={matches} /> }]);
  return render(<Stub initialEntries={["/"]} />);
};

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  cleanup();
});

describe("invoice save from the editor", () => {
  it("does not report success when the database rejects a save", async () => {
    vi.spyOn(db, "save").mockResolvedValue(false);
    unsubscribe = eventBus.subscribe((event) => received.push(event));
    received.length = 0;
    await renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    await waitFor(() => expect(received.some((event) => event.type === "invoice" && event.context?.action === "failed")).toBe(true));
    expect(received.some((event) => event.type === "invoice" && event.context?.action === "saved")).toBe(false);
  });

  it("persists a new invoice and reloads it through the validated database", async () => {
    await renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
    const id = (screen.getByTestId("invoice-ref") as HTMLTextAreaElement).value;
    await waitFor(async () => expect(await db.get(["invoice", id])).not.toBeNull());
    const invoice = await db.get(["invoice", id]);
    expect(invoice?.id).toBe(id);
    expect((await db.getAll(["invoice"])).map((row) => row.id)).toContain(id);
  });
});
