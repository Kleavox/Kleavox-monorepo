"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { CreateUptimeModal } from "./uptime/create-modal";
import { CreateShortModal } from "./shortlinks/create-modal";

type Kind = "uptime" | "shortlinks";

export default function ManageHeaderClient({
  current,
}: {
  current: Kind;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    if (sp.get("new") === "1") setOpen(true);

    const checkHash = () => {
      if (current === "uptime" && location.hash === "#add-uptime") setOpen(true);
      if (current === "shortlinks" && location.hash === "#add-short") setOpen(true);
    };
    checkHash();
    addEventListener("hashchange", checkHash);
    return () => removeEventListener("hashchange", checkHash);
  }, [current]);

  return (
    <>
      <PageHeader
        title="Manage"
        subtitle="Kelola aplikasi & resource"
        sticky
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            + Add
          </button>
        }
      />
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <div className="flex items-center gap-2">
          <Tab href="/manage/uptime" active={current === "uptime"}>Uptime</Tab>
          <Tab href="/manage/shortlinks" active={current === "shortlinks"}>Shortlinks</Tab>
        </div>
      </div>

      {current === "uptime" ? (
        <CreateUptimeModal open={open} onClose={() => setOpen(false)} />
      ) : (
        <CreateShortModal open={open} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm";
  const on = "bg-[var(--surface-2)] text-[var(--text)]";
  const off =
    "text-subtle hover:bg-[color-mix(in_srgb,var(--surface-2)_80%,white_10%)]";
  return (
    <Link href={href} className={`${base} ${active ? on : off}`}>
      {children}
    </Link>
  );
}