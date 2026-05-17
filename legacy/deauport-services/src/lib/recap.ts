import { prisma } from "./prisma.js";
import { sendRecapEmail } from "./mailer.js";

type Logger = { info: Function; error: Function };

export async function runManualBackup(log: Logger) {
  log.info("Running manual backup...");
  const now = new Date();
  
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const fileName = `deauport-backup-${dd}${mm}${yy}.json`;

  try {
    const uptimeChecksWithLogs = await prisma.uptimeCheck.findMany({
      include: { logs: { orderBy: { createdAt: 'asc' } } }
    });
    const shortlinksWithHits = await prisma.shortLink.findMany();
    const backupData = {
      schemaVersion: 1,
      createdAt: now.toISOString(),
      data: {
        uptimeChecks: uptimeChecksWithLogs,
        shortlinks: shortlinksWithHits
      }
    };

    const htmlBody = `<p>Berikut terlampir file backup manual Deauport Anda.</p><p>Tidak ada data yang dihapus atau direset.</p>`;
    
    await sendRecapEmail(
      `Deauport Manual Backup - ${now.toLocaleDateString()}`,
      htmlBody,
      [{
        filename: fileName,
        content: JSON.stringify(backupData, null, 2),
        contentType: 'application/json'
      }]
    );
    log.info(`Manual backup email sent successfully.`);

  } catch (error: any) {
    log.error({ err: error.message }, "Failed to run manual backup");
    throw error;
  }
}


export async function runMonthlyRecap(log: Logger) {
  log.info("Running monthly recap...");

  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  startDate.setHours(0, 0, 0, 0);

  const monthName = startDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  
  const dd = String(endDate.getDate()).padStart(2, '0');
  const mm = String(endDate.getMonth() + 1).padStart(2, '0');
  const yy = String(endDate.getFullYear()).slice(-2);
  const fileName = `deauport-${dd}${mm}${yy}.json`;

  log.info(`Generating recap for ${monthName}`);

  try {
    const uptimeChecksWithLogs = await prisma.uptimeCheck.findMany({
      include: { logs: { where: { createdAt: { gte: startDate, lte: endDate } } } }
    });
    const shortlinks = await prisma.shortLink.findMany();
    const backupData = {
      schemaVersion: 1,
      createdAt: now.toISOString(),
      recapPeriod: { start: startDate.toISOString(), end: endDate.toISOString() },
      data: { uptimeChecks: uptimeChecksWithLogs, shortlinks }
    };
    
    const htmlBody = `<p>Berikut terlampir rekap data bulanan Deauport untuk ${monthName}.</p><p>Jumlah klik shortlink telah direset ke nol.</p>`;
    
    await sendRecapEmail(
      `Deauport Recap: ${monthName}`,
      htmlBody,
      [{
        filename: fileName,
        content: JSON.stringify(backupData, null, 2),
        contentType: 'application/json'
      }]
    );
    log.info(`Recap email for ${monthName} sent successfully.`);

    await prisma.shortLink.updateMany({ data: { hits: 0 } });
    log.info("Shortlink hit counters have been reset.");

  } catch (error: any) {
    log.error({ err: error.message }, "Failed to run monthly recap");
  }
}

export function startRecapScheduler(log: Logger) {
  let lastCheck = new Date().getMonth();
  const checkAndRun = () => {
    const now = new Date();
    if (now.getMonth() !== lastCheck && now.getDate() === 1) {
      log.info("New month detected, triggering scheduled recap job...");
      lastCheck = now.getMonth();
      runMonthlyRecap(log);
    }
  };
  const intervalId = setInterval(checkAndRun, 60 * 60 * 1000); 
  log.info("Monthly recap scheduler started.");
  return () => clearInterval(intervalId);
}