import { ROOT_ORIGIN } from "@kleavox/ui";

export function publicShareUrl(token: string): string {
  const origin =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? window.location.origin
      : ROOT_ORIGIN;
  return `${origin}/${token}`;
}

export function uploadPart(
  uploadId: string,
  partNumber: number,
  part: Blob,
  manageToken: string,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `/api/uploads/${uploadId}/parts/${partNumber}`);
    request.setRequestHeader("Authorization", `Bearer ${manageToken}`);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onerror = () =>
      reject(new Error("Network interrupted the upload."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(part.size);
        resolve();
        return;
      }
      let message = "A file part could not be uploaded.";
      try {
        message =
          (JSON.parse(request.responseText) as { message?: string }).message ??
          message;
      } catch {}
      reject(new Error(message));
    };
    request.send(part);
  });
}

export function receiveFailureCopy(failure?: { code?: string }): {
  kicker: string;
  title: string;
  code: string;
} {
  switch (failure?.code) {
    case "NOT_FOUND":
      return {
        kicker: "Transfer not found",
        title: "This route leads nowhere.",
        code: "404",
      };
    case "RATE_LIMITED":
      return { kicker: "Slow down", title: "Too many attempts.", code: "429" };
    case "DROP_ENDED":
      return {
        kicker: "Share ended",
        title: "Nothing remains here.",
        code: "410",
      };
    default:
      return {
        kicker: "Share ended",
        title: "Nothing remains here.",
        code: "410",
      };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = units[0]!;
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index]!;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

export function formatPercentSaved(
  originalBytes: number,
  storedBytes: number,
): string {
  return `${Math.max(0, Math.round((1 - storedBytes / originalBytes) * 100))}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  const hours = Math.round(seconds / 3600);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
