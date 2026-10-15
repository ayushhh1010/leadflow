import { describe, expect, it } from "vitest";

import { validateLead } from "./validation";

const valid = { name: "Sarah Connor", company: "Acme Corp", phone: "+1 (555) 019-9" };

describe("validateLead", () => {
  it("accepts a complete lead", () => {
    expect(validateLead(valid)).toEqual({});
  });

  it("accepts a lead with only a name", () => {
    expect(validateLead({ name: "Sarah", company: null, phone: null })).toEqual({});
  });

  it.each([
    [{ ...valid, name: "" }, "name"],
    [{ ...valid, name: "   " }, "name"],
    [{ ...valid, name: "x".repeat(121) }, "name"],
    [{ ...valid, company: "x".repeat(121) }, "company"],
    [{ ...valid, phone: "call me" }, "phone"],
    [{ ...valid, phone: "12" }, "phone"],
    [{ ...valid, phone: "1".repeat(41) }, "phone"],
  ])("flags %j on %s", (input, field) => {
    expect(Object.keys(validateLead(input))).toEqual([field]);
  });
});
