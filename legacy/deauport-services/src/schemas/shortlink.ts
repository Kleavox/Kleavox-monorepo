import { z } from "zod";

export const createShortlinkSchema = z.object({
  slug: z.string().regex(/^[a-zA-Z0-9-_]+$/).min(1),
  targetUrl: z.string().url(),
  enabled: z.boolean().optional(),
});

export type CreateShortlinkInput = z.infer<typeof createShortlinkSchema>;