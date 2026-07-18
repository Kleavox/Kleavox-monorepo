import type { Env } from "../env";
import { createDropLifecycle } from "./lifecycle";

export async function runDropMaintenance(env: Env): Promise<void> {
  await createDropLifecycle(env).maintain();
}
