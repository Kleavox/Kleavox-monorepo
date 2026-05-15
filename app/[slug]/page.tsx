// app/[slug]/page.tsx

import { prisma } from "@/lib/prisma";
import { getShortLink } from "@/lib/db/shortlink";
import Link from "next/link";
import SlugRedirector from "@/components/SlugRedirector";
import PasswordGuard from "@/components/PasswordGuard";
import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { lookup } from "fast-geoip";
import { Warning, ArrowLeft, CircleNotch, ShieldCheck, Activity } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

interface ShortRedirectPageProps { params: Promise<{ slug: string }>; }

const BaseContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen w-full flex items-center justify-center px-4 sm:px-6 bg-(--db-bg)">
    <div className="w-full max-w-2xl db-card p-1 lg:p-1.5 animate-reveal relative border-(--db-primary)/20 overflow-hidden shadow-[0_0_80px_rgba(163,230,53,0.06)]">
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none overflow-hidden select-none">
        <div className="absolute top-0 left-0 w-full h-full font-dot text-[8px] leading-none break-all animate-pulse">
          {Array(15).fill("1010011010101101010100101010110").join(" ")}
        </div>
      </div>
      <div className="bg-(--db-surface) rounded-[24px] p-6 sm:p-10 lg:p-12 relative z-10">
        {children}
      </div>
    </div>
  </div>
);

const ErrorCard = ({ title, msg }: { title: string, msg: string }) => (
  <BaseContainer>
    <div className="flex flex-col sm:flex-row items-center gap-8">
      <div className="p-7 bg-(--db-danger)/10 text-(--db-danger) rounded-4xl shrink-0">
        <Warning size={44} weight="fill" />
      </div>
      <div className="flex-1 text-center sm:text-left space-y-5">
        <div className="space-y-2">
          <h1 className="text-4xl nothing-title text-(--db-text)">{title}</h1>
          <p className="nothing-label text-(--db-danger) font-bold tracking-widest">{msg}</p>
        </div>
        <Link href="/" className="btn-primary w-full sm:w-fit px-8 py-4 text-xs tracking-widest">
          <ArrowLeft size={15} /> BACK_TO_SYSTEM
        </Link>
      </div>
    </div>
  </BaseContainer>
);

export default async function ShortRedirectPage({ params }: ShortRedirectPageProps) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const link = await getShortLink(slug);

  if (!link) return <ErrorCard title="404" msg="RELATIONAL_NODE_NULL" />;
  if (link.expiresAt && new Date() > link.expiresAt) return <ErrorCard title="EXPIRED" msg="TEMPORARY_ID_NULLED" />;

  if (link.password) {
    return (
      <BaseContainer>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex flex-col items-center shrink-0 space-y-4">
            <div className="p-7 bg-(--db-primary)/15 text-(--db-primary) rounded-4xl relative">
              <ShieldCheck size={44} className="animate-soft-pulse" />
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-(--db-primary) rounded-full border-2 border-(--db-surface)" />
            </div>
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-(--db-primary) animate-pulse" />
              <span className="nothing-label text-[9px] text-(--db-primary) font-bold">LOCKED_NODE</span>
            </div>
          </div>
          <div className="flex-1 w-full space-y-5 text-center sm:text-left">
            <div className="space-y-1">
              <h3 className="text-3xl nothing-title text-(--db-text)">AUTHORIZE</h3>
              <p className="nothing-label text-[10px] opacity-50">ACCESS_KEY_REQUIRED_FOR_VECTOR</p>
            </div>
            <PasswordGuard slug={link.slug} />
          </div>
        </div>
      </BaseContainer>
    );
  }

  (async () => {
    try {
      const headersList = await headers();
      const userAgent = headersList.get("user-agent") || "";
      const ip = headersList.get("x-real-ip") || headersList.get("x-forwarded-for") || "127.0.0.1";
      const realIp = Array.isArray(ip) ? ip[0] : ip.split(',')[0];
      const referrer = headersList.get("referer") || "Direct";
      const parser = new UAParser(userAgent);
      const result = parser.getResult();
      const geo = await lookup(realIp);
      await prisma.click.create({
        data: {
          shortLinkId: link.id,
          browser: result.browser.name, os: result.os.name,
          device: result.device.type || "desktop",
          country: geo?.country, city: geo?.city,
          ip: realIp, referrer: referrer,
        },
      });
    } catch (e) { console.error("Analytics Error:", e); }
  })();

  return (
    <BaseContainer>
      <div className="flex flex-col sm:flex-row items-center gap-8 lg:gap-12">
        <div className="flex flex-col items-center shrink-0 space-y-5">
          <div className="p-7 bg-(--db-primary)/15 text-(--db-primary) rounded-4xl">
            <CircleNotch size={44} className="animate-spin" />
          </div>
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-(--db-primary) animate-pulse shadow-[0_0_6px_rgba(163,230,53,0.6)]" />
              <span className="nothing-label text-[9px] text-(--db-text) font-bold">NODE_ACTIVE</span>
            </div>
            <p className="nothing-label text-[8px] opacity-30 uppercase">vordeau_infra</p>
          </div>
        </div>

        <div className="flex-1 w-full space-y-7 text-center sm:text-left">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl nothing-title text-(--db-text)">REDIRECTING</h1>
            <p className="nothing-label text-[10px] tracking-[0.2em] opacity-50">SYNCHRONIZING_NODE_VECTOR</p>
          </div>

          <div className="bg-(--db-surface-hover) border border-(--db-border) p-5 rounded-3xl relative">
            <div className="nothing-label text-[8px] absolute -top-2.5 left-5 bg-(--db-surface) px-2 text-(--db-primary) font-bold">DEST_TARGET</div>
            <p className="font-dot text-sm text-(--db-text) truncate opacity-50 tracking-tight">{link.targetUrl}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 w-full">
              <SlugRedirector target={link.targetUrl} delay={2} />
            </div>
            <Link
              href={link.targetUrl}
              className="btn-secondary w-full sm:w-fit px-7 py-4 text-[10px] tracking-widest whitespace-nowrap hover:bg-(--db-text) hover:text-(--db-bg) transition-all"
            >
              SKIP_SEQUENCE
            </Link>
          </div>
        </div>
      </div>
    </BaseContainer>
  );
}
