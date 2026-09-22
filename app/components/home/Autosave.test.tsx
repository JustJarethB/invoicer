import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Autosave } from "~/components/home/Autosave";
import { TextInput } from "~/components/Inputs";
import { db } from "~/db";
import { type AppEvent, eventBus } from "~/utils/events";

// The call site publishes through the app-wide singleton, which buffers
// pre-subscriber events and replays them to the first subscriber. The test
// subscribes first and drains the replay so assertions only see what the
// test itself triggers.
const received: AppEvent[] = [];
let unsubscribe: () => void = () => {};

const listenForEvents = () => {
  unsubscribe();
  received.length = 0;
  unsubscribe = eventBus.subscribe((event) => received.push(event));
  received.length = 0; // drain any replayed history
};

// Events carry a domain-key type; the dotted qualifier lives in
// context.action, so assertions filter on the pair.
const failedWarnings = () =>
  received.filter((event) => event.type === "autosave" && event.context?.action === "failed");

afterEach(() => {
  unsubscribe();
  unsubscribe = () => {};
  received.length = 0;
  cleanup();
});

describe("Autosave", () => {
  it("warns once per failure streak and re-arms after a successful save", async () => {
    listenForEvents();
    // Mock db.save directly: counting attempts proves the test is not
    // passing vacuously, and skipping the real 100ms delay avoids racing
    // the assertions.
    const save = vi.spyOn(db, "save").mockRejectedValue(new Error("quota exceeded"));
    render(
      <Autosave name="test-form">
        <TextInput name="field" defaultValue="" onChange={() => {}} />
      </Autosave>
    );
    const input = screen.getByRole("textbox");

    // Two consecutive failed saves produce exactly ONE warning.
    await userEvent.type(input, "a");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(failedWarnings()).toHaveLength(1));

    await userEvent.type(input, "b");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    expect(failedWarnings()).toHaveLength(1);

    // A successful save publishes nothing and re-arms the warning.
    save.mockResolvedValueOnce(true);
    await userEvent.type(input, "c");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(failedWarnings()).toHaveLength(1);

    // The next failure after the success publishes a second warning.
    save.mockRejectedValueOnce(new Error("quota exceeded"));
    await userEvent.type(input, "d");
    await waitFor(() => expect(failedWarnings()).toHaveLength(2));
    expect(save).toHaveBeenCalledTimes(4);
    expect(failedWarnings().every((event) => event.severity === "warning")).toBe(true);
  });
});