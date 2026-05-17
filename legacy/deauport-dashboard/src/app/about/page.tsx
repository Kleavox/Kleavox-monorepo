import { Shell } from "@/components/shell";
import { H1, Subtle, Card } from "@/components/ui";
import type { Metadata } from "next";
import { getAuthed } from "@/lib/session";

export const metadata: Metadata = { title: "About — Deauport" };

export default async function AboutPage() {
  const authed = await getAuthed();

  return (
    <Shell authed={authed}>
      <H1>About Deauport</H1>
      <Subtle className="mt-1">
        Sebuah proyek personal untuk monitoring dan manajemen layanan.
      </Subtle>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <div className="text-sm font-medium">Visi Proyek</div>
          <p className="mt-2 text-sm text-subtle">
            Deauport adalah personal dashboard yang dirancang untuk memonitor uptime layanan dan mengelola shortlinks dengan cara yang sederhana, cepat, dan privat. Tujuannya adalah menyediakan alat yang ringkas dan fungsional tanpa fitur yang berlebihan.
          </p>
        </Card>

        <Card>
          <div className="text-sm font-medium">Fitur Utama</div>
          <ul className="mt-2 list-inside list-disc text-sm text-subtle">
            <li>Uptime monitoring dengan interval fleksibel.</li>
            <li>Visualisasi data uptime & latensi (Sparkline).</li>
            <li>Manajemen shortlinks dengan penghitung jumlah klik.</li>
            <li>Dashboard publik (read-only) dan halaman manajemen privat.</li>
            <li>Autentikasi admin dengan satu akun untuk keamanan.</li>
          </ul>
        </Card>

        <Card className="md:col-span-2">
          <div className="text-sm font-medium">Arsitektur & Teknologi</div>
          <p className="mt-2 text-sm text-subtle">
            Proyek ini terdiri dari dua bagian utama yang bekerja bersamaan:
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="font-semibold">Frontend (deauport-dashboard)</h4>
              <ul className="mt-2 list-inside list-disc text-sm text-subtle">
                <li>Framework: Next.js 15 (App Router)</li>
                <li>Styling: Tailwind CSS v4</li>
                <li>Bahasa: TypeScript</li>
                <li>Fokus: Menampilkan data dari API service dalam antarmuka yang responsif dan interaktif.</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Backend (deauport-services)</h4>
              <ul className="mt-2 list-inside list-disc text-sm text-subtle">
                <li>Framework: Fastify</li>
                <li>Database: Prisma ORM (PostgreSQL/SQLite)</li>
                <li>Bahasa: TypeScript</li>
                <li>Fokus: Menyediakan REST API, menangani logika bisnis, dan menjalankan background job untuk pinger uptime.</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}