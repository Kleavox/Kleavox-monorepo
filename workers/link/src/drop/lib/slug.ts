import { FILE_SLUG_PREFIX } from "@kleavox/core";

import { randomToken } from "./crypto";

export function createFileSlug(): string {
  return `${FILE_SLUG_PREFIX}${randomToken(12)}`;
}
