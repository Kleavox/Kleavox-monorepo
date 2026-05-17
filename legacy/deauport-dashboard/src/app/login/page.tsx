import { Shell } from "@/components/shell";
import { H1, Subtle, Card } from "@/components/ui";
import type { Metadata } from "next";
import LoginForm from "./form-client";

export const metadata: Metadata = { title: "Login — Deauport" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  const { e } = await searchParams;

  return (
    <Shell>
      <section className="mx-auto grid min-h-[72dvh] max-w-md place-items-center">
        <div className="w-full">
          <H1 className="text-center">Login</H1>
          <Subtle className="mt-1 text-center">
            Masuk dengan password admin dari env.
          </Subtle>

          <Card className="mt-8 w-full">
            <LoginForm errorMsg={e ? decodeURIComponent(e) : ""} />
          </Card>
        </div>
      </section>
    </Shell>
  );
}