import { describe, expect, it } from "vitest";
import { parseManagerEmails } from "./manager-emails";

describe("parseManagerEmails", () => {
  it("splits, trims and lowercases the list", () => {
    expect(parseManagerEmails(" A@B.com , c@d.com ")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("strips quotes pasted from a .env file", () => {
    expect(parseManagerEmails('"a@b.com,c@d.com"')).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
    expect(parseManagerEmails("'a@b.com'")).toEqual(["a@b.com"]);
  });

  it("ignores empty entries", () => {
    expect(parseManagerEmails("")).toEqual([]);
    expect(parseManagerEmails("a@b.com,, ,")).toEqual(["a@b.com"]);
  });
});
