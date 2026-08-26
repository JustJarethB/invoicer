import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Totals } from "./Totals";
import { LineItemProvider, useSetLineItem, type LineItem } from "./LineItems/LineItemProvider";

const TestHarness = () => {
  const setLineItem = useSetLineItem("seeded-line");
  return (
    <>
      <Totals />
      <button
        onClick={() =>
          setLineItem({
            uuid: "seeded-line",
            name: "Hourly",
            qty: "2",
            unitPrice: "150",
            type: "0",
          })
        }
      >
        Add service line
      </button>
      <button
        onClick={() =>
          setLineItem({
            uuid: "seeded-line",
            name: "Daily",
            qty: "1",
            unitPrice: "0",
            type: "1",
          })
        }
      >
        Add zero-value rental
      </button>
      <button
        onClick={() =>
          setLineItem({
            uuid: "seeded-line",
            name: "Items",
            qty: "1",
            unitPrice: "50",
            type: "2",
          })
        }
      >
        Add expense line
      </button>
      <button
        onClick={() =>
          setLineItem({
            uuid: "seeded-line",
            name: "Items",
            qty: "1",
            unitPrice: "25",
            type: "3",
          })
        }
      >
        Add discount line
      </button>
    </>
  );
};

const SeededProvider = ({
  children,
  initialLineItems = [],
}: {
  children: React.ReactNode;
  initialLineItems?: LineItem[];
}) => {
  // Provide a deterministic seed line with a stable uuid so the harness can update it.
  const seed: LineItem[] =
    initialLineItems.length === 0 ? [{ uuid: "seeded-line" }] : initialLineItems;
  return <LineItemProvider initialLineItems={seed}>{children}</LineItemProvider>;
};

// The grand-total field is a read-only textarea; this helper disambiguates it
// from charge-type sub-totals by requiring the label "Total" next to it.
const findGrandTotal = (text: string) =>
  screen.getByText((content, element) => {
    const hasValue = (el?: Element | null) =>
      el?.tagName.toLowerCase() === "textarea" && el?.textContent?.trim() === text;
    const isGrandTotal =
      element?.tagName.toLowerCase() === "textarea" &&
      element?.parentElement?.parentElement?.previousElementSibling?.textContent?.trim() ===
        "Total";
    return hasValue(element) && isGrandTotal;
  });

const findSubTotal = (label: string, value: string) =>
  screen.getByText((content, element) => {
    const labelMatches =
      element?.parentElement?.parentElement?.previousElementSibling?.textContent?.trim() === label;
    const valueMatches =
      element?.tagName.toLowerCase() === "textarea" && element?.textContent?.trim() === value;
    return labelMatches && valueMatches;
  });

describe("Totals", () => {
  it("shows the grand total as zero when no line items have values", () => {
    // The invoice form starts with one blank line; totals should not display money until work is added.
    render(
      <SeededProvider initialLineItems={[]}>
        <Totals />
      </SeededProvider>
    );

    expect(screen.getByRole("heading", { name: /totals/i })).toBeInTheDocument();
    expect(findGrandTotal("0.00")).toBeInTheDocument();
  });

  it("updates the grand total when a service line is added", async () => {
    render(
      <SeededProvider>
        <TestHarness />
      </SeededProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /add service line/i }));

    expect(findGrandTotal("300.00")).toBeInTheDocument();
    expect(findSubTotal("Services", "300.00")).toBeInTheDocument();
  });

  it("shows per-charge-type sub-totals only when they are non-zero", async () => {
    // The invoice summarises each charge type separately; zero-value sections are hidden to keep the UI clean.
    render(
      <SeededProvider>
        <TestHarness />
      </SeededProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /add service line/i }));

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.queryByText("Rentals")).not.toBeInTheDocument();
    expect(screen.queryByText("Expenses")).not.toBeInTheDocument();
    expect(screen.queryByText("Discounts")).not.toBeInTheDocument();
  });

  it("does not show a sub-total for a zero-value line", async () => {
    // A line with qty 1 and unitPrice 0 contributes £0 to the invoice and should not create a heading.
    render(
      <SeededProvider>
        <TestHarness />
      </SeededProvider>
    );

    await userEvent.click(screen.getByRole("button", { name: /add zero-value rental/i }));

    expect(screen.queryByText("Rentals")).not.toBeInTheDocument();
  });

  it("summarises each charge type and updates the grand total", () => {
    // Mixed charge types are a realistic invoice: services plus expenses minus a discount.
    // Because the harness only has one line item slot, clicking each button in sequence
    // overwrites the previous line. We therefore seed three separate lines so all charge
    // types can coexist.
    render(
      <SeededProvider
        initialLineItems={[
          {
            uuid: "service-line",
            name: "Hourly",
            qty: "2",
            unitPrice: "150",
            type: "0",
          },
          {
            uuid: "expense-line",
            name: "Items",
            qty: "1",
            unitPrice: "50",
            type: "2",
          },
          {
            uuid: "discount-line",
            name: "Items",
            qty: "1",
            unitPrice: "25",
            type: "3",
          },
        ]}
      >
        <Totals />
      </SeededProvider>
    );

    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Discounts")).toBeInTheDocument();
    expect(findGrandTotal("325.00")).toBeInTheDocument();
  });
});
