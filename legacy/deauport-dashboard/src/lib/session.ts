import { cookies } from "next/headers";

export async function getAuthed(): Promise<boolean> {
  const c = (await cookies()).get("deau_sess");
  return Boolean(c?.value);
}