import { z } from "zod";

export const createCheckSchema = z.object({
  name: z.string().min(1),
  targetUrl: z.string().url(),
  intervalSec: z.number().int().min(10).max(3600).default(60),
  enabled: z.boolean().optional(),
});

export type CreateCheckInput = z.infer<typeof createCheckSchema>;