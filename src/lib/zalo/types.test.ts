import { describe, expect, it } from "vitest";
import { BUTTON_PAYLOAD } from "./types";

describe("BUTTON_PAYLOAD", () => {
  const uuid = "11111111-2222-3333-4444-555555555555";

  it("round-trips action + taskId", () => {
    const encoded = BUTTON_PAYLOAD.encode("accept", uuid);
    expect(encoded).toBe(`task:accept:${uuid}`);
    expect(BUTTON_PAYLOAD.decode(encoded)).toEqual({
      action: "accept",
      taskId: uuid,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(BUTTON_PAYLOAD.decode(`  task:done:${uuid}  `)).toEqual({
      action: "done",
      taskId: uuid,
    });
  });

  it("returns null for non-button text", () => {
    expect(BUTTON_PAYLOAD.decode("xin chào")).toBeNull();
    expect(BUTTON_PAYLOAD.decode("task:accept:not-a-uuid")).toBeNull();
  });
});
