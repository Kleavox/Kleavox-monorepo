import { describe, expect, it } from "vitest";
import { toMachineModel } from "./estate-adapter";

describe("machine model", () => {
  it("reads INSERT PASS for a signed out visitor and lights only portfolio", () => {
    const model = toMachineModel({ authenticated: false }, null);
    expect(model.access).toBe("guest");
    expect(model.screen).toBe("INSERT PASS");
    expect(
      model.items.filter((item) => item.lit).map((item) => item.code),
    ).toEqual(["3"]);
  });

  it("counts what needs attention on the screen", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      {
        role: "ADMIN",
        pass: { devices: 1 },
        link: null,
        pulse: null,
        attention: [{ kind: "node-down" }, { kind: "abuse-report" }],
      } as never,
    );
    expect(model.screen).toBe("2 NEED ATTENTION");
  });

  it("says nothing needs you when the estate is clear and fully known", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      {
        role: "ADMIN",
        pass: { devices: 1 },
        link: { active: 0, files: 0, reported: 0, expiringSoon: 0 },
        pulse: {
          nodes: 1,
          down: 0,
          checksFailing: 0,
          openIncidents: 0,
          openReports: 0,
        },
        attention: [],
      } as never,
    );
    expect(model.screen).toBe("NOTHING NEEDS YOU");
  });

  it("says the estate is unreadable rather than showing a calm machine", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      null,
    );
    expect(model.screen).toBe("ESTATE UNREADABLE");
  });

  it("never reports zero for a block it could not read", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      {
        role: "ADMIN",
        pass: null,
        link: null,
        pulse: null,
        attention: [],
      } as never,
    );
    expect(model.indicators.pulse).toBe("unknown");
    expect(JSON.stringify(model.indicators)).not.toContain('"count":0');
  });
});

describe("bay lighting follows POLICY, not a second table", () => {
  it("lights every bay for an owner", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      null,
    );
    expect(
      model.items.filter((item) => item.lit).map((item) => item.code),
    ).toEqual(["1", "2", "3"]);
  });

  it("lights link and portfolio, but not pulse, for a visitor", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "USER" } },
      null,
    );
    expect(
      model.items.filter((item) => item.lit).map((item) => item.code),
    ).toEqual(["1", "3"]);
  });
});

describe("a partially unreadable estate is never mistaken for a quiet one", () => {
  it("does not say nothing needs you when a block could not be read, even with no attention items", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      {
        role: "ADMIN",
        pass: { devices: 1 },
        link: { active: 0, files: 0, reported: 0, expiringSoon: 0 },
        pulse: null,
        attention: [],
      } as never,
    );
    expect(model.screen).not.toBe("NOTHING NEEDS YOU");
    expect(model.screen).toBe("ESTATE UNREADABLE");
  });

  it("does say nothing needs you when the only silent block is one this viewer was never permitted to see", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "USER" } },
      {
        role: "USER",
        pass: { devices: 1 },
        link: { active: 0, files: 0, reported: 0, expiringSoon: 0 },
        pulse: null,
        attention: [],
      } as never,
    );
    expect(model.screen).toBe("NOTHING NEEDS YOU");
  });
});

describe("a session with no overview at all still tells the truth about pulse", () => {
  it("keeps pulse locked, not unknown, for a visitor whose estate could not be read", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "USER" } },
      null,
    );
    expect(model.indicators.pulse).toBe("locked");
    expect(model.indicators.pass).toBe("unknown");
    expect(model.indicators.link).toBe("unknown");
  });

  it("marks every indicator unknown for an owner whose estate could not be read", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      null,
    );
    expect(model.indicators.pass).toBe("unknown");
    expect(model.indicators.link).toBe("unknown");
    expect(model.indicators.pulse).toBe("unknown");
  });

  it("locks every indicator for a guest, since that is a calm refusal, not an alarm", () => {
    const model = toMachineModel({ authenticated: false }, null);
    expect(model.indicators.pass).toBe("locked");
    expect(model.indicators.link).toBe("locked");
    expect(model.indicators.pulse).toBe("locked");
  });
});

describe("the known indicator state carries the real numbers, not just presence", () => {
  it("returns the exact count and severity for blocks that are actually there", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "ADMIN" } },
      {
        role: "ADMIN",
        pass: { devices: 4 },
        link: { active: 9, files: 2, reported: 0, expiringSoon: 3 },
        pulse: {
          nodes: 5,
          down: 1,
          checksFailing: 0,
          openIncidents: 0,
          openReports: 0,
        },
        attention: [],
      } as never,
    );
    expect(model.indicators.pass).toEqual({ count: 4, severity: null });
    expect(model.indicators.link).toEqual({ count: 9, severity: "warn" });
    expect(model.indicators.pulse).toEqual({ count: 5, severity: "danger" });
  });

  it("leaves a locked block locked even when its sibling blocks carry real numbers", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "USER" } },
      {
        role: "USER",
        pass: { devices: 2 },
        link: { active: 7, files: 0, reported: 0, expiringSoon: 0 },
        pulse: {
          nodes: 3,
          down: 0,
          checksFailing: 0,
          openIncidents: 0,
          openReports: 0,
        },
        attention: [],
      } as never,
    );
    expect(model.indicators.pass).toEqual({ count: 2, severity: null });
    expect(model.indicators.link).toEqual({ count: 7, severity: null });
    expect(model.indicators.pulse).toBe("locked");
  });
});

describe("an unrecognized role defaults to guest, not to visitor", () => {
  it("treats a role that is neither ADMIN nor USER as guest, not as a quiet visitor grant", () => {
    const model = toMachineModel(
      { authenticated: true, identity: { role: "SOMETHING_ELSE" } },
      null,
    );
    expect(model.access).toBe("guest");
  });
});
