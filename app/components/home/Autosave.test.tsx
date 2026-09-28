import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Autosave } from "~/components/home/Autosave";
import { TextInput } from "~/components/Inputs";
import { db } from "~/db";
import { type AppEvent, eventBus } from "~/utils/events";

const received: AppEvent[] = [];
let unsubscribe: () => void = () => {};

const listenForEvents = () => {
  unsubscribe();
  received.length = 0;
  unsubscribe = eventBus.subscribe((event) => received.push(event));
  received.length = 0; // drain any replayed history
};

const failedWarnings = () => received.filter((event) => event.type === "autosave" && event.context?.action === "failed");

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  received.length = 0;
  cleanup();
});

describe("Autosave", () => {
  it("warns once per failure streak and re-arms after a successful save", async () => {
    listenForEvents();
    const save = vi.spyOn(db, "saveForm").mockRejectedValue(new Error("quota exceeded"));
    render(
      <Autosave name="from-address">
        <TextInput name="field" defaultValue="" onChange={() => {}} />
      </Autosave>
    );
    const input = screen.getByRole("textbox");

    await userEvent.type(input, "a");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(failedWarnings()).toHaveLength(1));

    await userEvent.type(input, "b");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(failedWarnings()).toHaveLength(1);

    save.mockResolvedValueOnce(true);
    await userEvent.type(input, "c");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(failedWarnings()).toHaveLength(1);

    save.mockRejectedValueOnce(new Error("quota exceeded"));
    await userEvent.type(input, "d");
    await waitFor(() => expect(failedWarnings()).toHaveLength(2));
    expect(save).toHaveBeenCalledTimes(4);
    expect(failedWarnings().every((event) => event.severity === "warning")).toBe(true);
  });
});
