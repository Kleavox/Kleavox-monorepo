import { Shell } from "@/components/shell";
import { H1, Subtle, Card } from "@/components/ui";
import type { Metadata } from "next";
import { getAuthed } from "@/lib/session";

export const metadata: Metadata = { title: "Privacy — Deauport" };

export default async function PrivacyPage() {
  const authed = await getAuthed();

  return (
    <Shell authed={authed}>
      <H1>Privacy</H1>
      <Subtle className="mt-1">
        Ringkasan kebijakan privasi untuk penggunaan dashboard & services.
      </Subtle>

      <div className="mt-6 space-y-4">
        <Card>
          <div className="text-sm font-medium">Data yang Diproses</div>
          <ul className="mt-2 list-inside list-disc text-sm text-subtle">
            <li>
              <span className="font-medium">Uptime checks</span>: Menyimpan nama, URL target, interval, dan metrik performa. Data ini ditampilkan di dashboard publik.
            </li>
            <li>
              <span className="font-medium">Shortlinks</span>: Menyimpan slug, URL target, dan jumlah klik (*hit counter*). Data ini juga bersifat publik.
            </li>
            <li>
              <span className="font-medium">Akun Admin</span>: Kredensial login hanya digunakan untuk satu akun admin yang dapat mengakses halaman &quot;Manage&quot; untuk mengelola data.
            </li>
          </ul>
        </Card>

        <Card>
          <div className="text-sm font-medium">Cookies & Sessions</div>
          <p className="mt-2 text-sm text-subtle">
            Session cookie hanya digunakan untuk proses autentikasi saat masuk ke halaman &quot;Manage&quot; yang bersifat privat. Halaman dashboard publik tidak menggunakan cookie autentikasi.
          </p>
        </Card>

        <Card>
          <div className="text-sm font-medium">Retensi & Kontrol Data</div>
          <ul className="mt-2 list-inside list-disc text-sm text-subtle">
            <li>Log uptime disimpan secukupnya untuk keperluan grafik dan dapat dipangkas secara berkala.</li>
            <li>Anda sebagai admin dapat menambah atau menghapus data kapan saja melalui halaman &quot;Manage&quot; yang privat.</li>
            <li>Konfigurasi dan environment tetap berada di dalam infrastruktur milik pengguna.</li>
          </ul>
        </Card>

        <Card>
          <div className="text-sm font-medium">Keamanan</div>
          <p className="mt-2 text-sm text-subtle">
            Halaman dashboard bersifat publik dan read-only. Akses untuk mengubah data (menambah, mengubah, menghapus) di halaman &quot;Manage&quot; dilindungi oleh satu password admin. Pastikan menyebarkan aplikasi ini melalui koneksi HTTPS.
          </p>
        </Card>
      </div>
    </Shell>
  );
}