import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type LineItem, LineItemProvider, useDeleteLineItem, useLineItems, useSetLineItem } from "./LineItemProvider";

const lineItem = (uuid: string): LineItem => ({
  uuid,
  date: undefined,
  name: undefined,
  description: undefined,
  qty: undefined,
  unitPrice: undefined,
  vatRate: undefined,
  type: undefined,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <LineItemProvider initialLineItems={[lineItem("l-1"), lineItem("l-2")]}>{children}</LineItemProvider>
);

const useHarness = () => {
  const items = useLineItems();
  const setFor1 = useSetLineItem("l-1");
  const setFor2 = useSetLineItem("l-2");
  const delete1 = useDeleteLineItem("l-1");
  const delete2 = useDeleteLineItem("l-2");
  return { items, setFor1, setFor2, delete1, delete2 };
};

afterEach(() => cleanup());

describe("useSetLineItem stale-id guard", () => {
  it("appends a new blank line item when the last existing one is set", () => {
    const { result } = renderHook(useHarness, { wrapper });
    act(() => result.current.setFor2({ ...lineItem("l-2"), name: "Set last" }));
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[1].name).toBe("Set last");
    expect(result.current.items[2].uuid).not.toBe("l-1");
    expect(result.current.items[2].uuid).not.toBe("l-2");
    expect(result.current.items[2].name).toBeUndefined();
  });

  it("does not re-append a blank row when a stale set fires after the list is emptied", () => {
    const { result } = renderHook(useHarness, { wrapper });
    act(() => result.current.delete1());
    act(() => result.current.delete2());
    expect(result.current.items).toHaveLength(0);
    act(() => result.current.setFor1({ ...lineItem("l-1"), name: "ghost" }));
    expect(result.current.items).toHaveLength(0);
    expect(Object.prototype.hasOwnProperty.call(result.current.items, "-1")).toBe(false);
  });

  it("does not mutate the list when a stale set fires for a deleted row among survivors", () => {
    const { result } = renderHook(useHarness, { wrapper });
    act(() => result.current.delete2());
    expect(result.current.items).toHaveLength(1);
    act(() => result.current.setFor2({ ...lineItem("l-2"), name: "ghost" }));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].uuid).toBe("l-1");
    expect(Object.prototype.hasOwnProperty.call(result.current.items, "-1")).toBe(false);
  });
});
