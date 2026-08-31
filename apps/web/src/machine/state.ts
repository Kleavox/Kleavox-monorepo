export type BayCode = "1" | "2" | "3";

export type AccessRole = "guest" | "visitor" | "owner";

export type MachineState = {
  access: AccessRole;
  status: "idle" | "reading" | "granted" | "selected" | "denied" | "dispensing";
  selection: BayCode | null;
  tray: BayCode | null;
  busy: boolean;
  authStep: "closed" | "methods" | "otp-machine" | "oauth" | "issuing";
  authRequest: BayCode | null;
  screenTransfer: BayCode | null;
  authDigits: string;
};

export type MachineEvent =
  | { type: "select"; bay: BayCode }
  | { type: "pass-tap" }
  | { type: "pass-issued"; access: AccessRole }
  | { type: "pass-removed" }
  | { type: "otp-digits"; digits: string }
  | { type: "tray-ready" }
  | { type: "activate-tray" }
  | { type: "cancel" }
  | { type: "dispense-failed" }
  | { type: "reset" };

export const POLICY: Record<BayCode, AccessRole[]> = {
  "1": ["visitor", "owner"],
  "2": ["owner"],
  "3": ["guest", "visitor", "owner"],
};

export function permits(access: AccessRole, bay: BayCode): boolean {
  return POLICY[bay].includes(access);
}

export function initialState(access: AccessRole): MachineState {
  return {
    access,
    status: "idle",
    selection: null,
    tray: null,
    busy: false,
    authStep: "closed",
    authRequest: null,
    screenTransfer: null,
    authDigits: "",
  };
}

export function reduce(state: MachineState, event: MachineEvent): MachineState {
  switch (event.type) {
    case "select": {
      if (state.busy) return state;
      if (permits(state.access, event.bay)) {
        return {
          ...state,
          selection: event.bay,
          status: "dispensing",
          busy: true,
          authRequest: null,
        };
      }
      return {
        ...state,
        selection: event.bay,
        status: "denied",
        busy: false,
        authRequest: state.access === "guest" ? event.bay : null,
      };
    }

    case "pass-tap": {
      if (state.busy || state.access !== "guest") return state;
      return { ...state, authStep: "methods", busy: true };
    }

    case "pass-issued": {
      const access = event.access;
      if (state.authRequest && permits(access, state.authRequest)) {
        return {
          ...state,
          access,
          status: "dispensing",
          selection: state.authRequest,
          authRequest: null,
          busy: true,
          authStep: "closed",
          authDigits: "",
        };
      }
      return {
        ...state,
        access,
        status: state.authRequest ? "denied" : "granted",
        authRequest: null,
        busy: false,
        authStep: "closed",
        authDigits: "",
      };
    }

    case "pass-removed": {
      return initialState("guest");
    }

    case "otp-digits": {
      return { ...state, authDigits: event.digits };
    }

    case "tray-ready": {
      return {
        ...state,
        tray: state.selection,
        selection: null,
        status: "idle",
        busy: false,
      };
    }

    case "activate-tray": {
      if (!state.tray) return state;
      return { ...state, screenTransfer: state.tray, busy: true };
    }

    case "cancel": {
      return {
        ...state,
        screenTransfer: null,
        authStep: "closed",
        authDigits: "",
        busy: false,
      };
    }

    case "dispense-failed": {
      return {
        ...state,
        status: "idle",
        busy: false,
        tray: null,
        selection: null,
      };
    }

    case "reset": {
      return {
        ...state,
        status: "idle",
        selection: null,
        tray: null,
        busy: false,
        authStep: "closed",
        authRequest: null,
        screenTransfer: null,
        authDigits: "",
      };
    }
  }
}
