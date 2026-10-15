import { afterEach, describe, expect, it, vi } from "vitest";

import { api, ApiError, errorMessage } from "./api";

function respond(status: number, body: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
    );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("returns parsed JSON and builds the list query", async () => {
    const fetchMock = respond(200, [{ id: 1 }]);

    await expect(api.listLeads({ status: "proposal_sent", q: "acme & co" })).resolves.toEqual([
      { id: 1 },
    ]);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads?status=proposal_sent&q=acme+%26+co");
  });

  it("omits the query string without filters", async () => {
    const fetchMock = respond(200, []);

    await api.listLeads({});

    expect(fetchMock.mock.calls[0][0]).toBe("/api/leads");
  });

  it("sends JSON bodies", async () => {
    const fetchMock = respond(201, { id: 7 });

    await api.addDiscussion(7, { body: "Called", follow_up_at: "2026-05-06T09:00:00.000Z" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/leads/7/discussions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      body: "Called",
      follow_up_at: "2026-05-06T09:00:00.000Z",
    });
  });

  it("maps validation errors onto fields", async () => {
    respond(422, {
      detail: [
        { loc: ["body", "name"], msg: "String should have at least 1 character" },
        { loc: ["body", "phone"], msg: "Phone may contain only digits" },
      ],
    });

    const error = await api.createLead({ name: "", company: null, phone: "x" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(422);
    expect(error.message).toBe("String should have at least 1 character");
    expect(error.fieldErrors).toEqual({
      name: "String should have at least 1 character",
      phone: "Phone may contain only digits",
    });
  });

  it("uses the API's message for other client errors", async () => {
    respond(404, { detail: "Lead not found" });

    await expect(api.getLead(999)).rejects.toMatchObject({
      status: 404,
      message: "Lead not found",
    });
  });

  it("hides server error details", async () => {
    respond(500, "<html>Internal Server Error</html>");

    await expect(api.getLead(1)).rejects.toMatchObject({
      status: 500,
      message: "The server isn't responding right now. Please try again in a moment.",
    });
  });

  it("reports network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(api.getLead(1)).rejects.toMatchObject({
      status: 0,
      message: "Can't reach the server. Check your connection and try again.",
    });
  });

  it("lets cancellations through untouched", async () => {
    const abort = new AbortController();
    const cancelled = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(cancelled));
    abort.abort();

    await expect(api.getLead(1, abort.signal)).rejects.toBe(cancelled);
  });
});

describe("errorMessage", () => {
  it("falls back to a generic message for unknown errors", () => {
    expect(errorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
    expect(errorMessage(new ApiError("Lead not found", 404))).toBe("Lead not found");
  });
});
