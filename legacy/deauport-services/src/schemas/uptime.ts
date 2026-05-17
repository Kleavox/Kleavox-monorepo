import { z } from "zod";
import { stripTrailingSlash } from "../lib/url.js";

export const createCheckSchema = z.object({
  name: z.string().min(1),
  targetUrl: z.string().url().transform(stripTrailingSlash),
  intervalSec: z.number().int().min(10).max(3600).default(60),
  enabled: z.boolean().optional(),
});

export const updateCheckSchema = createCheckSchema.partial().extend({
  targetUrl: z.string().url().transform(stripTrailingSlash).optional(),
});

export type CreateCheckInput = z.infer<typeof createCheckSchema>;