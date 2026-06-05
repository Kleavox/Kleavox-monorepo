import { z } from "zod";

export const environmentSchema = z.enum([
  "development",
  "preview",
  "production",
]);

export const publicDomainSchema = z.object({
  ROOT_DOMAIN: z.string().min(1),
  PASS_ORIGIN: z.url(),
  LINK_ORIGIN: z.url(),
  PULSE_ORIGIN: z.url(),
  DROP_ORIGIN: z.url(),
  ENVIRONMENT: environmentSchema,
});

export type PublicDomainConfig = z.infer<typeof publicDomainSchema>;

export function parsePublicDomainConfig(
  input: Record<string, unknown>,
): PublicDomainConfig {
  return publicDomainSchema.parse(input);
}
