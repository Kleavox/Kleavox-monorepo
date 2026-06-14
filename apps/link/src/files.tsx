import { useMemo } from "react";

import "./files.css";
import { ReceiveView } from "./receive";
import { SendView } from "./send";

export type { AccountDrop } from "./files-types";

export function FilesApp({
  embedded = false,
  onChanged,
}: {
  embedded?: boolean;
  onChanged?: () => Promise<void>;
}) {
  const publicToken = useMemo(() => {
    const legacyMatch = window.location.pathname.match(/^\/d\/([^/]+)$/u);
    if (legacyMatch?.[1]) return decodeURIComponent(legacyMatch[1]);
    const rootMatch = window.location.pathname.match(/^\/(f_[^/]+)$/u);
    return rootMatch?.[1] ? decodeURIComponent(rootMatch[1]) : null;
  }, []);

  return publicToken ? (
    <ReceiveView token={publicToken} />
  ) : (
    <SendView embedded={embedded} onChanged={onChanged} />
  );
}
