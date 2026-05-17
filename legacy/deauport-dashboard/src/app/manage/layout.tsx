import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader } from "@/components/page-header";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Shell authed>
      <div className="mx-auto max-w-6xl">
        {children}
      </div>
    </Shell>
  );
}

export function ManageHeader({
  current,
  subtitle,
}: {
  current: "uptime" | "shortlinks";
  onAddHref: string;
  subtitle: string;
}) {
  return (
    <PageHeader
      title="Manage"
      subtitle={subtitle}
      sticky
      actions={
        <div className="flex gap-2">
          {current === "uptime" ? (
            <>
              <Link href="/manage/uptime?new=1#add-uptime" className="btn">+ Uptime</Link>
              <Link href="/manage/shortlinks?new=1#add-short" className="btn btn-ghost">+ Shortlink</Link>
            </>
          ) : (
            <>
              <Link href="/manage/uptime?new=1#add-uptime" className="btn btn-ghost">+ Uptime</Link>
              <Link href="/manage/shortlinks?new=1#add-short" className="btn">+ Shortlink</Link>
            </>
          )}
        </div>
      }
      className="border-b"
    >
    </PageHeader>
  );
}