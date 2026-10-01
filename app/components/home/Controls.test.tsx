import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controls } from "./Controls";
import { type Client, NULL_CLIENT } from "~/data/client";

const clients: Client[] = [
  { ...NULL_CLIENT, id: "client-7", contactName: "Alpha" },
  { ...NULL_CLIENT, id: "client-3", contactName: "Beta" },
  { ...NULL_CLIENT, id: "client-5", contactName: "Gamma" },
];

const renderControls = (loaded: Client[]) => {
  const loadClientAddress = vi.fn();
  render(<Controls clients={loaded} loadClientAddress={loadClientAddress} saveInvoice={() => {}} />);
  return loadClientAddress;
};

afterEach(() => cleanup());

describe("Controls client selection", () => {
  it("passes the chosen client's id to loadClientAddress, never the position or the name", async () => {
    const loadClientAddress = renderControls(clients);
    await userEvent.click(screen.getByRole("button", { name: /Clients/ }));
    await userEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(loadClientAddress).toHaveBeenCalledTimes(1);
    expect(loadClientAddress).toHaveBeenCalledWith("client-3");
    expect(loadClientAddress).not.toHaveBeenCalledWith(1);
    expect(loadClientAddress).not.toHaveBeenCalledWith("Beta");
  });

  it("carries each client's id as the option value", () => {
    renderControls(clients);
    expect(screen.getByRole("button", { name: "Alpha" }).getAttribute("value")).toBe("client-7");
    expect(screen.getByRole("button", { name: "Beta" }).getAttribute("value")).toBe("client-3");
    expect(screen.getByRole("button", { name: "Gamma" }).getAttribute("value")).toBe("client-5");
  });

  it("stays wired when the clients array order does not match the ids", async () => {
    const loadClientAddress = renderControls([clients[2], clients[1], clients[0]]);
    await userEvent.click(screen.getByRole("button", { name: /Clients/ }));
    await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
    expect(loadClientAddress).toHaveBeenCalledWith("client-7");
  });
});
