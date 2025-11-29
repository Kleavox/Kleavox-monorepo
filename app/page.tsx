import { PrismaClient } from '@prisma/client';
import ServerCard from './components/ServerCard';

const prisma = new PrismaClient();

export default async function Dashboard() {
  const servers = await prisma.server.findMany();

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-8">VPS Monitoring Dashboard</h1>
      
      {servers.length === 0 ? (
        <p>Belum ada server yang dikonfigurasi. Tambahkan via Prisma Studio / Seed.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <ServerCard key={server.id} server={server} />
          ))}
        </div>
      )}
    </main>
  );
}