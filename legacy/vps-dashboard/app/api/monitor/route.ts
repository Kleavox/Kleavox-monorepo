import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');

  if (key !== process.env.MONITOR_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const disk = await si.fsSize();
    const os = await si.osInfo();

    let logs = '';
    try {
      const { stdout } = await execPromise('tail -n 20 /var/log/syslog'); 
      logs = stdout;
    } catch (e) {
      logs = 'Gagal membaca log atau permission denied';
    }

    return NextResponse.json({
      hostname: os.hostname,
      platform: os.platform,
      cpu: cpu.currentLoad.toFixed(2),
      mem: {
        total: mem.total,
        used: mem.active,
        percent: ((mem.active / mem.total) * 100).toFixed(2),
      },
      disk: disk[0] ? {
        fs: disk[0].fs,
        use: disk[0].use.toFixed(2),
      } : null,
      logs: logs
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}