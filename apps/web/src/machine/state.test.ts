import { describe, expect, it } from "vitest";
import { initialState, permits, POLICY, reduce } from "./state";
import type { BayCode } from "./state";

describe("the policy table the reducer and the bay lights share", () => {
  it("matches the bay access table from the handoff", () => {
    expect(POLICY).toEqual({
      "1": ["visitor", "owner"],
      "2": ["owner"],
      "3": ["guest", "visitor", "owner"],
    });
  });

  it("permits reads straight from that table", () => {
    const link: BayCode = "1";
    const pulse: BayCode = "2";
    const portfolio: BayCode = "3";
    expect(permits("guest", link)).toBe(false);
    expect(permits("visitor", link)).toBe(true);
    expect(permits("owner", link)).toBe(true);
    expect(permits("guest", pulse)).toBe(false);
    expect(permits("visitor", pulse)).toBe(false);
    expect(permits("owner", pulse)).toBe(true);
    expect(permits("guest", portfolio)).toBe(true);
    expect(permits("visitor", portfolio)).toBe(true);
    expect(permits("owner", portfolio)).toBe(true);
  });
});

describe("selection policy", () => {
  it("sends a guest who picks LINK to pass required and remembers the bay", () => {
    const next = reduce(initialState("guest"), { type: "select", bay: "1" });
    expect(next.status).toBe("denied");
    expect(next.authRequest).toBe("1");
  });

  it("lets a guest take PORTFOLIO without a pass", () => {
    const next = reduce(initialState("guest"), { type: "select", bay: "3" });
    expect(next.status).toBe("dispensing");
  });

  it("denies PULSE to a visitor and keeps the machine usable", () => {
    const next = reduce(initialState("visitor"), { type: "select", bay: "2" });
    expect(next.status).toBe("denied");
    expect(next.busy).toBe(false);
  });

  it("gives an owner PULSE", () => {
    const next = reduce(initialState("owner"), { type: "select", bay: "2" });
    expect(next.status).toBe("dispensing");
  });
});

describe("resuming a locked request", () => {
  it("dispenses the remembered bay as soon as the pass is issued", () => {
    const denied = reduce(initialState("guest"), { type: "select", bay: "1" });
    const granted = reduce(denied, { type: "pass-issued", access: "visitor" });
    expect(granted.status).toBe("dispensing");
    expect(granted.selection).toBe("1");
    expect(granted.authRequest).toBeNull();
  });

  it("does not resume a bay the new pass still cannot open", () => {
    const denied = reduce(initialState("guest"), { type: "select", bay: "2" });
    const granted = reduce(denied, { type: "pass-issued", access: "visitor" });
    expect(granted.status).toBe("denied");
    expect(granted.authRequest).toBeNull();
  });
});

describe("cancelling the bridge", () => {
  it("returns the cartridge to the tray and leaves it openable", () => {
    const owner = initialState("owner");
    const dispensing = reduce(owner, { type: "select", bay: "2" });
    const ready = reduce(dispensing, { type: "tray-ready" });
    const bridging = reduce(ready, { type: "activate-tray" });
    const cancelled = reduce(bridging, { type: "cancel" });
    expect(cancelled.screenTransfer).toBeNull();
    expect(cancelled.tray).toBe("2");
    expect(cancelled.busy).toBe(false);
  });
});

describe("tapping out", () => {
  it("returns a visitor to guest and clears the tray", () => {
    const visitor = initialState("visitor");
    const out = reduce(visitor, { type: "pass-removed" });
    expect(out.access).toBe("guest");
    expect(out.tray).toBeNull();
    expect(out.status).toBe("idle");
  });
});

describe("busy", () => {
  it("ignores a second selection while a sequence runs", () => {
    const owner = initialState("owner");
    const dispensing = reduce(owner, { type: "select", bay: "1" });
    const again = reduce(dispensing, { type: "select", bay: "2" });
    expect(again.selection).toBe("1");
  });
});

describe("a dispense that fails", () => {
  it("returns the machine to idle instead of hanging on busy", () => {
    const owner = initialState("owner");
    const dispensing = reduce(owner, { type: "select", bay: "1" });
    const failed = reduce(dispensing, { type: "dispense-failed" });
    expect(failed.status).toBe("idle");
    expect(failed.busy).toBe(false);
    expect(failed.tray).toBeNull();
  });
});

describe("the otp buffer belongs to the reducer", () => {
  it("holds the digits the keypad reports", () => {
    const guest = initialState("guest");
    const typing = reduce(guest, { type: "otp-digits", digits: "2468" });
    expect(typing.authDigits).toBe("2468");
  });

  it("empties the buffer when the pass is issued", () => {
    const typing = reduce(initialState("guest"), {
      type: "otp-digits",
      digits: "246810",
    });
    const granted = reduce(typing, { type: "pass-issued", access: "visitor" });
    expect(granted.authDigits).toBe("");
  });
});
