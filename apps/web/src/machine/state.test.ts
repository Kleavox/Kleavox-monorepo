import { describe, expect, it } from "vitest";
import { initialState, permits, POLICY, reduce } from "./state";
import type { BayCode, MachineState } from "./state";

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

describe("keypad preselect", () => {
  it("selects a bay and waits without dispensing", () => {
    const next = reduce(initialState("owner"), { type: "preselect", bay: "1" });
    expect(next.status).toBe("selected");
    expect(next.selection).toBe("1");
    expect(next.busy).toBe(false);
  });

  it("is ignored while a sequence is busy", () => {
    const dispensing = reduce(initialState("owner"), {
      type: "select",
      bay: "1",
    });
    const again = reduce(dispensing, { type: "preselect", bay: "2" });
    expect(again.selection).toBe("1");
    expect(again.status).toBe("dispensing");
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

  it("resumes bay 2 rather than a hardcoded bay 1", () => {
    const denied = reduce(initialState("guest"), { type: "select", bay: "2" });
    const granted = reduce(denied, { type: "pass-issued", access: "owner" });
    expect(granted.status).toBe("dispensing");
    expect(granted.selection).toBe("2");
    expect(granted.authRequest).toBeNull();
  });

  it("does not resume a bay the new pass still cannot open", () => {
    const denied = reduce(initialState("guest"), { type: "select", bay: "2" });
    const granted = reduce(denied, { type: "pass-issued", access: "visitor" });
    expect(granted.status).toBe("denied");
    expect(granted.authRequest).toBeNull();
  });
});

describe("the sign-in terminal steps", () => {
  it("pass-tap starts the reader", () => {
    const tapped = reduce(initialState("guest"), { type: "pass-tap" });
    expect(tapped.status).toBe("reading");
    expect(tapped.busy).toBe(true);
    expect(tapped.authStep).toBe("closed");
  });

  it("reader-scanned opens the method screen once the scan finishes", () => {
    const tapped = reduce(initialState("guest"), { type: "pass-tap" });
    const scanned = reduce(tapped, { type: "reader-scanned" });
    expect(scanned.authStep).toBe("methods");
    expect(scanned.busy).toBe(true);
  });

  it("reader-scanned is a no-op once the terminal is already open", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const again = reduce(scanned, { type: "reader-scanned" });
    expect(again).toEqual(scanned);
  });

  it("otp-sent moves the keypad into code entry", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const sent = reduce(scanned, { type: "otp-sent" });
    expect(sent.authStep).toBe("otp-machine");
    expect(sent.busy).toBe(true);
  });

  it("otp-sent is ignored if the terminal was never opened", () => {
    const guest = initialState("guest");
    const ignored = reduce(guest, { type: "otp-sent" });
    expect(ignored).toEqual(guest);
  });

  it("oauth-started marks the redirect about to happen", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const started = reduce(scanned, { type: "oauth-started" });
    expect(started.authStep).toBe("oauth");
    expect(started.busy).toBe(true);
  });

  it("oauth-started cannot fire once otp-sent already claimed the step", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const sent = reduce(scanned, { type: "otp-sent" });
    const started = reduce(sent, { type: "oauth-started" });
    expect(started).toEqual(sent);
  });

  it("verifying moves an in-flight code check to issuing", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const sent = reduce(scanned, { type: "otp-sent" });
    const verifying = reduce(sent, { type: "verifying" });
    expect(verifying.authStep).toBe("issuing");
    expect(verifying.busy).toBe(true);
  });

  it("verifying moves an in-flight oauth callback to issuing", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const started = reduce(scanned, { type: "oauth-started" });
    const verifying = reduce(started, { type: "verifying" });
    expect(verifying.authStep).toBe("issuing");
  });

  it("verifying is ignored before a code or callback is in flight", () => {
    const guest = initialState("guest");
    const ignored = reduce(guest, { type: "verifying" });
    expect(ignored).toEqual(guest);
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

type Status = MachineState["status"];
type AuthStep = MachineState["authStep"];

const ALL_STATUSES: Record<Status, true> = {
  idle: true,
  reading: true,
  granted: true,
  selected: true,
  denied: true,
  dispensing: true,
};

const ALL_AUTH_STEPS: Record<AuthStep, true> = {
  closed: true,
  methods: true,
  "otp-machine": true,
  oauth: true,
  issuing: true,
};

describe("every declared state is reachable", () => {
  it("produces every status value from some event sequence", () => {
    const tapped = reduce(initialState("guest"), { type: "pass-tap" });
    const preselected = reduce(initialState("owner"), {
      type: "preselect",
      bay: "1",
    });
    const denied = reduce(initialState("guest"), { type: "select", bay: "1" });
    const dispensing = reduce(initialState("owner"), {
      type: "select",
      bay: "1",
    });
    const granted = reduce(initialState("guest"), {
      type: "pass-issued",
      access: "visitor",
    });

    const observed = new Set<Status>([
      initialState("guest").status,
      tapped.status,
      preselected.status,
      denied.status,
      dispensing.status,
      granted.status,
    ]);

    for (const status of Object.keys(ALL_STATUSES) as Status[]) {
      expect(observed.has(status)).toBe(true);
    }
  });

  it("produces every authStep value from some event sequence", () => {
    const scanned = reduce(
      reduce(initialState("guest"), { type: "pass-tap" }),
      {
        type: "reader-scanned",
      },
    );
    const otpSent = reduce(scanned, { type: "otp-sent" });
    const oauthStarted = reduce(scanned, { type: "oauth-started" });
    const issuingFromOtp = reduce(otpSent, { type: "verifying" });

    const observed = new Set<AuthStep>([
      initialState("guest").authStep,
      scanned.authStep,
      otpSent.authStep,
      oauthStarted.authStep,
      issuingFromOtp.authStep,
    ]);

    for (const step of Object.keys(ALL_AUTH_STEPS) as AuthStep[]) {
      expect(observed.has(step)).toBe(true);
    }
  });
});
